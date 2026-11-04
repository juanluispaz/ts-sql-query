---
search:
  boost: 0.573
---
<!-- doc-code-template: postgresql -->
# Combining with another library

`ts-sql-query` can work next to another library that uses the same database, like the ORM [Prisma](https://www.prisma.io) or the job queue [pg-boss](https://pgboss.io), or next to your own code using the driver. There are three ways, from the least to the most shared:

- [**Sharing the pool**](#sharing-the-pool): each one works on its own connection, in its own transactions.
- [**`ts-sql-query` gives its connection**](#ts-sql-query-gives-its-connection): the other library runs its statements on a connection of the query runner.
- [**The other library gives its connection**](#the-other-library-gives-its-connection): `ts-sql-query` runs its statements on a connection of the other library.

To share a transaction they have to share a connection, so whoever gives it decides what each one can do in the transaction. Let `ts-sql-query` manage it if the other library allows it:

| | `ts-sql-query` manages the transaction | The other library manages the transaction |
| --- | --- | --- |
| Isolation levels | [The ones of `ts-sql-query`](../../queries/transaction.md#transaction-isolation) | The ones the other library offers |
| `executeAfterNextCommit` and the other end-of-transaction functions | Yes | No, they throw `NOT_IN_TRANSACTION` |
| `connection.transaction(...)` | Yes | No, it rejects |
| The transaction function of the other library | Not allowed | Yes |

## Sharing the pool

Give the other library the pool you give the query runner, when it accepts one. Each one takes a connection from the pool for its own work, so they don't share a transaction.

## ts-sql-query gives its connection

`connection.queryRunner.execute(fn)` calls `fn` with a connection of the query runner, to give to the other library. [What each query runner gives](../../queries/transaction.md#using-the-drivers-connection-in-the-transaction) is on the transactions page.

```ts
await connection.queryRunner.execute(async (client) => {
    // Give client to the other library
    client // ...
});
```

!!! warning "In a transaction"

    Inside `connection.transaction(...)`, `client` is the connection of the transaction: the other library runs its statements in it, and `ts-sql-query` manages it. The other library must not begin, commit or roll back on that connection.

    ```ts
    await connection.transaction(async () => {
        // Do your queries here
        connection // ...
        await connection.queryRunner.execute(async (client) => {
            // Give client to the other library: its statements run in this transaction
            client // ...
        });
    });
    ```

## The other library gives its connection

Create a query runner over the connection the other library gives you, for the time you use it, as over any connection of your driver:

```ts
import type { PoolClient } from 'pg';
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

async function main(client: PoolClient) {
    const connection = new DBConnection(new PgQueryRunner(client));
    // Do your queries here
    connection // ...
}
```

!!! warning "In a transaction"

    When that connection is in a transaction the other library manages, **the query runner has to know**, or it can end that transaction: an inner `connection.transaction(...)` commits it on PostgreSQL, MySQL and MariaDB, and on Oracle each statement commits it. How you tell it depends on the query runner:

    | Query runner | How to create it |
    | --- | --- |
    | [`PgQueryRunner`](recommended/pg.md#inside-a-transaction-something-else-manages), [`MySql2QueryRunner`](recommended/mysql2.md#inside-a-transaction-something-else-manages), [`MariaDBQueryRunner`](recommended/mariadb.md#inside-a-transaction-something-else-manages), [`OracleDBQueryRunner`](recommended/oracledb.md#inside-a-transaction-something-else-manages), [`BetterSqlite3QueryRunner`](recommended/better-sqlite3.md#inside-a-transaction-something-else-manages), [`BunSqliteQueryRunner`](recommended/bun_sqlite.md#inside-a-transaction-something-else-manages), [`NodeSqliteQueryRunner`](recommended/node_sqlite.md#inside-a-transaction-something-else-manages), [`Sqlite3QueryRunner`](additional/sqlite3.md#inside-a-transaction-something-else-manages), [`Sqlite3WasmOO1QueryRunner`](recommended/sqlite-wasm-OO1.md#inside-a-transaction-something-else-manages) | With the connection and the `forUseInTransaction` option |
    | [`PgLiteQueryRunner`](recommended/pglite.md#inside-a-transaction-something-else-manages) | With the transaction of `db.transaction(...)`; or, in a transaction begun with a query on the database, with the database and the `forUseInTransaction` option |
    | [`PostgresQueryRunner`](recommended/postgres.md#inside-a-transaction-you-began-with-postgresjs), [`BunSqlPostgresQueryRunner`](recommended/bun_sql_postgres.md#inside-a-transaction-you-began-with-bun-sql), [`BunSqlMySqlQueryRunner`](recommended/bun_sql_mysql.md#inside-a-transaction-you-began-with-bun-sql), [`BunSqlSqliteQueryRunner`](recommended/bun_sql_sqlite.md#inside-a-transaction-you-began-with-bun-sql) | With the transaction of `sql.begin(...)` |
    | [`MssqlPoolQueryRunner`](recommended/mssql.md#inside-a-transaction-something-else-manages) | With the mssql `Transaction` |
    | The other query runners over a pool | They can't: a pool is not in a transaction. Take a connection from the pool and use the query runner over a single connection |

    Its statements then run in that transaction, and the other library commits it or rolls it back. A transaction can't begin on the query runner: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`. For `ts-sql-query` there is no transaction open: `connection.commit()`, `connection.rollback()`, the end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

## Example: pg-boss

[pg-boss](https://pgboss.io) is a job queue that keeps its jobs in PostgreSQL. Sending a job in the transaction of `ts-sql-query` means the job exists only if the transaction commits: a rollback leaves no job for a change that was undone.

Its `send` takes a `db` option, an object with an `executeSql` function, to run on a connection of yours. Create one over the connection of the transaction:

```ts
import { Pool, type PoolClient } from 'pg';
import { PgBoss } from 'pg-boss';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool(/* configuration */);
const boss = new PgBoss(/* configuration */);

async function main() {
    await boss.start();
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    await connection.transaction(async () => {
        // Do your queries here
        connection // ...
        await connection.queryRunner.execute(async (client) => {
            const db = { executeSql: (text: string, values?: unknown[]) => (client as PoolClient).query(text, values) };
            await boss.send('send-welcome-email', { customerId: 10 }, { db });
        });
    });
}
```

!!! info "Checked with"

    `pg-boss` `12.38.0` and PostgreSQL 18, by hand. pg-boss is not part of this project's test suite.

## Example: Prisma

[Prisma](https://www.prisma.io) on PostgreSQL takes a [pg](https://node-postgres.com) pool or connection, so it works with the [pg query runners](recommended/pg.md) in all three ways.

!!! info "Checked with"

    `@prisma/orm-postgres` `8.0.0-rc.22` and PostgreSQL 18, by hand. Prisma is not part of this project's test suite.

### Sharing the pool

Closing the Prisma client doesn't close a pool you gave it.

```ts
import { Pool } from 'pg';
import prismaPostgres from '@prisma/orm-postgres/runtime';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool(/* configuration */);
const db = prismaPostgres({ contract, pg: pool });

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    // Do your queries here
    connection // ...
    // Do Prisma's queries here
    db // ...
}
```

### ts-sql-query manages the transaction

Create the Prisma client over the connection of the transaction:

```ts
import { Pool, type PoolClient } from 'pg';
import prismaPostgres from '@prisma/orm-postgres/runtime';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool(/* configuration */);

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    await connection.transaction(async () => {
        await connection.queryRunner.execute(async (client) => {
            const db = prismaPostgres({ contract, pg: client as PoolClient });
            // Do your queries and Prisma's here, in the same transaction
            connection // ...
            db // ...
        });
    });
}
```

!!! danger "Two things commit or lose the transaction"

    Prisma doesn't know this connection is in a transaction, so on this client:

    - **Don't use the `cursor` option of `prismaPostgres(...)`.** With it, Prisma wraps each read in its own `BEGIN` and `COMMIT`, and that `COMMIT` ends your transaction: what you wrote before stays committed even if you roll back later.
    - **Don't call `db.transaction(...)`.** It would begin a transaction on the same connection, and give the connection back to the pool when it ends.

### Prisma manages the transaction

Take a connection from the pool, create the Prisma client over it, and inside the transaction create the query runner over the same connection with [`forUseInTransaction`](recommended/pg.md#inside-a-transaction-something-else-manages):

```ts
import { Pool } from 'pg';
import prismaPostgres from '@prisma/orm-postgres/runtime';
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

const pool = new Pool(/* configuration */);

async function main() {
    const client = await pool.connect();
    const db = prismaPostgres({ contract, pg: client });
    await db.transaction(async (tx: any) => {
        const connection = new DBConnection(new PgQueryRunner(client, { forUseInTransaction: true }));
        // Do your queries here, and Prisma's through tx, in the same transaction
        connection // ...
        tx // ...
    });
    // Prisma already gave the connection back to the pool: don't release it
}
```

!!! warning "The connection lasts one transaction"

    Prisma gives a connection taken from a pool back when its transaction ends, and releasing it again throws. For another transaction, take another connection and create another Prisma client. Creating a Prisma client is cheap, and you don't need to close one created this way. If you end up not calling `db.transaction(...)`, release the connection yourself.

!!! note "A setting of the session"

    The first time a Prisma client uses a connection it sends one query of its own, a `set_config` of `DateStyle` to `ISO` and `lc_monetary` to `C`, which stays in the session of that connection.
