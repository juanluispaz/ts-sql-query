---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlserver -->
# mssql

This page explains how to use `ts-sql-query` with the [mssql](https://www.npmjs.com/package/mssql) driver. It covers two approaches: using a connection pool promise or using a connection pool. There is no query runner over a single connection: mssql only reserves a connection of its pool for a transaction.

!!! success "Supported databases"

    - [SQL Server](../index.md)

!!! info "Tested with"

    [mssql](https://www.npmjs.com/package/mssql) `^12.7.11` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    Create the pool once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../../configuration/connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool promise

Give the query runner the promise that `connect()` returns, without waiting for it: the first statement waits. Each statement runs on a connection of the pool, and in a transaction every statement runs on the same one until the transaction ends.

```ts
import mssql from 'mssql'
import { MssqlPoolPromiseQueryRunner } from "ts-sql-query/sqlserver/mssql";

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
import { MssqlPoolQueryRunner } from "ts-sql-query/sqlserver/mssql";

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

- **`useUTC: false`** in the `options` of the pool, when the process doesn't run in UTC. With it the driver, tedious, writes and reads a date and a time with the local getters, and the values in the database are in UTC. In a process in UTC it's accepted, and `useUTC` is `true` by default. How the query runner knows the zone of the process is in [Time zones](../../../configuration/time-zones.md#the-applications-zone).
- **`camelCaseColumns: true`** or a **`columnNameReplacer`** in the `options` of the pool: tedious renames the columns of the results, and the library reads each column by its name.
- **A `textsize` below `2147483647`**, the default of tedious, in the `options` of the pool: tedious sets it as the `TEXTSIZE` of each connection, and a longer text of a `varchar(max)`, `nvarchar(max)` or `varbinary(max)` value would be cut without an error.

**Required and not checked**: the server's operating system in UTC, which is the zone of the database: `getdate()`, `current_timestamp`, `currentDate()`, `currentTime()` and `currentDateTime()` give the date and time in it. SQL Server has no session zone. See [Time zones](../../../advanced/dates-and-times/column-kinds-and-session.md#the-zone-of-the-database-and-the-session).

**Not applied to the queries of the library**: `arrayRowMode`. Each request of the query runner gives its rows as objects; your own requests keep the mode of the pool.

## Inside a transaction something else manages

When your code or [another library](../../../configuration/query-runners/combining-with-another-library.md) manages the transaction, create the query runner with the mssql `Transaction`, once it has begun. The query runner runs its statements in that transaction, and whoever began it commits it or rolls it back. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import mssql from 'mssql'
import { MssqlPoolQueryRunner } from "ts-sql-query/sqlserver/mssql";

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

Each parameter is sent with the SQL Server type of [the type requested for it](../../../advanced/data-types/sql-data-types.md#how-a-value-is-sent-to-the-database), like `int` or `nvarchar`. A text compared with a `varchar` column goes as an `nvarchar`, which makes SQL Server convert the column, and with a SQL collation, like the default `SQL_Latin1_General_CP1_CI_AS`, read its whole index. The recommended way to avoid it is to declare the SQL data type of the column, `withSqlDataType({ family: 'character string', length: 50, national: false })`: its texts are then sent as a `varchar(50)`, and the index is sought (see [The type of a column in the database](../../../advanced/data-types/sql-data-types.md)).

A `localDateTime` is sent as a `datetime2`. Compared with a `datetime` column, SQL Server converts the column to a `datetime2` with its exact fraction of 1/300 of a second, so an equality doesn't find a value with milliseconds: `10:00:00.123` is stored as `10:00:00.1233333`. Declare the SQL data type of such a column, `withSqlDataType(typesConnection.sqlDataTypeFrom('datetime'))`, and its values are sent as a `datetime` (also for `smalldatetime`), which finds them.

The second argument of both query runners, optional, is an object with one option, `driverTypeOf`, for a type the library doesn't send as you need: a function that receives what the library knows of each parameter (its type, its SQL data type, …, the same as [the context of the query](../../../advanced/running-queries/query-execution-metadata.md#get-the-type-of-each-parameter)) and its value, and gives the mssql type it is sent with: a type of `TYPES`, like `TYPES.Money` or `TYPES.Xml`, or one with its arguments, like `TYPES.Decimal(18, 4)`; with `undefined`, as the library does. Its types are `MssqlPoolPromiseQueryRunnerConfig` and `MssqlPoolQueryRunnerConfig`, exported from the module of each query runner.

<!-- doc-code-snippet-template: sqlserver -->
```ts
import mssql from 'mssql'
import { AdditiveType } from "ts-sql-query";
import { MssqlPoolPromiseQueryRunner } from "ts-sql-query/sqlserver/mssql";

const { ConnectionPool, TYPES } = mssql

abstract class MoneyType extends AdditiveType<number, 'Money'> {
    static override readonly type = 'Money'
}

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const connection = new DBConnection(new MssqlPoolPromiseQueryRunner(poolPromise, {
        // A value of MoneyType goes as a money, instead of the int or float of its JavaScript number
        driverTypeOf: (param) => param.requestedType === MoneyType ? TYPES.Money : undefined
    }));
    connection // ...
}
```

`TYPES.Decimal(18, 4)` rounds a value to 4 decimals, and the driver turns the value of a `TYPES.Decimal` into a JavaScript number, so a long decimal loses digits; `TYPES.Decimal` without arguments is `decimal(18, 0)`, which rounds the fraction away. An exact decimal is a [`DecimalsType`](../../../configuration/data-types.md#exact-decimals), sent with every digit without it.
