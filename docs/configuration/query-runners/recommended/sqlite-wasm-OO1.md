---
search:
  boost: 0.577
---
# sqlite-wasm OO1

This runner provides integration with the WebAssembly-based [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md), allowing `ts-sql-query` to execute queries on SQLite databases. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! tip

    better-sqlite3 supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Enables executing queries through a dedicated WebAssembly-based [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md) connection.

```ts
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { Sqlite3WasmOO1QueryRunner } from "ts-sql-query/queryRunners/Sqlite3WasmOO1QueryRunner";

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const db: Database = new sqlite3.oo1.DB();
    const connection = new DBConnection(new Sqlite3WasmOO1QueryRunner(db));
    // Do your queries here
}
```
