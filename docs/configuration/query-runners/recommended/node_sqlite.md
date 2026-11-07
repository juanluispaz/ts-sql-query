---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# node:sqlite

This runner provides integration with Node.js' built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) `DatabaseSync` API, allowing `ts-sql-query` to execute queries on SQLite databases without installing an additional SQLite driver. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    The built-in `node:sqlite` module, on **Node.js** and **Bun**.

    This information reflects the runtimes the test suite runs it on against a real database.

!!! warning "Runtime requirements"

    | Runtime | What it needs |
    |---|---|
    | **Node 26** | Nothing |
    | **Node 24** | Nothing |
    | **Node 22.13 or newer** | Nothing |
    | **Node 22.5 to 22.12** | Launch Node with `--experimental-sqlite`. `DatabaseSync.function()` isn't there, so you can't [register the functions for UUIDs](#nodesqlite-and-uuids); the rest of the queries work |
    | **Bun 1.4 or newer** | Nothing: it has its own implementation, with `function()` |

    To launch with the flag: `node --experimental-sqlite app.js`, or `NODE_OPTIONS=--experimental-sqlite tsx app.ts`. From Node 22.13 the flag isn't needed. Node 22 and 24 write a warning that the module is experimental; Node 26 doesn't.

!!! tip

    node:sqlite `DatabaseSync` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "A `DatabaseSync` is a single connection"

    A `DatabaseSync` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `DatabaseSync` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for requests that run at the same time with transactions: open a `DatabaseSync` for each one, which is another connection to the same file.

## Using a single connection

Every statement runs on the database object you give the query runner.

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/queryRunners/NodeSqliteQueryRunner";

const db = new DatabaseSync('foobar.db', options);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## Large integers

By default, `node:sqlite` reads integers as JavaScript numbers and fails when one is outside JavaScript's safe integer range: the query rejects with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`. If your queries may return larger integers, create the database with `new DatabaseSync('foobar.db', { readBigInts: true })`, where your runtime has that option (Node 24.4 or newer). Every integer then arrives as a `BigInt`, and `ts-sql-query` converts it to the type the column declares: an `int` column still gives a `number`.

## node:sqlite and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension`. Node.js does not bundle SQLite's optional [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c), but you can provide compatible SQL functions with `DatabaseSync.function`.

```ts
import { Buffer } from "node:buffer";
import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from "node:sqlite";
import { parse as uuidParse, stringify as uuidStringify, v7 as uuidv7 } from "uuid";

type NodeSqliteFunction = (...args: SQLOutputValue[]) => SQLInputValue;

const uuid: NodeSqliteFunction = () => uuidv7();
const uuidStr: NodeSqliteFunction = (value) => {
    if (!(value instanceof Uint8Array)) {
        throw new TypeError("uuid_str expects a SQLite BLOB");
    }
    return uuidStringify(value);
};
const uuidBlob: NodeSqliteFunction = (value) => {
    if (typeof value !== "string") {
        throw new TypeError("uuid_blob expects a UUID string");
    }
    return Buffer.from(uuidParse(value));
};

const db = new DatabaseSync('foobar.db', options);

// Implement uuid extension functions

db.function("uuid", uuid);
db.function("uuid_str", uuidStr);
db.function("uuid_blob", uuidBlob);

// ...
```

!!! tip "Generating UUIDs"

    The snippet uses **UUID v7** so that, with the canonical byte order produced by `uuidParse`, the 16-byte blob keeps its chronological ordering on the primary-key index.

!!! warning

    The binary representation used in this implementation is not intended to be compatible with SQLite’s optional UUID extension.

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/queryRunners/NodeSqliteQueryRunner";

const db = new DatabaseSync('foobar.db', options);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Options of the query runner

The second argument of `NodeSqliteQueryRunner`, optional, is an object of type `NodeSqliteQueryRunnerConfig`, exported from `ts-sql-query/queryRunners/NodeSqliteQueryRunner`:

- **`promise`**: another `Promise` provider, for [synchronous query execution](../../../advanced/synchronous-query-runners.md).
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).
