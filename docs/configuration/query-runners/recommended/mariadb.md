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

    Create the pool once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool

For each statement the query runner takes a connection from the pool and gives it back. In a transaction it keeps one connection until the transaction ends.

The query runner uses the promise API of the driver: create the pool with `mariadb`, not with `mariadb/callback`.

```ts
import { createPool } from "mariadb";
import { MariaDBPoolQueryRunner } from "ts-sql-query/mariadb/mariadb";

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

Every statement runs on the connection you give the query runner: one taken from a pool, as here, or one you created. You release or close it, the query runner doesn't.

```ts
import { createPool } from "mariadb";
import { MariaDBQueryRunner } from "ts-sql-query/mariadb/mariadb";

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

## Connection requirements

Nothing is rejected: the query runner gives each of its queries the options it needs, which replace those of the connection or the pool for that query. Your own queries through `mariadb` keep yours.

**Not applied to the queries of the library**: `typeCast`, `rowsAsArray`, `metaAsArray`, `nestTables`, `decimalAsNumber`, `bigIntAsNumber`, `insertIdAsNumber` and `dateStrings`. A date or a time is read with its digits as UTC, whatever the zone of the process; a `BIGINT`, a `DECIMAL` and the id of an inserted row arrive with all their digits; the rows are objects with a property per column; and a `typeCast` of yours isn't called.

So large integers need nothing: a `bigint` column is exact, and an `int` column with a value past `Number.MAX_SAFE_INTEGER` is rejected with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` rather than rounded; read it as `bigint`.

**Required and not checked**: the server's `time_zone` in UTC, which is the zone of the database, and the session left in it: a `TIMESTAMP` column and `now()` follow the session. mariadb sets no session zone unless you give it `timezone`; don't give it one other than the zone of the database. The query runner can't read the configuration of the connection, nor the zones without a query of its own. See [Time zones](../../time-zones.md#the-zone-of-the-database-and-the-session).

A date outside the calendar, that the SQL mode `ALLOW_INVALID_DATES` keeps, or a zero date, kept without `NO_ZERO_DATE`, is rejected when it's read: see [Time zones → Known limits](../../time-zones.md#known-limits).

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`. Without the option, the `START TRANSACTION` of that inner transaction would commit the outer one.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import type { Connection } from 'mariadb';
import { MariaDBQueryRunner } from "ts-sql-query/mariadb/mariadb";

async function main(mariaDBConnection: Connection) {
    const connection = new DBConnection(new MariaDBQueryRunner(mariaDBConnection, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Options of the query runner

The second argument of `MariaDBQueryRunner`, optional, is the name of the database or an object of type `MariaDBQueryRunnerConfig`, exported from `ts-sql-query/mariadb/mariadb`:

- **`database`**: the database to write the SQL for, `'mariaDB'` or `'mySql'`. A connection sets it to its own database when you create it, so you only need it to use the query runner without a connection.
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).

`MariaDBPoolQueryRunner` receives only the name of the database as its second argument, `'mariaDB'` by default.
