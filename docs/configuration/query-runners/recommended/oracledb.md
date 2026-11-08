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

## Running a statement on each new connection

Some settings are properties of the **database session**, not of the query — the [session time zone](../../time-zones.md#per-database) and the [session collation](../../collations.md#on-the-connection-the-session-collation). To pin them without touching your schema, run the statement **once per connection**, when the pool opens it. oracledb pools take a `sessionCallback` for exactly this — it fires on each brand-new connection (and can be told to re-run when a connection is returned tagged for a different value):

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
                -- Session time zone (see the Time zones page)
                EXECUTE IMMEDIATE q'[ALTER SESSION SET TIME_ZONE = 'UTC']';
                -- Session collation: make comparisons case-insensitive session-wide
                -- (see the Collations page). Omit if you don't need it.
                EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_COMP = LINGUISTIC';
                EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_SORT = BINARY_CI';
            END;
        `, [], (err) => callback(err));
    }
});
```

The time-zone statement is what the [Time zones page](../../time-zones.md#the-databases-zone) recommends aligning on connect; the `NLS_COMP` / `NLS_SORT` pair is the [session collation](../../collations.md#on-the-connection-the-session-collation) — on Oracle it reaches every comparison (`equals` / `like` / `distinct` / `order`), so it is the one engine where a pool-level collation is fully effective. Prefer a server / database already configured the way you want, and use this hook when you cannot change it.

## Large integers

If your queries may return numbers larger than JavaScript's safe integer range — a `bigint` column, or arithmetic that grows past `Number.MAX_SAFE_INTEGER` (`9_007_199_254_740_991`) — install a `fetchTypeHandler` that reads the wide `NUMBER` columns as strings:

```ts
import oracledb from 'oracledb';

oracledb.fetchTypeHandler = function(metaData) {
    // A NUMBER wider than 15 digits (or of unknown precision) can't round-trip
    // through a JavaScript number; fetch it as a string instead.
    if (metaData.dbType === oracledb.DB_TYPE_NUMBER && (!metaData.precision || metaData.precision > 15)) {
        return { type: oracledb.STRING };
    }
    return undefined;
};
```

Without it the driver reads every `NUMBER` as a JavaScript `number`, so an out-of-range value comes back rounded; ts-sql-query rejects that rounded number with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` rather than hand back a silently-wrong value. With it, the driver hands those columns over as strings and ts-sql-query converts them to the type the column declares (`bigint` stays exact, `int` raises `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` if the exact value doesn't fit — read it as `bigint`). Narrow columns keep coming back as `number`, so nothing else changes.

The handler can also be passed per query, or scoped by `metaData.name` if you prefer to name the columns explicitly.

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

`OracleDBPoolQueryRunner` and `OracleDBPoolPromiseQueryRunner` take `typesByName` too, in an `OracleDBPoolQueryRunnerConfig` and an `OracleDBPoolPromiseQueryRunnerConfig`, and pass it on to the query runner of each connection.

## The type of the parameters

oracledb binds each value with the type it gives a JavaScript value: a `Date` as a `TIMESTAMP`, for example. The option `typesByName` maps the name of a type, the one you give a custom type or a built-in one like `'int'`, to the `DbType` of oracledb every parameter of that name is bound with, also its `null` and the value returned with `returning`:

```ts
import oracledb from 'oracledb';
import { OracleDBPoolQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolQueryRunner";

async function main(pool: oracledb.Pool) {
    // A value of the type Day is bound as a DATE, not as a TIMESTAMP
    const connection = new DBConnection(new OracleDBPoolQueryRunner(pool, { typesByName: { Day: oracledb.DB_TYPE_DATE } }));
    connection // ...
}
```
