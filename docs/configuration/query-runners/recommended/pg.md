---
search:
  boost: 0.577
---
# pg

This page explains how to use `ts-sql-query` with the [pg](https://www.npmjs.com/package/pg) driver. It covers two approaches: using a connection pool or using a single connection directly.

!!! success "Supported databases"

    - [PostgreSQL](../../supported-databases/postgresql.md)

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a connection pool

Executes queries through a [pg](https://www.npmjs.com/package/pg) connection obtained from a pool.

```ts
import { Pool, PoolClient } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    // Do your queries here
}
```

!!! warning

    If you want to allow to have nested transactions you must create the instance as `new PgPoolQueryRunner(pool, {allowNestedTransactions: true})` 

## Using a single connection

Executes queries through a dedicated [pg](https://www.npmjs.com/package/pg) connection.

```ts
import { Pool, PoolClient } from 'pg';
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

const pool = new Pool({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const pgConnection = await pool.connect();
    try {
        const connection = new DBConnection(new PgQueryRunner(pgConnection));
        // Do your queries here
    } finally {
        pgConnection.release();
    }
}
```

!!! warning

    If you want to allow to have nested transactions you must create the instance as `new PgQueryRunner(pgConnection, {allowNestedTransactions: true})` 
