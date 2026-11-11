---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# better-sqlite3

This runner provides integration with the [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) driver, allowing `ts-sql-query` to execute queries on SQLite databases. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) `^13.0.3` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! tip

    better-sqlite3 supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "A `Database` is a single connection"

    A `Database` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `Database` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for requests that run at the same time with transactions: open a `Database` for each one, which is another connection to the same file.

## Using a single connection

Every statement runs on the database object you give the query runner.

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/sqlite/better-sqlite3";
import Database from "better-sqlite3";

const db = new Database('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BetterSqlite3QueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## Large integers

If your queries may return integers larger than JavaScript's safe integer range, call `db.defaultSafeIntegers()` on the database. Without it an out-of-range value comes back rounded, and `ts-sql-query` rejects it with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` instead of returning a wrong value. With it, every integer arrives as a `BigInt`, and `ts-sql-query` converts it to the type the column declares: an `int` column still gives a `number`.

## The SQL functions of the library

Some settings of the connection make the library write SQL functions that SQLite doesn't have built in: the [uuid strategy](../../supported-databases/sqlite.md#uuid-strategies) `uuid-extension` (the default) writes `uuid`, `uuid_str` and `uuid_blob`; the [decimal strategies](../../supported-databases/sqlite.md#exact-decimals-the-decimal-strategies) with functions, which make a [`customDecimal`](../../column-types.md#exact-decimals) exact, write the functions of SQLite's decimal extension and the library's own `tsq_` ones; and [`replaceAllInsensitiveFunction = 'ci_replace'`](../../collations.md#sqlite-register-a-udf-or-accept-the-case-sensitive-fallback) writes `ci_replace`. A query that uses one that isn't registered fails with `no such function`. `registerSqliteFunctions` registers all of them on the database, written in JavaScript:

```ts
import Database from "better-sqlite3";
import { BetterSqlite3QueryRunner } from "ts-sql-query/sqlite/better-sqlite3";
import { registerSqliteFunctions } from "ts-sql-query/sqlite/bun-sqlite";

const db = new Database('foobar.db', options);
registerSqliteFunctions(db);

async function main() {
    const connection = new DBConnection(new BetterSqlite3QueryRunner(db));
    // Do your queries here
    connection // ...
}
```

- `uuid()` generates a [version 7 UUID](https://www.rfc-editor.org/rfc/rfc9562#name-uuid-version-7), whose text starts with the time it was generated, so a value generated in a later millisecond sorts after the older ones. The values generated in the same millisecond keep their order too. On Bun it is `Bun.randomUUIDv7()`, which keeps it; everywhere else the library generates it. Node's `randomUUIDv7()` of `node:crypto` isn't used: about half of 100,000 UUIDs it generated in a row came out of order (measured on Node 26.1). `uuid_blob` gives the 16 bytes of the UUID in the order of its text, and `uuid_str` the text of a blob; they take the same forms and give the same results as SQLite's [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c). The blob of a version 7 UUID sorts by time too, so new rows go at the end of the primary-key index.
- Every function but `uuid()` is registered as deterministic, so SQLite takes it in an [index on an expression](../../supported-databases/sqlite.md#an-index-on-the-key-of-a-decimal).
- `decimal_sum` is also a window function (`over (...)`).
- A decimal function or a `ci_replace` the database already has with the same name and number of arguments is left as it is: one of a loaded extension, like SQLite's decimal extension, written in C, or one you registered before the call. `registerSqliteFunctions` reads the functions of the database once, with `pragma function_list`, when you call it, and registers only the missing ones; none of your queries sends anything more.
- `uuid`, `uuid_str` and `uuid_blob` are always registered, replacing the ones the database has: some builds of SQLite have the uuid extension built in, like the one of macOS, which Bun uses there (measured with SQLite 3.51.0), and its `uuid()` generates version 4 UUIDs, which don't sort by time. To keep the ones the database has, name them in `skip`.
- `registerSqliteFunctions(db, { skip: ['uuid'] })` leaves out the functions you name, and keeps the one the database has, if it has one.

For SQLite's own extensions written in C, how to compile and load them, and which function each setting needs, see [SQLite functions and extensions](../../supported-databases/sqlite-extensions.md).

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/sqlite/better-sqlite3";
import Database from "better-sqlite3";

const db = new Database('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BetterSqlite3QueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Options of the query runner

The second argument of `BetterSqlite3QueryRunner`, optional, is an object of type `BetterSqlite3QueryRunnerConfig`, exported from `ts-sql-query/sqlite/better-sqlite3`:

- **`promise`**: another `Promise` provider, for [synchronous query execution](../../../advanced/synchronous-query-runners.md).
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).
