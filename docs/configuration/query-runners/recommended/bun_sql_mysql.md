---
search:
  boost: 0.577
---
# Bun SQL for MySQL

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver configured with the MySQL adapter, allowing `ts-sql-query` to execute queries on [MySQL](../../supported-databases/mysql.md) or [MariaDB](../../supported-databases/mariadb.md) databases.

!!! success "Supported databases"

    - [MySQL](../../supported-databases/mysql.md)
    - [MariaDB](../../supported-databases/mariadb.md)

!!! danger "Experimental"

    This query runner is experimental.

    Bun SQL's MySQL adapter currently has known bugs that require compatibility notes and example-level workarounds. This status will be revisited when the upstream Bun issues are resolved.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

!!! warning "Affected rows compatibility"

    Bun SQL's MySQL adapter currently reports changed rows for `UPDATE` statements. This differs from the default behavior of the `mysql2` and `mariadb` drivers, which enable `CLIENT_FOUND_ROWS`/`foundRows` by default and report matched rows through `affectedRows`.

    As a consequence, an `UPDATE` that matches a row but writes the same values can report `affectedRows = 0` with Bun SQL, while `mysql2` and `mariadb` report `affectedRows = 1` by default.

    Bun SQL does not currently expose a documented option equivalent to `mysql2`'s `flags: ["-FOUND_ROWS"]`/`flags: ["FOUND_ROWS"]` or `mariadb`'s `foundRows`. See [oven-sh/bun#30843](https://github.com/oven-sh/bun/issues/30843) for the compatibility report.

!!! warning "MySQL type decoding"

    Bun SQL's MySQL adapter currently has a prepared-statement decoding issue where some MySQL/MariaDB values, such as `YEAR` and `NEWDECIMAL` results, can be returned as binary buffers instead of decoded JavaScript values.

    The Bun SQL MySQL/MariaDB examples include a local `transformValueFromDB` workaround for the affected numeric projections. See [oven-sh/bun#29471](https://github.com/oven-sh/bun/issues/29471) for the upstream bug report.

    Bun SQL's MySQL adapter can also leave a query promise unresolved when a `YEAR` result column is followed by a `NEWDECIMAL` result column in the same result row. The examples include a local SQL builder workaround for the affected date projections. See [oven-sh/bun#30854](https://github.com/oven-sh/bun/issues/30854) for the upstream bug report.

## Using a Bun SQL MySQL connection

Executes queries through a [Bun SQL](https://bun.com/docs/runtime/sql) connection configured with the MySQL adapter.

```ts
import { SQL } from "bun";
import { BunSqlMySqlQueryRunner } from "ts-sql-query/queryRunners/BunSqlMySqlQueryRunner";

const sql = new SQL({
    adapter: 'mysql',
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3306,
});

async function main() {
    const connection = new DBConnection(new BunSqlMySqlQueryRunner(sql));
    // Do your queries here
}
```
