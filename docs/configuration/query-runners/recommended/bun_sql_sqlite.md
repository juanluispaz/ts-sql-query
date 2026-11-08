---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# Bun SQL for SQLite

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver configured with the SQLite adapter, allowing `ts-sql-query` to execute queries on [SQLite](../../supported-databases/sqlite.md) databases.

!!! danger "On Bun, prefer bun:sqlite for SQLite"

    Bun SQL for SQLite can't register functions written in JavaScript nor load an extension of SQLite. So with it:

    - The exact decimals ([`stringDecimal` and `customDecimal`](../../column-types.md#exact-decimals)) have no arithmetic, sums nor roundings: the [decimal strategies](../../supported-databases/sqlite.md#exact-decimals-the-decimal-strategies) with functions, the default included, need functions it can't register.
    - The [uuid strategy](../../supported-databases/sqlite.md#uuid-strategies) `uuid-extension`, the default, works only where the SQLite that Bun uses has the uuid extension built in, like the one of macOS (measured with SQLite 3.51.0).
    - `replaceAllInsensitiveFunction` can't be used.

    [bun:sqlite](bun_sqlite.md) (`BunSqliteQueryRunner`) has none of these limits: one call of `registerSqliteFunctions` registers every function the library writes. If you stay with Bun SQL, set the decimal strategy to `canonical text`: it compares, orders and groups a `customDecimal` exactly, and rejects its arithmetic when the query is built (`UNSUPPORTED_QUERY`), so nothing gives a number that has lost digits. On a system whose SQLite lacks the uuid extension, set the uuid strategy to `string`.

    Which function each setting needs is on [SQLite functions and extensions](../../supported-databases/sqlite-extensions.md).

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    The built-in Bun SQL driver, on **Bun**.

    This information reflects the runtimes the test suite runs it on against a real database.

!!! info "Requirements"

    Bun 1.4.4 or newer.

!!! warning "An `SQL` object is a single connection here"

    With the SQLite adapter, an `SQL` object is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `SQL` object are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for requests that run at the same time with transactions: open an `SQL` object for each one, which is another connection to the same file.

## Using a Bun SQL SQLite connection

Every statement runs on the `SQL` object you give the query runner. It must be created with `adapter: 'sqlite'`: with another one, the constructor of the query runner throws a `TsSqlProcessingError` with reason `INVALID_CONFIGURATION`.

```ts
import { SQL } from "bun";
import { BunSqlSqliteQueryRunner } from "ts-sql-query/queryRunners/BunSqlSqliteQueryRunner";

const sql = new SQL({
    adapter: 'sqlite',
    filename: './foobar.db',
});

async function main() {
    const connection = new DBConnection(new BunSqlSqliteQueryRunner(sql));
    // Do your queries here
    connection // ...
}
```

## Large integers

If your queries may return integers larger than JavaScript's safe integer range, create the connection with `new SQL({ adapter: 'sqlite', filename: './foobar.db', safeIntegers: true })`. Without it an out-of-range value comes back rounded, and `ts-sql-query` rejects it with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` instead of returning a wrong value. With it, every integer arrives as a `BigInt`, and `ts-sql-query` converts it to the type the column declares: an `int` column still gives a `number`.

## SQLite and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension`, which needs the SQL functions `uuid`, `uuid_str` and `uuid_blob` of the [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c). Bun SQL can't register them: they are there only if the SQLite that Bun uses has them built in, like the one of macOS. Otherwise use the `string` strategy.

## SQLite and exact decimals

Bun SQL can't register the functions the [decimal strategies](../../supported-databases/sqlite.md#exact-decimals-the-decimal-strategies) with functions write, the default included: use the `canonical text` strategy, which compares, orders and groups a [`customDecimal`](../../column-types.md#exact-decimals) exactly and rejects its arithmetic, or [bun:sqlite](bun_sqlite.md).

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override decimalStrategy = 'canonical text' as const
}
```

## Inside a transaction you began with Bun SQL

Created with the transaction object of `sql.begin(...)`, the query runner runs its statements in that transaction, which Bun SQL commits or rolls back when your function ends. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` are rejected with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { SQL, type TransactionSQL } from "bun";
import { BunSqlSqliteQueryRunner } from "ts-sql-query/queryRunners/BunSqlSqliteQueryRunner";

const sql = new SQL({ adapter: 'sqlite', filename: './foobar.db' });

async function main() {
    await sql.begin(async (transaction: TransactionSQL) => {
        const connection = new DBConnection(new BunSqlSqliteQueryRunner(transaction));
        // Do your queries here, in the transaction
        connection // ...
    });
}
```
