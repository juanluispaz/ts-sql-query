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

    [postgres](https://www.npmjs.com/package/postgres) `^4.1.0` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    Create the `sql` object of the driver once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool

The `sql` object of postgres.js is a pool of connections: give it to the query runner, and each statement takes a connection from it. In a transaction, every statement runs on the same connection until the transaction ends.

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

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

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
