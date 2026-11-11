---
search:
  boost: 0.01
---
# ConsoleLogQueryRunner

A query runner that writes each statement on the standard output with `console.log`, before running it with the query runner it wraps. To send the statements to a logger of your own, use [`LoggingQueryRunner`](LoggingQueryRunner.md).

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `ConsoleLogQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

## Creating it

```ts
import { ConsoleLogQueryRunner } from "ts-sql-query";

async function main() {
    const connection = new DBConnection(new ConsoleLogQueryRunner(otherQueryRunner));
    // Do your queries here
    connection // ...
}
```

By default it writes one line for each statement before it runs, with the type of query, the SQL and its parameters. It doesn't write the result, or an error. With `logResults`, `logDurations` or `logTimestamps` it also writes a line when the statement ends, with its result or its error.

## Options

The constructor receives the options as a second optional argument:

```typescript
interface ConsoleLogQueryRunnerOpts {
    timeGranularity?: 'ms' | 'us' | 'ns' // Unit of the times and durations written, default 'ms'
    logTimestamps?: boolean // Include the time of the log, counted from an arbitrary starting point, default false
    logDurations?: boolean // Include the duration of the statement, default false
    logResults?: boolean // Include the result of the statement, default false
    paramsAsObject?: boolean // Write the query, params, result and error wrapped in an object, default false
    includeLogPhase?: boolean // Write the phase name ('onQuery', 'onQueryResult', 'onQueryError'), default false
}
```

`ConsoleLogQueryRunnerOpts` and `TimeGranularity`, the type of `timeGranularity`, are exported from `ts-sql-query`.

!!! info

    When the driver begins and commits the transaction by itself, as `postgres` and Bun SQL do in `connection.transaction(...)`, synthetic `beginTransaction`, `commit`, and `rollback` statements will be emitted to allow you to see them in the log.
