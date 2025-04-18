---
search:
  boost: 0.01
---
# ConsoleLogNoopQueryRunner

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

A fake connections that write all the queries to the standard output using `console.log` and returns an empty result.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogNoopQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogNoopQueryRunner";

async function main() {
    const connection = new DBConnection(new ConsoleLogNoopQueryRunner());
    // Do your queries here
}
```

!!! tip

    `ConsoleLogNoopQueryRunner` supports synchronous query execution. See [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.
