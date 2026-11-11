---
search:
  boost: 0.577
---
<!-- doc-code-template: oracle -->
# oracledb

This page explains how to use `ts-sql-query` with the [oracledb](https://www.npmjs.com/package/oracledb) driver. It covers three approaches: using a connection pool promise, using a connection pool or using a single connection directly. The driver runs in thin mode by default, which needs no Oracle Client installed.

!!! success "Supported databases"

    - [Oracle](../../supported-databases/oracle.md)

!!! info "Tested with"

    [oracledb](https://www.npmjs.com/package/oracledb) `^26.0.0` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    Create the pool once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

!!! info "Commit outside a transaction"

    Oracle runs every statement inside a transaction, and oracledb doesn't commit it unless asked (its `autoCommit` defaults to `false`). `ts-sql-query` commits each statement executed outside a transaction, as every other database does; inside a transaction begun through `ts-sql-query` (`connection.transaction(...)` or `connection.beginTransaction()`), the work is committed by `commit()` only. So a query runner created over a connection with work of yours not committed yet commits it with its first statement, even a select, unless you create it [with `forUseInTransaction`](#inside-a-transaction-something-else-manages).

## Using a connection pool promise

Give the query runner the promise that `createPool` returns, without waiting for it: the first statement waits. For each statement the query runner takes a connection from the pool and gives it back. In a transaction it keeps one connection until the transaction ends.

```ts
import oracledb from 'oracledb';
import { OracleDBPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolPromiseQueryRunner";

const poolPromise = oracledb.createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1'
});

async function closePoolAndExit() {
    try {
        const pool = await poolPromise;
        await pool.close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

async function main() {
    const connection = new DBConnection(new OracleDBPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
    connection // ...
}
```

## Using a connection pool

The same, when you already have the pool.

```ts
import oracledb from 'oracledb';
import { OracleDBPoolQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolQueryRunner";

const poolPromise = oracledb.createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1'
});

async function closePoolAndExit() {
    try {
        const pool = await poolPromise;
        await pool.close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

async function main() {
    const pool = await poolPromise;
    const connection = new DBConnection(new OracleDBPoolQueryRunner(pool));
    // Do your queries here
    connection // ...
}
```

## Using a single connection

Every statement runs on the connection you give the query runner. You close it, the query runner doesn't.

```ts
import oracledb from 'oracledb';
import { OracleDBQueryRunner } from "ts-sql-query/queryRunners/OracleDBQueryRunner";

async function init() {
    try {
        await oracledb.createPool({
            user: 'user',
            password: 'pwd',
            connectString: 'localhost/XEPDB1'
        });
        await main();
    } finally {
        await closePoolAndExit();
    }
}

async function closePoolAndExit() {
    try {
        await oracledb.getPool().close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

init();

async function main() {
    const oracleConnection = await oracledb.getConnection();
    try {
        const connection = new DBConnection(new OracleDBQueryRunner(oracleConnection));
        // Do your queries here
        connection // ...
    } finally {
        await oracleConnection.close();
    }
}
```

## Connection requirements

**Rejected at the first query**, before anything is sent, with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION` and `name` `'ORA_SDTZ'` (Oracle doesn't support yet a `databaseTimeZone` other than UTC):

- **A session outside UTC: the environment variable `ORA_SDTZ` set to another zone, or not set when the process doesn't run in UTC.** oracledb sets the zone of the session from `ORA_SDTZ` when it opens a connection, or else from the offset of the process at that moment. The library takes the database as UTC, and the session must be in its zone: a `TIMESTAMP WITH LOCAL TIME ZONE` is read and written in the zone of the session, a `DATE` or a `TIMESTAMP` given back by a `returning` is converted with it, and what the database computes in the session (`current_date`, `localtimestamp`) comes in its zone. `ORA_SDTZ` is accepted as `UTC` or another name of UTC, or as `+00:00`; `LOCAL` and `DBTIMEZONE` are rejected, because their zone can't be known without a query. In a process in UTC nothing is needed: oracledb already sets the session to `+00:00`. If your database isn't in UTC, don't move the session to UTC to pass the check: a database outside UTC isn't supported yet (see [Time zones](../../time-zones.md#the-zone-of-the-database-and-the-session)). How the query runner knows the zone of the process is in [Time zones](../../time-zones.md#the-applications-zone).

Set it before the first connection is opened, in the environment or at the top of your entry point:

```bash
ORA_SDTZ=UTC node app.js
```

```ts
process.env['ORA_SDTZ'] = 'UTC'
```

A connection opened before, or a session whose zone you change with `ALTER SESSION SET TIME_ZONE`, isn't seen by the check.

**Not applied to the queries of the library**: the global `oracledb.fetchTypeHandler`, `oracledb.fetchAsString`, `oracledb.fetchAsBuffer` and `oracledb.maxRows`. They don't change what the library receives, and `maxRows` doesn't cut its results; your own executions keep them.

With the process outside UTC, a `DATE` or `TIMESTAMP` holding a wall clock that doesn't exist in the zone of the process comes back moved an hour: see [Time zones → Known limits](../../time-zones.md#known-limits).

## Running a statement on each new connection

Some settings are properties of the **database session**, not of the query, like the [session collation](../../collations.md#on-the-connection-the-session-collation). To pin them without touching your schema, run the statement **once per connection**, when the pool opens it. For the session time zone use `ORA_SDTZ` instead, which the query runner checks (see [Connection requirements](#connection-requirements)). oracledb pools take a `sessionCallback` for exactly this — it fires on each brand-new connection (and can be told to re-run when a connection is returned tagged for a different value):

```typescriptreact
import oracledb from 'oracledb';

const poolPromise = oracledb.createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1',
    sessionCallback: (connection, _requestedTag, callback) => {
        // Runs once per newly created pooled connection.
        connection.execute(`
            BEGIN
                -- Session collation: make comparisons case-insensitive session-wide
                -- (see the Collations page). Omit if you don't need it.
                EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_COMP = LINGUISTIC';
                EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_SORT = BINARY_CI';
            END;
        `, [], (err) => callback(err));
    }
});
```

The `NLS_COMP` / `NLS_SORT` pair is the [session collation](../../collations.md#on-the-connection-the-session-collation): on Oracle it reaches every comparison (`equals` / `like` / `distinct` / `order`), so it is the one engine where a pool-level collation is fully effective. Prefer a server / database already configured the way you want, and use this hook when you cannot change it.

## Large integers

There is nothing to configure: a `bigint`, a `customBigint`, a [`stringDecimal` or a `customDecimal`](../../column-types.md#exact-decimals) keeps all its digits, whatever the global settings of oracledb. A column read as an `int` arrives as a JavaScript `number`, and a value past `Number.MAX_SAFE_INTEGER` (`9_007_199_254_740_991`) is rejected with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` rather than rounded; read it as `bigint`.

## Inside a transaction something else manages

When the connection has a transaction that something else manages, because you execute statements on it with the driver or [another library](../combining-with-another-library.md) does, create the query runner with `forUseInTransaction`. Its statements run in that transaction and don't commit it; whoever manages the transaction commits it or rolls it back. `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`, and `connection.commit()` and `connection.rollback()` reject with `NOT_IN_TRANSACTION`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import oracledb from 'oracledb';
import { OracleDBQueryRunner } from "ts-sql-query/queryRunners/OracleDBQueryRunner";

async function main(oracleConnection: oracledb.Connection) {
    const connection = new DBConnection(new OracleDBQueryRunner(oracleConnection, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
    await oracleConnection.commit();
}
```

## Options of the query runner

The second argument of `OracleDBQueryRunner`, optional, is an object of type `OracleDBQueryRunnerConfig`, exported from `ts-sql-query/queryRunners/OracleDBQueryRunner`:

- **`forUseInTransaction`**: the connection is in a transaction that something else manages; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).
- **`typesByName`**: the type each parameter of a type name is bound with; see [The type of the parameters](#the-type-of-the-parameters).
- **`returningMaxSize`**: the longest text, in bytes, a `returning` gives back; 32767 by default, the longest `VARCHAR2`. A longer one fails with oracledb's `NJS-016`; see [Texts returned by returning](#texts-returned-by-returning).

`OracleDBPoolQueryRunner` and `OracleDBPoolPromiseQueryRunner` take `typesByName` and `returningMaxSize` too, in an `OracleDBPoolQueryRunnerConfig` and an `OracleDBPoolPromiseQueryRunnerConfig`, and pass them on to the query runner of each connection.

## The type of the parameters

oracledb binds each value with the type it gives a JavaScript value; the query runner binds a `localDate` as a `DATE` and a `localTime` or `localDateTime` as a `TIMESTAMP`, with the digits of its UTC getters whatever the zone of the process, so a `DATE` or `TIMESTAMP` column compares with it as it is and an index of the column can be used. The option `typesByName` maps the name of a type, the one you give a custom type or a built-in one like `'int'`, to the `DbType` of oracledb every parameter of that name is bound with, also its `null` and the value returned with `returning`:

```ts
import oracledb from 'oracledb';
import { OracleDBPoolQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolQueryRunner";

async function main(pool: oracledb.Pool) {
    // A value of the type Day is bound as a DATE, not as a TIMESTAMP
    const connection = new DBConnection(new OracleDBPoolQueryRunner(pool, { typesByName: { Day: oracledb.DB_TYPE_DATE } }));
    connection // ...
}
```

## Texts returned by returning

A `returning` of an insert, an update or a delete is executed with `RETURNING ... INTO`, and oracledb receives each value in a buffer of a size given in advance. The query runner gives a text 32767 bytes, the longest `VARCHAR2`; `returningMaxSize` changes it for every text, and `typesByName` takes an object with the `DbType` and the `maxSize` of a type name. A longer text fails with oracledb's `NJS-016`, and, outside a transaction, the row is already written.

Oracle returns a `CLOB` column as text only up to 4000 bytes (`ORA-22835` beyond). Declare its type name as `oracledb.DB_TYPE_CLOB` in `typesByName`, and the value returned is read as its text, of any length:

```ts
import oracledb from 'oracledb';
import { OracleDBPoolQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolQueryRunner";

async function main(pool: oracledb.Pool) {
    // Texts returned up to 4000 bytes; a value of the type LongText, from a CLOB column, of any length
    const connection = new DBConnection(new OracleDBPoolQueryRunner(pool, {
        returningMaxSize: 4000,
        typesByName: { LongText: oracledb.DB_TYPE_CLOB },
    }));
    connection // ...
}
```

## Procedures with a boolean parameter

`executeProcedure` calls the procedure in PL/SQL, which has a `BOOLEAN` type on every version of Oracle: a parameter of the `boolean` category is bound as a `BOOLEAN`. A procedure parameter of type `NUMBER` takes an `int`.
