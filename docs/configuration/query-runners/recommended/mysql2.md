---
search:
  boost: 0.577
---
<!-- doc-code-template: mysql -->
# mysql2

This page explains how to use `ts-sql-query` with the [mysql2](https://www.npmjs.com/package/mysql2) driver. It covers two approaches: using a connection pool or using a single connection directly.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)

!!! info "Tested with"

    [mysql2](https://www.npmjs.com/package/mysql2) `^3.24.6` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    Create the pool once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool

For each statement the query runner takes a connection from the pool and gives it back. In a transaction it keeps one connection until the transaction ends.

The query runner uses the callback API of the driver: create the pool with `mysql2`, not with `mysql2/promise`.

```ts
import { createPool } from "mysql2";
import { MySql2PoolQueryRunner } from "ts-sql-query/queryRunners/MySql2PoolQueryRunner";

const pool = createPool({
  host: 'localhost',
  user: 'user',
  password: 'secret',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function main() {
    const connection = new DBConnection(new MySql2PoolQueryRunner(pool));
    // Do your queries here
    connection // ...
}
```

## Using a single connection

Every statement runs on the connection you give the query runner: one taken from a pool, as here, or one you created. You release or close it, the query runner doesn't.

```ts
import { createPool } from "mysql2";
import { MySql2QueryRunner } from "ts-sql-query/queryRunners/MySql2QueryRunner";

const pool = createPool({
  host: 'localhost',
  user: 'user',
  password: 'secret',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function main() {
    pool.getConnection((error, mysql2Connection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConnection(new MySql2QueryRunner(mysql2Connection));
            doYourLogic(connection).finally(() => {
                mysql2Connection.release();
            });
        } catch(e) {
            mysql2Connection.release();
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConnection) {
    // Do your queries here
    connection // ...
}
```

## Large integers

If your queries may return integers larger than JavaScript's safe integer range — a `bigint` column, or arithmetic that grows past `Number.MAX_SAFE_INTEGER` (`9_007_199_254_740_991`) — enable `supportBigNumbers` in the connection configuration:

```ts
const pool = createPool({
    // ... the rest of your configuration
    supportBigNumbers: true
});
```

Without it the driver reads every integer as a JavaScript `number`, so an out-of-range value comes back rounded; ts-sql-query rejects that rounded number with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` rather than hand back a silently-wrong value. With it, the driver hands those values over as strings and ts-sql-query converts them to the type the column declares (`bigint` stays exact, `int` raises `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` if the exact value doesn't fit — read it as `bigint`). Values within the safe range keep coming back as `number`, so nothing else changes.

Add `bigNumberStrings: true` as well only if you want *every* integer as a string, not just the out-of-range ones.

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`. Without the option, the `START TRANSACTION` of that inner transaction would commit the outer one.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import type { Connection } from 'mysql2';
import { MySql2QueryRunner } from "ts-sql-query/queryRunners/MySql2QueryRunner";

async function main(mysql2Connection: Connection) {
    const connection = new DBConnection(new MySql2QueryRunner(mysql2Connection, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Options of the query runner

The second argument of `MySql2QueryRunner`, optional, is the name of the database or an object of type `MySql2QueryRunnerConfig`, exported from `ts-sql-query/queryRunners/MySql2QueryRunner`:

- **`database`**: the database to write the SQL for, `'mariaDB'` or `'mySql'`. A connection sets it to its own database when you create it, so you only need it to use the query runner without a connection.
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).

`MySql2PoolQueryRunner` receives only the name of the database as its second argument, `'mySql'` by default.
