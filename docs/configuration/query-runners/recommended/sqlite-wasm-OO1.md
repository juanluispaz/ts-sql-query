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

    [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) `^3.54.1-build1` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! tip

    `Sqlite3WasmOO1QueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "A `Database` is a single connection"

    A `Database` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `Database` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for work that runs at the same time with transactions.

## Using a single connection

Every statement runs on the database object you give the query runner. `new sqlite3.oo1.DB()` with no arguments creates a database in memory.

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

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import type { Database } from "@sqlite.org/sqlite-wasm";
import { Sqlite3WasmOO1QueryRunner } from "ts-sql-query/queryRunners/Sqlite3WasmOO1QueryRunner";

async function main(db: Database) {
    const connection = new DBConnection(new Sqlite3WasmOO1QueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```
