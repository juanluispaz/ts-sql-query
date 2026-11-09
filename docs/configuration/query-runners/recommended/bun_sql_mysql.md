---
search:
  boost: 0.577
---
<!-- doc-code-template: mysql -->
# Bun SQL for MySQL

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver configured with the MySQL adapter, allowing `ts-sql-query` to execute queries on [MySQL](../../supported-databases/mysql.md) or [MariaDB](../../supported-databases/mariadb.md) databases.

!!! success "Supported databases"

    - [MySQL](../../supported-databases/mysql.md)
    - [MariaDB](../../supported-databases/mariadb.md)

!!! info "Tested with"

    The built-in Bun SQL driver, on **Bun**.

    This information reflects the runtimes the test suite runs it on against a real database.

!!! danger "Experimental on MariaDB"

    This query runner is experimental when it is used against MariaDB: a [`Values`](../../mapping.md#mapping-constant-values-as-view) source cannot be used in a query (see [below](#mariadb-values)). Against MySQL it is fully supported.

!!! info "Requirements"

    Bun 1.4.4 or newer.

!!! warning "Do not share connections between requests"

    Create the `SQL` object once, and a connection object with its query runner for each request: they hold the state of the transaction of that request. See [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## Using a Bun SQL MySQL connection

The `SQL` object is a pool of connections: give it to the query runner, and each statement takes a connection from it. In a transaction, every statement runs on the same connection until the transaction ends.

```ts
import { SQL } from "bun";
import { BunSqlMySqlQueryRunner } from "ts-sql-query/queryRunners/BunSqlMySqlQueryRunner";

const sql = new SQL({
    adapter: 'mysql',
    foundRows: true,
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3306,
});

async function main() {
    const connection = new DBConnection(new BunSqlMySqlQueryRunner(sql));
    // Do your queries here
    connection // ...
}
```

## Connection requirements

The query runner refuses a connection that doesn't have these: its constructor throws a `TsSqlProcessingError` with reason `INVALID_CONFIGURATION` and, in `name`, which one.

- **`adapter`**: `'mysql'` or `'mariadb'`.
- **No `transform` that renames the columns of the results**: `transform: SQL.camel`, `SQL.toCamel` or a `column.from` of your own are refused, because the library reads each column by its name. A transform of what is sent only, like `SQL.fromCamel` or `transform: { undefined: null }`, is accepted.
- **`foundRows: true`** (or `?foundRows=true` in the connection URL). Without it, an `UPDATE` only counts the rows whose values actually changed: a row that matches the `WHERE` clause but already holds the values being set is not counted. The number returned by `executeUpdate()` would then be lower than the number of rows the update matched, and the `min` / `max` row checks of `executeUpdate(min, max)` would be evaluated against that lower number.

## Authentication without TLS

When the MySQL server authenticates with `caching_sha2_password` (the default since MySQL 8) and the connection does not use TLS, Bun SQL can reject the connection with `ERR_MYSQL_PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED`. Enable TLS on the connection, or set `allowPublicKeyRetrieval: true` if you accept retrieving the server's public key over an insecure connection.

## MariaDB: `Values`

Bun SQL always sends the query parameters as a server-side prepared statement, and MariaDB silently discards the parameter values placed inside a `VALUES (...)` table constructor of a prepared statement ([MDEV-33477](https://jira.mariadb.org/browse/MDEV-33477)). On MariaDB, a [`Values`](../../mapping.md#mapping-constant-values-as-view) source — in a `select`, an `insert ... from select`, an `UPDATE ... FROM` or a `DELETE ... USING` — therefore reaches the database without its values: the query reads empty values, inserts or updates nothing, or is refused. This does not affect MySQL, where the library emits `VALUES ROW(...)`.

## Inside a transaction you began with Bun SQL

Created with the transaction object of `sql.begin(...)`, the query runner runs its statements in that transaction, which Bun SQL commits or rolls back when your function ends. A transaction can't begin inside it: `connection.transaction(...)` and `connection.beginTransaction()` are rejected with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { SQL, type TransactionSQL } from "bun";
import { BunSqlMySqlQueryRunner } from "ts-sql-query/queryRunners/BunSqlMySqlQueryRunner";

const sql = new SQL({ adapter: 'mysql', foundRows: true /* , configuration */ });

async function main() {
    await sql.begin(async (transaction: TransactionSQL) => {
        const connection = new DBConnection(new BunSqlMySqlQueryRunner(transaction));
        // Do your queries here, in the transaction
        connection // ...
    });
}
```
