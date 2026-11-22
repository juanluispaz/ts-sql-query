---
search:
  boost: 0.577
---
<!-- doc-code-template: postgresql -->
# Bun SQL for PostgreSQL

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver, allowing `ts-sql-query` to execute queries on [PostgreSQL](../index.md) databases.

!!! success "Supported databases"

    - [PostgreSQL](../index.md)

!!! info "Tested with"

    The built-in Bun SQL driver, on **Bun**.

    This information reflects the runtimes the test suite runs it on against a real database.

!!! info "Requirements"

    Bun 1.4.4 or newer.

!!! warning "Do not share connections between requests"

    Create the `SQL` object once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../../configuration/connection.md#instantiating-the-connection-with-the-database-connection).

## Using a connection pool

The `SQL` object is a pool of connections: give it to the query runner, and each statement takes a connection from it. In a transaction, every statement runs on the same connection until the transaction ends.

It must use the PostgreSQL adapter: with another one, the constructor of the query runner throws a `TsSqlProcessingError` with reason `INVALID_CONFIGURATION`.

```ts
import { SQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/postgresql/bun-sql";

const sql = new SQL({
    adapter: 'postgres',
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const connection = new DBConnection(new BunSqlPostgresQueryRunner(sql));
    // Do your queries here
    connection // ...
}
```

## Using a connection you reserved

The query runner can also be created with a connection you reserved from the pool: every statement and every transaction runs on it, and the query runner doesn't release it, you do.

```ts
import { SQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/postgresql/bun-sql";

const sql = new SQL({ adapter: 'postgres' /* , configuration */ });

async function main() {
    const reserved = await sql.reserve();
    try {
        const connection = new DBConnection(new BunSqlPostgresQueryRunner(reserved));
        // Do your queries here
        connection // ...
    } finally {
        reserved.release();
    }
}
```

## Connection requirements

**Rejected** when the query runner is created, with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION`; `name` says which:

- **`adapter`** other than `'postgres'`.
- **A `transform` that renames the columns of the results**: `transform: SQL.camel`, `SQL.toCamel`, or a `column.from` of your own. The library reads each column by its name. A transform of what is sent only, like `SQL.fromCamel` or `transform: { undefined: null }`, is accepted.

**Required and not checked**: the database in UTC, and the session `TimeZone` left in it. Bun SQL sets none unless you give it `connection: { TimeZone: … }` or `options` in the URL; don't give it one other than the zone of the database. See [The zone of the database and the session](../../../advanced/dates-and-times/column-kinds-and-session.md#the-zone-of-the-database-and-the-session).

## Inside a transaction you began with Bun SQL

Created with the transaction object of `sql.begin(...)`, the query runner runs its statements in that transaction, which Bun SQL commits or rolls back when your function ends. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` are rejected with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { SQL, type TransactionSQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/postgresql/bun-sql";

const sql = new SQL({ adapter: 'postgres' /* , configuration */ });

async function main() {
    await sql.begin(async (transaction: TransactionSQL) => {
        const connection = new DBConnection(new BunSqlPostgresQueryRunner(transaction));
        // Do your queries here, in the transaction
        connection // ...
    });
}
```

## A statement you run with Bun SQL itself

A statement that fails leaves a PostgreSQL transaction failed, even if its error is caught ([details](../index.md#a-statement-that-fails-inside-a-transaction)). `ts-sql-query` notices it for the statements it runs, but not for one you run with the connection of the transaction yourself (`connection.queryRunner.getCurrentNativeConnection()`): if that one fails and you catch its error, Bun SQL commits the transaction as if nothing had failed, and nothing of it is saved.

## The type of the parameters

Where PostgreSQL can't work out the type of a parameter, like a constant selected on its own, the query runner writes it as a cast in the SQL, `$1::int4`, from [the type requested for it](../../../advanced/data-types/sql-data-types.md#how-a-value-is-sent-to-the-database): Bun SQL can't send a parameter with its type. The cast is the name in PostgreSQL of the [SQL data type](../../../advanced/data-types/sql-data-types.md) of its class, so a type the library doesn't know, like an enum of the database or a type of an extension, gets its cast when its class says it:

```ts
import { EnumType, type SqlDataType } from "ts-sql-query";

type Feeling = 'happy' | 'sad'

abstract class FeelingType extends EnumType<Feeling, 'Feeling'> {
    static override readonly type = 'Feeling'
    // create type feeling as enum ('happy', 'sad')
    static override readonly sqlDataType: SqlDataType = { family: 'user-defined', name: 'feeling' }
}
```

Then `connection.const('happy', FeelingType)` selected on its own is `select $1::feeling as result`, with the parameter `[ 'happy' ]`, and a value the enum doesn't have is rejected by the database. The cast is written only where the query needs a type; elsewhere, like compared with a column, the parameter goes as `$1` and the column gives it its type.

## Fractions of a second below the millisecond

Bun SQL gives a `timestamp` (PostgreSQL) or a `datetime` (MySQL and MariaDB) as a `Date`, and has no way to give its text: a `plainDateTime` or an `instant` read through it stops at the millisecond. A `date` and a `time` keep all their digits. The other drivers of these databases read every digit.
