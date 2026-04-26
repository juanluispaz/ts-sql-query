---
search:
  boost: 0.577
---
# Bun Sqlite

This runner provides integration with the [Bun Sqlite](https://bun.com/docs/runtime/sqlite) driver, allowing `ts-sql-query` to execute queries on [SQLite](../../supported-databases/sqlite.md) databases.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! tip

    bun:sqlite supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Enables executing queries through a dedicated [Bun Sqlite](https://bun.com/docs/runtime/sqlite) connection.

```ts
import { BunSqlite3QueryRunner } from "ts-sql-query/queryRunners/BunSqlite3QueryRunner";
import { Database } from "bun:sqlite";

const db = new Database('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BunSqlite3QueryRunner(db));
    // Do your queries here
}
```

!!! note "safeIntegers"

    If your queries may return integers larger than JavaScript's safe integer range, consider enabling `safeIntegers` in the database configuration.
