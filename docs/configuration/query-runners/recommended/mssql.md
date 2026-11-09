---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlserver -->
# mssql

This page explains how to use `ts-sql-query` with the [mssql](https://www.npmjs.com/package/mssql) driver. It covers two approaches: using a connection pool promise or using a connection pool. There is no query runner over a single connection: mssql only reserves a connection of its pool for a transaction.

!!! success "Supported databases"

    - [SQL Server](../../supported-databases/sqlserver.md)

!!! info "Tested with"

    [mssql](https://www.npmjs.com/package/mssql) `^12.7.11` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    Create the pool once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool promise

Give the query runner the promise that `connect()` returns, without waiting for it: the first statement waits. Each statement runs on a connection of the pool, and in a transaction every statement runs on the same one until the transaction ends.

```ts
import mssql from 'mssql'
import { MssqlPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/MssqlPoolPromiseQueryRunner";

const { ConnectionPool } = mssql

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const connection = new DBConnection(new MssqlPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
    connection // ...
}
```

## Using a connection pool

The same, when you already have the pool connected.

```ts
import mssql from 'mssql'
import { MssqlPoolQueryRunner } from "ts-sql-query/queryRunners/MssqlPoolQueryRunner";

const { ConnectionPool } = mssql

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const mssqlPool = await poolPromise;
    const connection = new DBConnection(new MssqlPoolQueryRunner(mssqlPool));
    // Do your queries here
    connection // ...
}
```

## Connection requirements

**Rejected** when the query runner is created, with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION`; `name` says which. `MssqlPoolPromiseQueryRunner` sees the configuration of the pool only when its promise resolves, so it rejects its first query instead.

- **`useUTC: false`** in the `options` of the pool, when the process doesn't run in UTC. With it the driver, tedious, writes and reads a date and a time with the local getters, and the values in the database are in UTC. In a process in UTC it's accepted, and `useUTC` is `true` by default. How the query runner knows the zone of the process is in [Time zones](../../time-zones.md#the-applications-zone).
- **`camelCaseColumns: true`** or a **`columnNameReplacer`** in the `options` of the pool: tedious renames the columns of the results, and the library reads each column by its name.

**Not applied to the queries of the library**: `arrayRowMode`. Each request of the query runner gives its rows as objects; your own requests keep the mode of the pool.

## Inside a transaction something else manages

When your code or [another library](../combining-with-another-library.md) manages the transaction, create the query runner with the mssql `Transaction`, once it has begun. The query runner runs its statements in that transaction, and whoever began it commits it or rolls it back. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import mssql from 'mssql'
import { MssqlPoolQueryRunner } from "ts-sql-query/queryRunners/MssqlPoolQueryRunner";

async function main(mssqlPool: mssql.ConnectionPool) {
    const transaction = mssqlPool.transaction();
    await transaction.begin();
    const connection = new DBConnection(new MssqlPoolQueryRunner(transaction));
    // Do your queries here, in the transaction
    connection // ...
    await transaction.commit();
}
```

## The type of the parameters

Each parameter is sent with the SQL Server type of [the category of its type](../../column-types.md#how-a-value-is-sent-to-the-database), like `int` or `nvarchar`. The second argument of both query runners, optional, is an object with one option, `typesByName`: it maps the name of a type, the one you give a custom type or a built-in one like `'int'`, to the mssql type every parameter of that name is sent with. The value is a type of `TYPES`, like `TYPES.NVarChar`, or one with its arguments, like `TYPES.Decimal(18, 4)`. Its types are `MssqlPoolPromiseQueryRunnerConfig` and `MssqlPoolQueryRunnerConfig`, exported from the module of each query runner.

```ts
import mssql from 'mssql'
import { MssqlPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/MssqlPoolPromiseQueryRunner";

const { ConnectionPool, TYPES } = mssql

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const connection = new DBConnection(new MssqlPoolPromiseQueryRunner(poolPromise, {
        typesByName: { ExactDecimal: TYPES.NVarChar, Price: TYPES.Decimal(18, 4) }
    }));
    connection // ...
}
```

`TYPES.Decimal(18, 4)` rounds a value to 4 decimals. For an exact decimal kept as text, use `TYPES.NVarChar`, and SQL Server converts the text where a `decimal` is expected: the driver turns the value of a `TYPES.Decimal` into a JavaScript number, so a long decimal loses digits, and `TYPES.Decimal` without arguments is `decimal(18, 0)`, which rounds the fraction away.
