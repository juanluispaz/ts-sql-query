---
search:
  boost: 0.577
---
# sqlite3

This runner provides integration with the [sqlite3](https://www.npmjs.com/package/sqlite3) driver, allowing `ts-sql-query` to execute queries on SQLite databases. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    [sqlite3](https://www.npmjs.com/package/sqlite3) `^6.0.1`

    This information reflects the driver version pinned in this project's `devDependencies` and exercised by the CI suite. Other compatible versions may work but are not actively tested.

!!! danger "Deprecated"

    The [sqlite3](https://www.npmjs.com/package/sqlite3) driver was deprecated by its maintainers on **2025-12-11**, so `Sqlite3QueryRunner` is deprecated as well — it is no longer listed in the *Recommended query runners* section, and the `Sqlite3QueryRunner` class is annotated with `@deprecated` so consumers see a strike-through in their IDE on every import and instantiation. Existing code keeps working — runtime behavior is unchanged and the runner will continue to ship for the time being — but new projects should pick another SQLite runner. Recommended replacements: [`better-sqlite3`](../recommended/better-sqlite3.md) (fast synchronous driver, the default choice for Node), [`node:sqlite`](../recommended/node_sqlite.md) (Node 22+'s built-in driver, zero dependencies), [`bun:sqlite`](../recommended/bun_sqlite.md) (when running on Bun), or [`sqlite-wasm-OO1`](../recommended/sqlite-wasm-OO1.md) (for environments without native bindings).

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Enables executing queries through a dedicated [sqlite3](https://www.npmjs.com/package/sqlite3) connection.

```ts
import { Database } from 'sqlite3';
import { Sqlite3QueryRunner } from "ts-sql-query/queryRunners/Sqlite3QueryRunner";

const db = new Database('./database.sqlite');

async function main() {
    const connection = new DBConnection(new Sqlite3QueryRunner(db));
    // Do your queries here
}
```
