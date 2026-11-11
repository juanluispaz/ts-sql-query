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
    | **Node 22.16 or newer** | Nothing |
    | **Node 22.13 to 22.15** | Nothing, but `DatabaseSync.aggregate()` isn't there, so [`registerSqliteFunctions`](#the-sql-functions-of-the-library) throws `INVALID_CONFIGURATION`; the queries that don't need its functions work |
    | **Node 22.5 to 22.12** | Launch Node with `--experimental-sqlite`. `DatabaseSync.function()` and `aggregate()` aren't there, so [`registerSqliteFunctions`](#the-sql-functions-of-the-library) throws `INVALID_CONFIGURATION`; the queries that don't need its functions work |
    | **Bun 1.4 or newer** | Nothing: it has its own implementation, with `function()` and `aggregate()` |

    To launch with the flag: `node --experimental-sqlite app.js`, or `NODE_OPTIONS=--experimental-sqlite tsx app.ts`. From Node 22.13 the flag isn't needed. Node 22 and 24 write a warning that the module is experimental; Node 26 doesn't.

!!! tip

    node:sqlite `DatabaseSync` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "A `DatabaseSync` is a single connection"

    A `DatabaseSync` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `DatabaseSync` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for requests that run at the same time with transactions: open a `DatabaseSync` for each one, which is another connection to the same file.

## Using a single connection

Every statement runs on the database object you give the query runner.

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/sqlite/node-sqlite";

const db = new DatabaseSync('foobar.db', options);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## Connection requirements

**Not applied to the queries of the library**: `returnArrays`. Each statement of the query runner gives its rows as objects; your own statements keep the option of the database.

## Large integers

By default, `node:sqlite` reads integers as JavaScript numbers and fails when one is outside JavaScript's safe integer range: the query rejects with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`. If your queries may return larger integers, create the database with `new DatabaseSync('foobar.db', { readBigInts: true })`, where your runtime has that option (Node 24.4 or newer). Every integer then arrives as a `BigInt`, and `ts-sql-query` converts it to the type the column declares: an `int` column still gives a `number`.

## The SQL functions of the library

Some settings of the connection make the library write SQL functions that SQLite doesn't have built in: the [uuid strategy](../../supported-databases/sqlite.md#uuid-strategies) `uuid-extension` (the default) writes `uuid`, `uuid_str` and `uuid_blob`; the [decimal strategies](../../supported-databases/sqlite.md#exact-decimals-the-decimal-strategies) with functions, which make a [`customDecimal`](../../column-types.md#exact-decimals) exact, write the functions of SQLite's decimal extension and the library's own `tsq_` ones; and [`replaceAllInsensitiveFunction = 'ci_replace'`](../../collations.md#sqlite-register-a-udf-or-accept-the-case-sensitive-fallback) writes `ci_replace`. A query that uses one that isn't registered fails with `no such function`. `registerSqliteFunctions` registers all of them on the database, written in JavaScript:

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/sqlite/node-sqlite";
import { registerSqliteFunctions } from "ts-sql-query/sqlite/bun-sqlite";

const db = new DatabaseSync('foobar.db');
registerSqliteFunctions(db);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db));
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

It needs the `function` and `aggregate` methods of node:sqlite, which Node has since 22.16; on an older Node, `registerSqliteFunctions` throws `INVALID_CONFIGURATION`.

For SQLite's own extensions written in C, how to compile and load them, and which function each setting needs, see [SQLite functions and extensions](../../supported-databases/sqlite-extensions.md).

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/sqlite/node-sqlite";

const db = new DatabaseSync('foobar.db', options);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Options of the query runner

The second argument of `NodeSqliteQueryRunner`, optional, is an object of type `NodeSqliteQueryRunnerConfig`, exported from `ts-sql-query/sqlite/node-sqlite`:

- **`promise`**: another `Promise` provider, for [synchronous query execution](../../../advanced/synchronous-query-runners.md).
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).
