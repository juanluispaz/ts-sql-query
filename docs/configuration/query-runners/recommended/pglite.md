---
search:
  boost: 0.577
---
<!-- doc-code-template: postgresql -->
# pglite

This page explains how to use `ts-sql-query` with the [pglite](https://www.npmjs.com/package/@electric-sql/pglite) driver for local [PostgreSQL](../../supported-databases/postgresql.md) databases.

!!! success "Supported databases"

    - [PostgreSQL](../../supported-databases/postgresql.md)

!!! info "Tested with"

    [@electric-sql/pglite](https://www.npmjs.com/package/@electric-sql/pglite) `^0.5.11` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! warning "A PGlite instance is a single connection"

    A PGlite instance has one session, as a single connection to a database server does: every query runner created over the same instance shares it, and shares its transaction. Two connection objects created over one instance are not isolated from each other (a rollback in one undoes what the other did in the same transaction), so an instance must be used by one connection object at a time, as any other dedicated connection.

## Using a single connection

Every statement runs on the session of the PGlite instance you give the query runner.

```ts
import { PGlite } from '@electric-sql/pglite'
import { PgLiteQueryRunner } from 'ts-sql-query/postgresql/pglite'

const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })

async function main() {
    const connection = new DBConnection(new PgLiteQueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## Connection requirements

Nothing is rejected.

**Not applied to the queries of the library**: the `parsers` of `date`, `time` and `timestamp` (oids 1082, 1083 and 1114) given to the database or to a query. The query runner gives its own for those types with each query, also on a transaction: the digits are read as UTC, whatever the zone of the process. Your own queries keep your parsers, and a parser of any other type still applies to the queries of the library.

**Keep the database in UTC.** PGlite runs inside the process: when it creates its database, it writes the zone of the process into the configuration of that database, as a fixed offset (`Etc/GMT-9` in `Asia/Tokyo`, `Etc/GMT-1` in `Europe/Madrid` even in summer), and a database in a directory keeps that zone when it's opened again, from a process in any zone.

- **The safe way**: always create it with `postgresqlconf: ["timezone = 'UTC'"]`, as in the examples on this page. A database in memory is created at every start, so it needs it every time; in a directory the option is also kept, and it puts in UTC a database that was created in another zone.
- **Without the option**, which needs more care: a database in a directory created in UTC, or opened once with the option, stays in UTC. One created by a process in another zone is in that zone, and the values already stored in it are in that zone too: opening it with the option changes the zone of the database, not those values. `ALTER DATABASE … SET timezone` isn't applied by PGlite (measured on 0.5.11).

When the database isn't in UTC, the values the library sends and reads stay right, but the SQL that the database computes in its zone doesn't, like a wall clock converted to an instant or the date functions of a `timestamptz` (`getHours()` of `09:15 UTC` is `18` in Tokyo). The query runner can't check it without running a query: see [Time zones → Known limits](../../time-zones.md#known-limits). Don't use `startParams` for it: it replaces the parameters PGlite starts with, and PGlite fails to start.

## Inside a transaction something else manages

When your code or [another library](../combining-with-another-library.md) manages the transaction with `db.transaction(...)`, create the query runner with the transaction object it gives you. Inside that function PGlite answers only that object: a query on `db` waits until the transaction ends. The statements of the query runner run in that transaction, which PGlite commits or rolls back when your function ends. A transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { PGlite } from '@electric-sql/pglite'
import { PgLiteQueryRunner } from 'ts-sql-query/postgresql/pglite'

const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })

async function main() {
    await db.transaction(async (transaction) => {
        const connection = new DBConnection(new PgLiteQueryRunner(transaction));
        // Do your queries here, in the transaction
        connection // ...
    });
}
```

When the transaction began with a query on the database (`db.query('begin')`), create the query runner with the database and `new PgLiteQueryRunner(db, { forUseInTransaction: true })`, with the same effect. Without the option, the commit of an inner transaction would end the outer one.

## Nested transactions

A transaction that begins inside another one is rejected, unless you create the query runner with `new PgLiteQueryRunner(db, { allowNestedTransactions: true })`. PostgreSQL doesn't nest them: see [what this option does](../../../queries/transaction.md#nested-transactions).

## The type of the parameters

Where PostgreSQL can't work out the type of a parameter, like a constant selected on its own, the query runner sends the parameter with the type of [the category of its type](../../column-types.md#how-a-value-is-sent-to-the-database), and the SQL has no cast: `select $1 as result`, with the parameter sent as an `int4`. The option `typesByName` maps the name of a type, the one you give a custom type or a built-in one like `'int'`, to the oid of the PostgreSQL type every parameter of that name is sent with, wherever it is written: `new PgLiteQueryRunner(db, { typesByName: { ExactDecimal: 1700 } })` sends an exact decimal kept as text as a `numeric` (oid 1700), with every digit.

## Options of the query runner

The second argument of `PgLiteQueryRunner`, optional, is an object of type `PgLiteQueryRunnerConfig`, exported from `ts-sql-query/postgresql/pglite`:

- **`allowNestedTransactions`**: see [Nested transactions](#nested-transactions).
- **`typesByName`**: see [The type of the parameters](#the-type-of-the-parameters).
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).
