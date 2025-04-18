---
search:
  boost: 0.577
---
# postgres

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

It allows to execute the queries using a [postgres](https://github.com/porsager/postgres) (aka Postgres.js) connection.

**Supported databases**: postgreSql

```ts
import * as postgres from 'postgres';
import { PostgresQueryRunner } from '../queryRunners/PostgresQueryRunner';

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
}
```

!!! warning "Limitation"

    Low-level transaction management functions (`connection.beginTransaction`, `connection.commit`, `connection.rollback`) are not supported; you must use `connection.transaction` instead.

!!! info

    Be aware postgres.js is pooled automatically; you don't need additional steps to use a connection pool.
