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
import { PostgresQueryRunner } from 'ts-sql-query/postgresql/postgres';

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
import { PostgresQueryRunner } from 'ts-sql-query/postgresql/postgres';

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

## Connection requirements

**Rejected** when the query runner is created, with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION`; `name` says which:

- **A `transform` of the results**: `transform: postgres.camel`, `postgres.toCamel`, or a `column.from`, `value.from` or `row.from` of your own. The library reads each column by its name, with its value as the database gives it, and a transform of the client can't be turned off for one query. A transform of what is sent only, like `postgres.fromCamel` or `transform: { undefined: null }`, is accepted.
- **`infer: true`**, when the process doesn't run in UTC: with it postgres.js reads a `timestamp` in the zone of the process. In a process in UTC it's accepted. How the query runner knows the zone of the process is in [Time zones](../../time-zones.md#the-applications-zone).

**Rejected at the first query**, with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION` and `name` `'connection'`, before anything is sent: **a session `TimeZone` other than the zone of the database**, the `databaseTimeZone` of the connection (`'UTC'` by default), in `connection: { TimeZone: … }` (the name in any case), in a `-c TimeZone=…` of `connection.options`, or as `?TimeZone=…` in the URL. The session must be in the zone of the database: in another, what the database computes (`now()`, `current_date`, a default) comes in that zone. With the database in UTC, `UTC`, another name of UTC and `+00:00` are accepted; with another zone, that same name. The check is made at each query, which carries the configuration of the connection. If your database isn't in UTC, declare its zone (see [A database outside UTC](../../time-zones.md#a-database-outside-utc)) instead of moving the session to UTC.

**Required and not checked**: the zone of the database declared in `databaseTimeZone` (UTC by default), and the session `TimeZone` left in it. postgres.js sets none unless you give it one; a `SET TIME ZONE` of yours isn't seen by the check. See [Time zones](../../time-zones.md#the-zone-of-the-database-and-the-session).

The query runner reads the options of the `sql` object: a connection you reserved or a transaction doesn't give them, so create the query runner from `sql` to have them checked.

## Inside a transaction you began with postgres.js

Created with the transaction object of `sql.begin(...)`, the query runner runs its statements in that transaction, which postgres.js commits or rolls back when your function ends. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` are rejected with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import postgres from 'postgres'
import { PostgresQueryRunner } from 'ts-sql-query/postgresql/postgres';

const sql = postgres(/* configuration */);

async function main() {
    await sql.begin(async (transaction) => {
        const connection = new DBConnection(new PostgresQueryRunner(transaction));
        // Do your queries here, in the transaction
        connection // ...
    });
}
```

## The type of the parameters

Where PostgreSQL can't work out the type of a parameter, like a constant selected on its own, the query runner sends the parameter with the type of [the category of its type](../../column-types.md#how-a-value-is-sent-to-the-database), and the SQL has no cast: `select $1 as result`, with the parameter sent as an `int4`.

The second argument of `PostgresQueryRunner`, optional, is an object of type `PostgresQueryRunnerConfig`, exported from `ts-sql-query/postgresql/postgres`, with one option, `typesByName`. It maps the name of a type, the one you give a custom type or a built-in one like `'int'`, to the type every parameter of that name is sent with, wherever it is written: the oid of a PostgreSQL type, like `1700` for `numeric`, or a function that gives the parameter, like `value => sql.typed.money(value)` for a type declared in the `types` option of postgres.js.

```ts
import postgres from 'postgres'
import { PostgresQueryRunner } from 'ts-sql-query/postgresql/postgres';

const sql = postgres(/* configuration */);

async function main() {
    // 1700 is the oid of numeric: an exact decimal kept as text keeps every digit
    const connection = new DBConnection(new PostgresQueryRunner(sql, { typesByName: { ExactDecimal: 1700 } }));
    connection // ...
}
```

An error thrown by a function of `typesByName` rejects the query, and nothing is sent.
