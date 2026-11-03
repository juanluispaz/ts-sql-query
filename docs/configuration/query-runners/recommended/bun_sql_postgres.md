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

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a connection pool

Executes queries through a [Bun SQL](https://bun.com/docs/runtime/sql) connection configured with the PostgreSQL adapter.

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

!!! warning "A statement you run with Bun SQL itself"

    A statement that fails leaves a PostgreSQL transaction failed, even if its error is caught ([details](../../supported-databases/postgresql.md#a-statement-that-fails-inside-a-transaction)). `ts-sql-query` notices it for the statements it runs, but not for one you run with the connection of the transaction yourself (`connection.queryRunner.getCurrentNativeConnection()`): if that one fails and you catch its error, Bun SQL commits the transaction as if nothing had failed, and nothing of it is saved.

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
