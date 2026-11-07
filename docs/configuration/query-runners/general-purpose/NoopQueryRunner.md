---
search:
  boost: 0.01
---
# NoopQueryRunner

A query runner that takes the place of the database: it sends nothing, and always returns empty results. Useful for running code without a database when the results don't matter. To decide the result of each statement in a test, use [`MockQueryRunner`](MockQueryRunner.md).

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
import { NoopQueryRunner } from "ts-sql-query/queryRunners/NoopQueryRunner";

async function main() {
    const connection = new DBConnection(new NoopQueryRunner());
    // Queries here will not hit a real database
    
    // Do your queries here
    connection // ...
}
```

## What each query returns

| Query | Result |
|---|---|
| `executeSelectMany` | An empty list |
| `executeSelectNoneOrOne` | `null` |
| `executeSelectOne` | Rejects with `NO_RESULT`, as with a database that finds no row |
| `executeInsert`, `executeUpdate`, `executeDelete` | `0`, so with a minimum of rows (`executeUpdate(1)`) they reject with `MINIMUM_ROWS_NOT_REACHED` |

## Options

The constructor receives the name of a database, or an object of type `NoopQueryRunnerConfig`, exported from `ts-sql-query/queryRunners/NoopQueryRunner`, with these options:

- **`database`**: the database to write the SQL for. A connection sets it to its own database when you create it, so you only need this to use the query runner without a connection.
- **`promise`**: another `Promise` provider, for [synchronous query execution](../../../advanced/synchronous-query-runners.md).
- **`allowNestedTransactions`**: accepts a transaction inside another one, which is [rejected by default](../../../queries/transaction.md#nested-transactions).
