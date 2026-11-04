---
search:
  boost: 0.577
---
<!-- doc-code-template: mariadb -->
# mariadb

This page explains how to use `ts-sql-query` with the [mariadb](https://www.npmjs.com/package/mariadb) driver. It covers two approaches: using a connection pool or using a single connection directly.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)

!!! info "Tested with"

    [mariadb](https://www.npmjs.com/package/mariadb) `^3.5.4` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a connection pool

Enables executing queries through a [mariadb](https://www.npmjs.com/package/mariadb) connection obtained from a pool.

```ts
import { createPool } from "mariadb";
import { MariaDBPoolQueryRunner } from "ts-sql-query/queryRunners/MariaDBPoolQueryRunner";

const pool = createPool({
    host: 'mydb.com', 
    user: 'myUser', 
    password: 'myPwd',
    database: 'myDB',
    connectionLimit: 5
});

async function main() {
    const connection = new DBConnection(new MariaDBPoolQueryRunner(pool));
    // Do your queries here
    connection // ...
}
```

## Using a single connection

Enables executing queries through a dedicated [mariadb](https://www.npmjs.com/package/mariadb) connection.

```ts
import { createPool } from "mariadb";
import { MariaDBQueryRunner } from "ts-sql-query/queryRunners/MariaDBQueryRunner";

const pool = createPool({
    host: 'mydb.com', 
    user: 'myUser', 
    password: 'myPwd',
    database: 'myDB',
    connectionLimit: 5
});

async function main() {
    const mariaDBConnection = await pool.getConnection();
    try {
        const connection = new DBConnection(new MariaDBQueryRunner(mariaDBConnection));
        // Do your queries here
        connection // ...
    } finally {
        mariaDBConnection.release();
    }
}
```

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`. Without the option, the `START TRANSACTION` of that inner transaction would commit the outer one.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import type { Connection } from 'mariadb';
import { MariaDBQueryRunner } from "ts-sql-query/queryRunners/MariaDBQueryRunner";

async function main(mariaDBConnection: Connection) {
    const connection = new DBConnection(new MariaDBQueryRunner(mariaDBConnection, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```
