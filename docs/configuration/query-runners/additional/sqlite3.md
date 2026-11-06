---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# sqlite3

This runner provides integration with the [sqlite3](https://www.npmjs.com/package/sqlite3) driver, allowing `ts-sql-query` to execute queries on SQLite databases. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    [sqlite3](https://www.npmjs.com/package/sqlite3) `^6.0.1` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! danger "Deprecated"

    The [sqlite3](https://www.npmjs.com/package/sqlite3) driver was deprecated by its maintainers on **2025-12-11**, so `Sqlite3QueryRunner` is deprecated as well. Existing code keeps working and the query runner still ships, but new projects should pick another SQLite query runner: [`better-sqlite3`](../recommended/better-sqlite3.md) (fast synchronous driver, the default choice for Node), [`node:sqlite`](../recommended/node_sqlite.md) (Node 22+'s built-in driver, zero dependencies), [`bun:sqlite`](../recommended/bun_sqlite.md) (when running on Bun), or [`sqlite-wasm-OO1`](../recommended/sqlite-wasm-OO1.md) (for environments without native bindings).

!!! warning "BigInt parameter binding"

    The [sqlite3](https://www.npmjs.com/package/sqlite3) driver cannot bind a JavaScript `BigInt` parameter: it silently binds `NULL` instead, which breaks any insert or update that targets a `bigint` column (for example, tripping a `NOT NULL` constraint).

    As a best-effort fallback for this deprecated driver, `Sqlite3QueryRunner` coerces a `bigint` parameter to a `number` before binding it, so the value still reaches the database. **This loses precision for integers larger than `Number.MAX_SAFE_INTEGER` (`9_007_199_254_740_991`).**

    If you need full `int64` fidelity on SQLite, use a runner that binds `BigInt` natively instead: [`better-sqlite3`](../recommended/better-sqlite3.md), [`node:sqlite`](../recommended/node_sqlite.md), [`bun:sqlite`](../recommended/bun_sqlite.md) or [`sqlite-wasm-OO1`](../recommended/sqlite-wasm-OO1.md).

!!! warning "A `Database` is a single connection"

    A `Database` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `Database` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for requests that run at the same time with transactions: open a `Database` for each one, which is another connection to the same file.

## Using a single connection

Every statement runs on the database object you give the query runner.

```ts
import { Database } from 'sqlite3';
import { Sqlite3QueryRunner } from "ts-sql-query/queryRunners/Sqlite3QueryRunner";

const db = new Database('./database.sqlite');

async function main() {
    const connection = new DBConnection(new Sqlite3QueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## Large integers

The driver reads every integer as a JavaScript number and has no option to read it exactly. An integer out of JavaScript's safe range comes back rounded, and `ts-sql-query` rejects it with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` instead of returning a wrong value.

## sqlite3 and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension`, which needs the SQL functions of the [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c). This driver can't register functions written in JavaScript: load the compiled extension with `db.loadExtension(...)`, or use the `string` strategy.

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { Database } from 'sqlite3';
import { Sqlite3QueryRunner } from "ts-sql-query/queryRunners/Sqlite3QueryRunner";

const db = new Database('./database.sqlite');

async function main() {
    const connection = new DBConnection(new Sqlite3QueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```
