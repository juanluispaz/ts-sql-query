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

    This query runner is experimental when it is used against MariaDB: a [`Values`](../../mapping.md#mapping-constant-values-as-view) source cannot be used in a query (see *MariaDB: `Values`* below). Against MySQL it is fully supported.

!!! info "Requirements"

    Bun 1.4.4 or newer.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

!!! warning "The connection must be created with `foundRows: true`"

    Create the Bun SQL connection with `foundRows: true` (or `?foundRows=true` in the connection URL). `BunSqlMySqlQueryRunner` throws a `TsSqlProcessingError` with reason `INVALID_CONFIGURATION` (`name: 'foundRows'`) when it receives a connection without it.

    Without `foundRows`, an `UPDATE` only counts the rows whose values actually changed: a row that matches the `WHERE` clause but already holds the values being set is not counted. The number returned by `executeUpdate()` would then be lower than the number of rows the update matched, and the `min` / `max` row checks of `executeUpdate(min, max)` would be evaluated against that lower number.

!!! note "Authentication without TLS"

    When the MySQL server authenticates with `caching_sha2_password` (the default since MySQL 8) and the connection does not use TLS, Bun SQL can reject the connection with `ERR_MYSQL_PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED`. Enable TLS on the connection, or set `allowPublicKeyRetrieval: true` if you accept retrieving the server's public key over an insecure connection.

!!! warning "MariaDB: `Values`"

    Bun SQL always sends the query parameters as a server-side prepared statement, and MariaDB silently discards the parameter values placed inside a `VALUES (...)` table constructor of a prepared statement ([MDEV-33477](https://jira.mariadb.org/browse/MDEV-33477)). On MariaDB, a [`Values`](../../mapping.md#mapping-constant-values-as-view) source — in a `select`, an `insert ... from select`, an `UPDATE ... FROM` or a `DELETE ... USING` — therefore reaches the database without its values: the query reads empty values, inserts or updates nothing, or is refused. This does not affect MySQL, where the library emits `VALUES ROW(...)`.

## Using a Bun SQL MySQL connection

Executes queries through a [Bun SQL](https://bun.com/docs/runtime/sql) connection configured with the MySQL adapter.

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
