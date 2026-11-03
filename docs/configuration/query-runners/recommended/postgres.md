---
search:
  boost: 0.577
---
<!-- doc-code-template: postgresql -->
# postgres

This page explains how to use `ts-sql-query` with the [postgres.js](https://github.com/porsager/postgres) driver.

!!! success "Supported databases"

    - [PostgreSQL](../../supported-databases/postgresql.md)

!!! info "Tested with"

    [postgres](https://www.npmjs.com/package/postgres) `^3.4.9` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a connection pool

Executes queries through a [postgres.js](https://github.com/porsager/postgres) connection obtained from a pool.

```ts
import postgres from 'postgres'
import { PostgresQueryRunner } from 'ts-sql-query/queryRunners/PostgresQueryRunner';

const sql = postgres({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const connection = new DBConnection(new PostgresQueryRunner(sql));
    // Do your queries here
    connection // ...
}
```

## Using a connection you reserved

The query runner can also be created with a connection you reserved from the pool: every statement and every transaction runs on it, and the query runner doesn't release it, you do.

```ts
import postgres from 'postgres'
import { PostgresQueryRunner } from 'ts-sql-query/queryRunners/PostgresQueryRunner';

const sql = postgres(/* configuration */);

async function main() {
    const reserved = await sql.reserve();
    try {
        const connection = new DBConnection(new PostgresQueryRunner(reserved));
        // Do your queries here
        connection // ...
    } finally {
        reserved.release();
    }
}
```

## Inside a transaction you began with postgres.js

Created with the transaction object of `sql.begin(...)`, the query runner runs its statements in that transaction, which postgres.js commits or rolls back when your function ends. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` are rejected with `NESTED_TRANSACTION_NOT_SUPPORTED`.

```ts
import postgres from 'postgres'
import { PostgresQueryRunner } from 'ts-sql-query/queryRunners/PostgresQueryRunner';

const sql = postgres(/* configuration */);

async function main() {
    await sql.begin(async (transaction) => {
        const connection = new DBConnection(new PostgresQueryRunner(transaction));
        // Do your queries here, in the transaction
        connection // ...
    });
}
```
