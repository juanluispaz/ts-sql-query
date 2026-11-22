---
search:
  boost: 0.577
---
<!-- doc-code-template: postgresql -->
# postgres

This page explains how to use `ts-sql-query` with the [postgres.js](https://github.com/porsager/postgres) driver.

!!! success "Supported databases"

    - [PostgreSQL](../index.md)

!!! info "Tested with"

    [postgres](https://www.npmjs.com/package/postgres) `^4.1.0` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    Create the `sql` object of the driver once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../../configuration/connection.md#instantiating-the-connection-with-the-database-connection).

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
- **`infer: true`**, when the process doesn't run in UTC: with it postgres.js reads a `timestamp` in the zone of the process. In a process in UTC it's accepted. How the query runner knows the zone of the process is in [Time zones](../../../configuration/time-zones.md#the-applications-zone).

**Rejected at the first query**, with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION` and `name` `'connection'`, before anything is sent: **a session `TimeZone` other than the zone of the database**, the `databaseTimeZone` of the connection (`'UTC'` by default), in `connection: { TimeZone: … }` (the name in any case), in a `-c TimeZone=…` of `connection.options`, or as `?TimeZone=…` in the URL. The session must be in the zone of the database: in another, what the database computes (`now()`, `current_date`, a default) comes in that zone. With the database in UTC, `UTC`, another name of UTC and `+00:00` are accepted; with another zone, that same name. The check is made at each query, which carries the configuration of the connection. If your database isn't in UTC, declare its zone (see [A database outside UTC](../../../advanced/dates-and-times/outside-utc.md#a-database-outside-utc)) instead of moving the session to UTC.

**Required and not checked**: the zone of the database declared in `databaseTimeZone` (UTC by default), and the session `TimeZone` left in it. postgres.js sets none unless you give it one; a `SET TIME ZONE` of yours isn't seen by the check. See [Time zones](../../../advanced/dates-and-times/column-kinds-and-session.md#the-zone-of-the-database-and-the-session).

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

Where PostgreSQL can't work out the type of a parameter, like a constant selected on its own, the query runner sends the parameter with [the type requested for it](../../../advanced/data-types/sql-data-types.md#how-a-value-is-sent-to-the-database), and the SQL has no cast: `select $1 as result`, with the parameter sent as an `int4`.

The type of a parameter comes from its [SQL data type](../../../advanced/data-types/sql-data-types.md), but only a type with an oid fixed in every database, like `numeric` (`1700`) or `jsonb`: an enum of the database or a type of an extension has an oid of its own in each database, and its parameter goes without a type. The second argument of `PostgresQueryRunner`, optional, is an object of type `PostgresQueryRunnerConfig`, exported from `ts-sql-query/postgresql/postgres`, with one option, `driverTypeOf`: a function that receives what the library knows of each parameter (its type, its SQL data type, …, the same as [the context of the query](../../../advanced/running-queries/query-execution-metadata.md#get-the-type-of-each-parameter)) and its value, and gives the oid it is sent with, or the parameter itself, like `sql.typed(value, oid)` or a type declared in the `types` option of postgres.js. The parameter is then sent with that type wherever it is written; with `undefined`, as the library does.

```ts
import postgres from 'postgres'
import { EnumType } from "ts-sql-query";
import { PostgresQueryRunner } from 'ts-sql-query/postgresql/postgres';

type Feeling = 'happy' | 'sad'

abstract class FeelingType extends EnumType<Feeling, 'Feeling'> {
    static override readonly type = 'Feeling'
}

const sql = postgres(/* configuration */);

async function main() {
    // create type feeling as enum ('happy', 'sad'): its oid is the one of this database
    const rows = await sql`select oid from pg_type where typname = 'feeling'`
    const oid = Number(rows[0]!['oid'])
    const connection = new DBConnection(new PostgresQueryRunner(sql, {
        driverTypeOf: (param) => param.requestedType === FeelingType ? oid : undefined
    }));
    connection // ...
}
```

An error thrown by `driverTypeOf` rejects the query, and nothing is sent.
