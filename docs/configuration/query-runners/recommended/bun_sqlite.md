---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# Bun Sqlite

This runner provides integration with the [Bun Sqlite](https://bun.com/docs/runtime/sqlite) driver, allowing `ts-sql-query` to execute queries on [SQLite](../../supported-databases/sqlite.md) databases.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    The built-in `bun:sqlite` module, on **Bun**.

    This information reflects the runtimes the test suite runs it on against a real database.

!!! tip

    bun:sqlite supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Enables executing queries through a dedicated [Bun Sqlite](https://bun.com/docs/runtime/sqlite) connection.

```ts
import { BunSqliteQueryRunner } from "ts-sql-query/queryRunners/BunSqliteQueryRunner";
import { Database } from "bun:sqlite";

const db = new Database('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BunSqliteQueryRunner(db));
    // Do your queries here
    connection // ...
}
```

!!! note "Safe Integers"

    If your queries may return integers larger than JavaScript's safe integer range, consider enabling `safeIntegers` in the database configuration.

## bun:sqlite and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension` that requires the [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c). Bun's bundled SQLite does not include it on every platform, but you can provide compatible SQL functions with `Database.function`:

```ts
import { Database } from "bun:sqlite";
import { parse as uuidParse, stringify as uuidStringify, v7 as uuidv7 } from "uuid";

const db = new Database('foobar.db', options);

// Implement uuid extension functions

db.function('uuid', () => uuidv7())
db.function('uuid_str', (blob: Uint8Array) => uuidStringify(blob))
db.function('uuid_blob', (uuid: string) => uuidParse(uuid))

// ...
```

!!! tip "Generating UUIDs"

    The snippet uses **UUID v7** so that, with the canonical byte order produced by `uuidParse`, the 16-byte blob keeps its chronological ordering on the primary-key index.

!!! warning

    The binary representation used in this implementation is not intended to be compatible with SQLite’s optional UUID extension.
