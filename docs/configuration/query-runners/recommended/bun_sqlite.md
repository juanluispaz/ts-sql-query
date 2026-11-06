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

!!! warning "A `Database` is a single connection"

    A `Database` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `Database` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for requests that run at the same time with transactions: open a `Database` for each one, which is another connection to the same file.

## Using a single connection

Every statement runs on the database object you give the query runner.

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

## Large integers

If your queries may return integers larger than JavaScript's safe integer range, create the database with `new Database('foobar.db', { safeIntegers: true })`. Without it an out-of-range value comes back rounded, and `ts-sql-query` rejects it with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` instead of returning a wrong value. With it, every integer arrives as a `BigInt`, and `ts-sql-query` converts it to the type the column declares: an `int` column still gives a `number`.

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

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { BunSqliteQueryRunner } from "ts-sql-query/queryRunners/BunSqliteQueryRunner";
import { Database } from "bun:sqlite";

const db = new Database('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BunSqliteQueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```
