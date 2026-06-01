---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlserver -->
# mssql

This page explains how to use `ts-sql-query` with the [mssql](https://www.npmjs.com/package/mssql) driver. It covers two approaches: using a connection pool promise or using a connection pool.

!!! success "Supported databases"

    - [SQL Server](../../supported-databases/sqlserver.md)

!!! info "Tested with"

    [mssql](https://www.npmjs.com/package/mssql) `^12.5.0`

    This information reflects the driver version pinned in this project's `devDependencies` and exercised by the CI suite. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a connection pool promise

Enables executing queries through a [mssql](https://www.npmjs.com/package/mssql) connection obtained from a pool promise.

```ts
import mssql from 'mssql'
import { MssqlPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/MssqlPoolPromiseQueryRunner";

const { ConnectionPool } = mssql

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const connection = new DBConnection(new MssqlPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
    connection // ...
}
```

## Using a connection pool

Enables executing queries through a [mssql](https://www.npmjs.com/package/mssql) connection obtained from a pool.

```ts
import mssql from 'mssql'
import { MssqlPoolQueryRunner } from "ts-sql-query/queryRunners/MssqlPoolQueryRunner";

const { ConnectionPool } = mssql

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const mssqlPool = await poolPromise;
    const connection = new DBConnection(new MssqlPoolQueryRunner(mssqlPool));
    // Do your queries here
    connection // ...
}
```
