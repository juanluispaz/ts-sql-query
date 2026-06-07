---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# sqlite-wasm OO1

This runner provides integration with the WebAssembly-based [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md), allowing `ts-sql-query` to execute queries on SQLite databases. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) `^3.53.0-build1`

    This information reflects the driver version pinned in this project's `devDependencies` and exercised by the CI suite. Other compatible versions may work but are not actively tested.

!!! tip

    [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Enables executing queries through a dedicated WebAssembly-based [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md) connection.

```ts
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Sqlite3WasmOO1QueryRunner } from "ts-sql-query/queryRunners/Sqlite3WasmOO1QueryRunner";
import type { Database } from "@sqlite.org/sqlite-wasm";

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const db: Database = new sqlite3.oo1.DB();
    const connection = new DBConnection(new Sqlite3WasmOO1QueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## sqlite-wasm OO1 and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension`. The [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) build does not bundle SQLite's optional [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c), but you can provide compatible SQL functions with the OO1 API's `createFunction`:

```ts
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { Database } from "@sqlite.org/sqlite-wasm";
import { parse as uuidParse, stringify as uuidStringify, v7 as uuidv7 } from "uuid";

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const db: Database = new sqlite3.oo1.DB();

    // Implement uuid extension functions

    db.createFunction("uuid", (_ctxPtr) => uuidv7());
    db.createFunction("uuid_str", (_ctxPtr, value) => {
        if (!(value instanceof Uint8Array)) {
            throw new TypeError("uuid_str expects a SQLite BLOB");
        }
        return uuidStringify(value);
    });
    db.createFunction("uuid_blob", (_ctxPtr, value) => {
        if (typeof value !== "string") {
            throw new TypeError("uuid_blob expects a UUID string");
        }
        return uuidParse(value);
    });

    // ...
}
```

!!! tip "Generating UUIDs"

    The snippet uses **UUID v7** so that, with the canonical byte order produced by `uuidParse`, the 16-byte blob keeps its chronological ordering on the primary-key index.

!!! warning

    The binary representation used in this implementation is not intended to be compatible with SQLite’s optional UUID extension.
