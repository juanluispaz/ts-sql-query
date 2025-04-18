---
search:
  boost: 0.01
---
# ConsoleLogQueryRunner

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

A query runner that write all the queries to the standard output using `console.log` and delegate the execution of the queries to the query runner received as argument in the constructor.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogQueryRunner";

async function main() {
    const connection = new DBConnection(new ConsoleLogQueryRunner(otherQueryRunner));
    // Do your queries here
}
```

The constructor receives a secondary optional argument with the folloging definition: 

```ts
interface ConsoleLogQueryRunnerOpts {
    timeGranularity?: 'ms' | 'us' | 'ns' // Granularity of time and duration logged, default 'ms'
    logTimestamps?: boolean // Include the time value when the log happened in naonseconds since an arbitrary starting point, default false
    logDurations?: boolean // Include the duration of the query execution, default false
    logResults?: boolean // Include the result object in the log, default false
    paramsAsObject?: boolean // Write in the log the query, params, result and error wrapped in an object, default false
    includeLogPhase?: boolean // Write the phase name ('onQuery', 'onQueryResult', 'onQueryError') in the log, default false
}
```

!!! info

    In case the provided query runner doesn't support low-level transaction management, fake `beginTransaction`, `commit`, and `rollback` will be emitted to allow you to see them in the log.
