---
search:
  boost: 0.01
---
# ConsoleLogQueryRunner

A general-purpose query runner that logs all executed SQL statements to the standard output using `console.log`. It wraps another query runner, delegating execution while recording detailed log information for inspection or debugging.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `ConsoleLogQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { ConsoleLogQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogQueryRunner";

async function main() {
    const connection = new DBConnection(new ConsoleLogQueryRunner(otherQueryRunner));
    // Do your queries here
}
```

## API Overview

The constructor receives a secondary optional argument with the following definition: 

```ts
interface ConsoleLogQueryRunnerOpts {
    timeGranularity?: 'ms' | 'us' | 'ns' // Granularity of time and duration logged, default 'ms'
    logTimestamps?: boolean // Include the time value when the log happened in nanoseconds since an arbitrary starting point, default false
    logDurations?: boolean // Include the duration of the query execution, default false
    logResults?: boolean // Include the result object in the log, default false
    paramsAsObject?: boolean // Write in the log the query, params, result and error wrapped in an object, default false
    includeLogPhase?: boolean // Write the phase name ('onQuery', 'onQueryResult', 'onQueryError') in the log, default false
}
```

!!! info

    In case the provided query runner doesn't support low-level transaction management, synthetic `beginTransaction`, `commit`, and `rollback` statements will be emitted to allow you to see them in the log.
