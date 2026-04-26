---
search:
  boost: 0.577
---
# pglite

This page explains how to use `ts-sql-query` with the [pglite](https://www.npmjs.com/package/@electric-sql/pglite) driver for local [PostgreSQL](../../supported-databases/postgresql.md) databases.

!!! success "Supported databases"

    - [PostgreSQL](../../supported-databases/postgresql.md)

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Executes queries through a dedicated [PgLite](https://www.npmjs.com/package/@electric-sql/pglite) connection.

```ts
import { PGlite } from '@electric-sql/pglite'
import { PgLiteQueryRunner } from 'ts-sql-query/queryRunners/PgLiteQueryRunner'

const db = await PGlite.create('memory://')

async function main() {
    const connection = new DBConnection(new PgLiteQueryRunner(db));
    // Do your queries here
}
```
