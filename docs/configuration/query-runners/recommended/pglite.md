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
import { PgLiteQueryRunner } from 'ts-sql-query/queryRunners/PgLiteQueryRunner'

const db = await PGlite.create('memory://')

async function main() {
    const connection = new DBConnection(new PgLiteQueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## Inside a transaction something else manages

When your code or [another library](../combining-with-another-library.md) manages the transaction with `db.transaction(...)`, create the query runner with the transaction object it gives you. Inside that function PGlite answers only that object: a query on `db` waits until the transaction ends. The statements of the query runner run in that transaction, which PGlite commits or rolls back when your function ends. A transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { PGlite } from '@electric-sql/pglite'
import { PgLiteQueryRunner } from 'ts-sql-query/queryRunners/PgLiteQueryRunner'

const db = await PGlite.create('memory://')

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
