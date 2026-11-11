---
search:
  boost: 0.01
---
# ConsoleLogNoopQueryRunner

A query runner that takes the place of the database: it writes each statement on the console with `console.log`, sends nothing, and always returns [empty results](NoopQueryRunner.md#what-each-query-returns). Useful to see the SQL your code would run, without a database.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `ConsoleLogNoopQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

## Creating it

```ts
import { ConsoleLogNoopQueryRunner } from "ts-sql-query";

async function main() {
    const connection = new DBConnection(new ConsoleLogNoopQueryRunner());
    // Do your queries here
    connection // ...
}
```

The constructor receives the name of a database, or an object of type `ConsoleLogNoopQueryRunnerConfig`, exported from `ts-sql-query`, with `database` and `promise`: see the [options of `NoopQueryRunner`](NoopQueryRunner.md#options).
