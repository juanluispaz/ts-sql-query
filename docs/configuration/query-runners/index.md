---
search:
  boost: 2
---
# Query runners

A query runner is the piece between the library and your database driver. The connection builds the SQL, and the query runner receives it with its parameters, runs it with the driver, and gives back the rows. You choose one when you create the connection:

```ts
import { Pool } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool();

const connection = new DBConnection(new PgPoolQueryRunner(pool));
```

So the queries you write don't depend on the driver: changing `pg` for `postgres` means changing the query runner, not the queries. And because a query runner receives every statement, it's also the place to log them, to measure them, or to simulate the database in a test.

There are two groups:

- [**One for each driver**](#which-one-for-your-database), which talks to the database.
- [**General purpose**](#logging-intercepting-and-simulating), which wraps another query runner, or takes the place of the database.

A connection object and its query runner represent one connection to the database, even when the query runner uses a pool. Create them for each request, and don't share them between concurrent requests: see [Instantiating the connection](../connection.md#instantiating-the-connection-with-the-database-connection).

## Which one for your database

| Database | Driver | Query runner | Page |
|---|---|---|---|
| MariaDB | `mariadb` | `MariaDBPoolQueryRunner`, `MariaDBQueryRunner` | [mariadb](recommended/mariadb.md) |
| MariaDB | `mysql2` | `MySql2PoolQueryRunner`, `MySql2QueryRunner` | [mysql2](recommended/mysql2.md) |
| MariaDB | Bun SQL | `BunSqlMySqlQueryRunner` | [Bun SQL for MySQL](recommended/bun_sql_mysql.md) |
| MySQL | `mysql2` | `MySql2PoolQueryRunner`, `MySql2QueryRunner` | [mysql2](recommended/mysql2.md) |
| MySQL | `mariadb` | `MariaDBPoolQueryRunner`, `MariaDBQueryRunner` | [mariadb](recommended/mariadb.md) |
| MySQL | Bun SQL | `BunSqlMySqlQueryRunner` | [Bun SQL for MySQL](recommended/bun_sql_mysql.md) |
| Oracle | `oracledb` | `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner`, `OracleDBQueryRunner` | [oracledb](recommended/oracledb.md) |
| PostgreSQL | `pg` | `PgPoolQueryRunner`, `PgQueryRunner` | [pg](recommended/pg.md) |
| PostgreSQL | `postgres` | `PostgresQueryRunner` | [postgres](recommended/postgres.md) |
| PostgreSQL | PGlite | `PgLiteQueryRunner` | [pglite](recommended/pglite.md) |
| PostgreSQL | Bun SQL | `BunSqlPostgresQueryRunner` | [Bun SQL for PostgreSQL](recommended/bun_sql_postgres.md) |
| SQLite | `better-sqlite3` | `BetterSqlite3QueryRunner` | [better-sqlite3](recommended/better-sqlite3.md) |
| SQLite | `node:sqlite` | `NodeSqliteQueryRunner` | [node:sqlite](recommended/node_sqlite.md) |
| SQLite | `bun:sqlite` | `BunSqliteQueryRunner` | [Bun Sqlite](recommended/bun_sqlite.md) |
| SQLite | Bun SQL | `BunSqlSqliteQueryRunner` | [Bun SQL for SQLite](recommended/bun_sql_sqlite.md) |
| SQLite | sqlite-wasm | `Sqlite3WasmOO1QueryRunner` | [sqlite-wasm OO1](recommended/sqlite-wasm-OO1.md) |
| SQLite | `sqlite3` | `Sqlite3QueryRunner` | [sqlite3](additional/sqlite3.md) |
| SQL Server | `mssql` | `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | [mssql](recommended/mssql.md) |

The name says what the query runner receives: `Pool` a pool of connections of the driver, from which it takes a connection for each statement or transaction, `PoolPromise` a promise of that pool, and no suffix a single connection you give it. The page of each one shows how to create it.

## Logging, intercepting and simulating

The general purpose query runners don't know about any driver:

| Query runner | What it does | Receives |
|---|---|---|
| [`InterceptorQueryRunner`](general-purpose/InterceptorQueryRunner.md) | Calls your code before and after each statement, with data of your own between the two calls | Another query runner |
| [`LoggingQueryRunner`](general-purpose/LoggingQueryRunner.md) | Calls your logger with each statement and its result or error | Another query runner |
| [`ConsoleLogQueryRunner`](general-purpose/ConsoleLogQueryRunner.md) | Writes each statement on the console | Another query runner |
| [`MockQueryRunner`](general-purpose/MockQueryRunner.md) | Takes the place of the database: your function decides the result of each statement, for a test | Your function |
| [`NoopQueryRunner`](general-purpose/NoopQueryRunner.md) | Takes the place of the database, and always returns empty results | Nothing: the connection says which database to write the SQL for |
| [`ConsoleLogNoopQueryRunner`](general-purpose/ConsoleLogNoopQueryRunner.md) | The same, writing each statement on the console | Nothing: the connection says which database to write the SQL for |

The ones that receive another query runner can be chained:

```ts
import { Pool } from 'pg';
import { ConsoleLogQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogQueryRunner";
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool();

const connection = new DBConnection(new ConsoleLogQueryRunner(new PgPoolQueryRunner(pool)));
```

To read in one of these the name of a query, where it was called from, or whether it's the count of a page, see [Query execution metadata](../../advanced/query-execution-metadata.md).

## Reaching the driver

The library covers what its queries need, and your code can reach the driver for the rest.

!!! danger "This is the low-level interface of the library"

    `connection.queryRunner` is below the query builder. Running something through it, or with a connection of the driver, skips the protections of the library: the types don't check that SQL, nothing stops an `update` or a `delete` without a `where`, `allowWhen` doesn't apply, and the values only go as parameters if you send them as parameters. A statement run with a connection of the driver doesn't reach a wrapper either, so a `LoggingQueryRunner` doesn't see it.

    Use it to give a connection to a library that needs one, or for a feature of the driver. To write SQL of your own in a query, use a [SQL fragment](../../queries/sql-fragments.md), which keeps those protections.

`connection.queryRunner` gives you the query runner, with these methods:

| Method | What it gives |
|---|---|
| `getNativeRunner()` | The object you created the query runner with: a pool, a connection or the `sql` of the driver |
| `getCurrentNativeConnection()` | The connection the current transaction runs on. `undefined` outside a transaction, and with a pool also before the first statement of the transaction |
| `execute(fn)` | Calls `fn` with a connection: the one of the transaction if there is one, and outside a transaction the connection you gave the query runner, or one taken from the pool for `fn` alone |
| `isMocked()` | Whether the query runner is a `MockQueryRunner` |

A wrapper answers what the query runner it wraps answers. The ones that take the place of the database have no driver: `getNativeRunner()` returns `null`, and `execute(fn)` calls `fn` with `null`.

They return an `unknown`, because each driver has its own type: cast it to the one of your driver. For example, to use a feature of `pg` that the library doesn't offer:

```ts
import { Pool } from 'pg';

const pool = connection.queryRunner.getNativeRunner() as Pool;
const waitingClients = pool.waitingCount;
```

`execute` is the one to use when your code or another library has to run statements in your transaction, because it always gives a connection:

```ts
await connection.transaction(async () => {
    await connection.queryRunner.execute(async (client) => {
        // Give client to your code or to the other library: its statements run in this transaction
        client // ...
    });
});
```

The connection belongs to the query runner: don't release it, and don't commit or roll back with it. [Using the driver's connection in the transaction](../../queries/transaction.md#using-the-drivers-connection-in-the-transaction) has what each query runner gives, and [Combining with another library](combining-with-another-library.md) how to share a transaction with another library, whichever of the two manages it.

`isMocked()` lets code that can't run in a test, like a call to another service, know that it's running with a `MockQueryRunner`. It's rarely the best option: [MockQueryRunner](general-purpose/MockQueryRunner.md) explains what to prefer. `NoopQueryRunner` and `ConsoleLogNoopQueryRunner` answer `false`.
