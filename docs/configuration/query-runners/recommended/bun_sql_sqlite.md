---
search:
  boost: 0.577
---
# Bun SQL for SQLite

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver configured with the SQLite adapter, allowing `ts-sql-query` to execute queries on [SQLite](../../supported-databases/sqlite.md) databases.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a Bun SQL SQLite connection

Executes queries through a [Bun SQL](https://bun.com/docs/runtime/sql) connection configured with the SQLite adapter.

```ts
import { SQL } from "bun";
import { BunSqlSqliteQueryRunner } from "ts-sql-query/queryRunners/BunSqlSqliteQueryRunner";

const sql = new SQL({
    adapter: 'sqlite',
    filename: './foobar.db',
});

async function main() {
    const connection = new DBConnection(new BunSqlSqliteQueryRunner(sql));
    // Do your queries here
}
```

!!! note "Safe Integers"

    If your queries may return integers larger than JavaScript's safe integer range, consider enabling `safeIntegers` in the Bun SQL SQLite configuration.
