---
search:
  boost: 0.577
---
<!-- doc-code-template: postgresql -->
# pg

This page explains how to use `ts-sql-query` with the [pg](https://www.npmjs.com/package/pg) driver. It covers two approaches: using a connection pool or using a single connection directly.

!!! success "Supported databases"

    - [PostgreSQL](../../supported-databases/postgresql.md)

!!! info "Tested with"

    [pg](https://www.npmjs.com/package/pg) `^8.23.1` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    Create the pool once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool

For each statement the query runner takes a connection from the pool and gives it back. In a transaction it keeps one connection until the transaction ends.

```ts
import { Pool } from 'pg';
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
    connection // ...
}
```

## Using a single connection

Every statement runs on the connection you give the query runner: one taken from a pool, as here, or a `Client` you connected. You release or close it, the query runner doesn't.

```ts
import { Pool } from 'pg';
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
        connection // ...
    } finally {
        pgConnection.release();
    }
}
```

## Connection requirements

**Rejected** when the query runner is created, with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION`; `name` says which:

- **`binary: true`**, on the client or on the pool. In the binary mode `pg` reads a `numeric` wrong (`1.50` as `1.51`). With `pg.defaults.binary`, which the clients the pool opens take, `PgPoolQueryRunner` rejects each query, and gives the client back to the pool.
- **A session `TimeZone` other than UTC** in `options` (`-c TimeZone=…` or `--timezone=…`), given in the configuration, in the `options` of the connection string or in `PGOPTIONS`; `name` is `'options'`. The library takes the database as UTC, and the session must be in its zone: in another, what the database computes (`now()`, `current_date`, a default) comes in that zone. `UTC`, another name of UTC and `+00:00` are accepted. A pool is checked with the configuration you gave it; what it adds from the connection string or `PGOPTIONS` is seen in each client it opens, so `PgPoolQueryRunner` rejects the query and gives the client back to the pool. If your database isn't in UTC, don't move the session to UTC to pass the check: a database outside UTC isn't supported yet (see [Time zones](../../time-zones.md#the-zone-of-the-database-and-the-session)).

**Not applied to the queries of the library**: the parsers of `date` and `timestamp`, registered with `pg.types.setTypeParser`, `client.setTypeParser` or the `types` of a pool or client. The query runner reads those two types itself, with their digits as UTC, whatever the zone of the process. Your own queries through `pg` keep your parsers.

A parser you register for any other type still applies to the queries of the library: one that changes the value of a type the library reads, like a `numeric` turned into a JavaScript number, changes what the library receives.

**Required and not checked**: the database in UTC, and the session `TimeZone` left in it. pg sets none, so the session has the zone of the database; a `SET TIME ZONE` of yours isn't seen by the check. See [Time zones](../../time-zones.md#the-zone-of-the-database-and-the-session).

## Running a statement on each new connection

Some settings are properties of the **database session**, not of the query, like a statement timeout. To pin one without touching your schema, run the statement **once per connection**, when the pool opens it. Not the time zone: the session must stay in the zone of the database (see [Time zones](../../time-zones.md#the-zone-of-the-database-and-the-session)). The `pg` pool emits a `connect` event on each brand-new client for exactly this:

```ts
import { Pool } from 'pg';

const pool = new Pool({ /* … */ });

pool.on('connect', (client) => {
    // Runs once per newly created pooled connection.
    client.query("SET statement_timeout = '30s'");
});
```

This is what the [Time zones page](../../time-zones.md#the-databases-zone) recommends aligning on connect. PostgreSQL has **no session collation** (unlike Oracle), so a case-insensitive comparison is set on the column / database collation or per value with [`.collate()`](../../collations.md#collate-force-a-collation-per-value) instead — see the [Collations page](../../collations.md#on-the-connection-the-session-collation).

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`. Without the option, the commit of that inner transaction would end the outer one.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import type { PoolClient } from 'pg';
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

async function main(pgConnection: PoolClient) {
    const connection = new DBConnection(new PgQueryRunner(pgConnection, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Nested transactions

A transaction that begins inside another one is rejected. Both query runners accept the option `allowNestedTransactions`, which sends its `begin` and its `commit` or `rollback` to the database: `new PgPoolQueryRunner(pool, { allowNestedTransactions: true })` or `new PgQueryRunner(pgConnection, { allowNestedTransactions: true })`.

PostgreSQL doesn't nest them: see [what this option does](../../../queries/transaction.md#nested-transactions).

## The type of the parameters

Where PostgreSQL can't work out the type of a parameter, like a constant selected on its own, the query runner writes it as a cast in the SQL, `$1::int4`, from [the category of its type](../../column-types.md#how-a-value-is-sent-to-the-database): `pg` can't send a parameter with its type. The option `typesByName` maps the name of a type, the one you give a custom type or a built-in one like `'int'`, to the cast written instead, for example `numeric` for an exact decimal kept as text:

```ts
import { Pool } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool(/* configuration */);

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool, { typesByName: { ExactDecimal: 'numeric' } }));
    // A parameter of the type ExactDecimal, where the query needs a type: $1::numeric
    connection // ...
}
```

The cast is written only where the query needs a type, as without the option; elsewhere, like compared with a column, the parameter goes as `$1` and the column gives it its type.

## Options of the query runner

The second argument of the query runners, optional, is an object of options:

- `PgPoolQueryRunner` takes a `PgPoolQueryRunnerConfig`, exported from `ts-sql-query/queryRunners/PgPoolQueryRunner`, with **`allowNestedTransactions`** (see [Nested transactions](#nested-transactions)) and **`typesByName`** (see [The type of the parameters](#the-type-of-the-parameters)).
- `PgQueryRunner` takes a `PgQueryRunnerConfig`, exported from `ts-sql-query/queryRunners/PgQueryRunner`, with **`allowNestedTransactions`**, **`typesByName`** and **`forUseInTransaction`** (see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages)).
