---
search:
  boost: 0.01
---
# NoopQueryRunner

A query runner that takes the place of the database: it sends nothing, and always returns empty results. Useful for running code without a database when the results don't matter, and, wrapped in a [`ConsoleLogQueryRunner`](ConsoleLogQueryRunner.md), for seeing the SQL each call writes. It is a [`MockQueryRunner`](MockQueryRunner.md) without a function, so with the one that gives those results, `noopQueryExecutor`, that rejects a transaction inside another one by default: to decide the result of each statement in a test, use `MockQueryRunner` with a function of yours.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `NoopQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

## Creating it

```ts
import { NoopQueryRunner } from "ts-sql-query";

async function main() {
    const connection = new DBConnection(new NoopQueryRunner());
    // Queries here will not hit a real database
    
    // Do your queries here
    connection // ...
}
```

## Seeing the SQL each call writes

```ts
import { ConsoleLogQueryRunner, NoopQueryRunner } from "ts-sql-query";

const connection = new DBConnection(new ConsoleLogQueryRunner(new NoopQueryRunner()));
```

## What each query returns

| Query | Result |
|---|---|
| `executeSelectMany` | An empty list |
| `executeSelectNoneOrOne` | `null` |
| `executeSelectOne` | Rejects with `NO_RESULT`, as with a database that finds no row |
| `executeInsert`, `executeUpdate`, `executeDelete` | `0`, so with a minimum of rows (`executeUpdate(1)`) they reject with `MINIMUM_ROWS_NOT_REACHED` |
| `executeSelectPage` | No rows, and a count of `0` |

`noopQueryExecutor`, exported from `ts-sql-query`, is that function, the one of a `MockQueryRunner` created without a function: call it from a function of yours for the queries your test doesn't care about.

As a `MockQueryRunner`, `isMocked` is `true`, and only a `TsSqlError` is an error of the database: an error your code throws in a transaction reaches you as it is, not wrapped.

## Options

The constructor receives an object of type `NoopQueryRunnerConfig`, exported from `ts-sql-query`, with these options:

- **`database`**: the database to write the SQL for. A connection sets it to its own database when you create it, so you only need this to use the query runner without a connection.
- **`promise`**: another `Promise` provider, for [synchronous query execution](../../../advanced/synchronous-query-runners.md).
- **`allowNestedTransactions`**: accepts a transaction inside another one, which is [rejected by default](../../../queries/transaction.md#nested-transactions).
