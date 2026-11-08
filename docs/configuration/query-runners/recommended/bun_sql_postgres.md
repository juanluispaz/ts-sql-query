---
search:
  boost: 0.577
---
<!-- doc-code-template: postgresql -->
# Bun SQL for PostgreSQL

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver, allowing `ts-sql-query` to execute queries on [PostgreSQL](../../supported-databases/postgresql.md) databases.

!!! success "Supported databases"

    - [PostgreSQL](../../supported-databases/postgresql.md)

!!! info "Tested with"

    The built-in Bun SQL driver, on **Bun**.

    This information reflects the runtimes the test suite runs it on against a real database.

!!! info "Requirements"

    Bun 1.4.4 or newer.

!!! warning "Do not share connections between requests"

    Create the `SQL` object once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool

The `SQL` object is a pool of connections: give it to the query runner, and each statement takes a connection from it. In a transaction, every statement runs on the same connection until the transaction ends.

It must use the PostgreSQL adapter: with another one, the constructor of the query runner throws a `TsSqlProcessingError` with reason `INVALID_CONFIGURATION`.

```ts
import { SQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/queryRunners/BunSqlPostgresQueryRunner";

const sql = new SQL({
    adapter: 'postgres',
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const connection = new DBConnection(new BunSqlPostgresQueryRunner(sql));
    // Do your queries here
    connection // ...
}
```

## Using a connection you reserved

The query runner can also be created with a connection you reserved from the pool: every statement and every transaction runs on it, and the query runner doesn't release it, you do.

```ts
import { SQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/queryRunners/BunSqlPostgresQueryRunner";

const sql = new SQL({ adapter: 'postgres' /* , configuration */ });

async function main() {
    const reserved = await sql.reserve();
    try {
        const connection = new DBConnection(new BunSqlPostgresQueryRunner(reserved));
        // Do your queries here
        connection // ...
    } finally {
        reserved.release();
    }
}
```

## Inside a transaction you began with Bun SQL

Created with the transaction object of `sql.begin(...)`, the query runner runs its statements in that transaction, which Bun SQL commits or rolls back when your function ends. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` are rejected with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { SQL, type TransactionSQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/queryRunners/BunSqlPostgresQueryRunner";

const sql = new SQL({ adapter: 'postgres' /* , configuration */ });

async function main() {
    await sql.begin(async (transaction: TransactionSQL) => {
        const connection = new DBConnection(new BunSqlPostgresQueryRunner(transaction));
        // Do your queries here, in the transaction
        connection // ...
    });
}
```

## A statement you run with Bun SQL itself

A statement that fails leaves a PostgreSQL transaction failed, even if its error is caught ([details](../../supported-databases/postgresql.md#a-statement-that-fails-inside-a-transaction)). `ts-sql-query` notices it for the statements it runs, but not for one you run with the connection of the transaction yourself (`connection.queryRunner.getCurrentNativeConnection()`): if that one fails and you catch its error, Bun SQL commits the transaction as if nothing had failed, and nothing of it is saved.

## The type of the parameters

Where PostgreSQL can't work out the type of a parameter, like a constant selected on its own, the query runner writes it as a cast in the SQL, `$1::int4`, from [the category of its type](../../column-types.md#how-a-value-is-sent-to-the-database): Bun SQL can't send a parameter with its type. The second argument of `BunSqlPostgresQueryRunner`, optional, is an object of type `BunSqlPostgresQueryRunnerConfig`, exported from `ts-sql-query/queryRunners/BunSqlPostgresQueryRunner`, with one option, `typesByName`: it maps the name of a type, the one you give a custom type or a built-in one like `'int'`, to the cast written instead, for example `numeric` for an exact decimal kept as text:

```ts
import { SQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/queryRunners/BunSqlPostgresQueryRunner";

const sql = new SQL({ adapter: 'postgres' /* , configuration */ });

async function main() {
    const connection = new DBConnection(new BunSqlPostgresQueryRunner(sql, { typesByName: { ExactDecimal: 'numeric' } }));
    // A parameter of the type ExactDecimal, where the query needs a type: $1::numeric
    connection // ...
}
```

The cast is written only where the query needs a type, as without the option; elsewhere, like compared with a column, the parameter goes as `$1` and the column gives it its type.
