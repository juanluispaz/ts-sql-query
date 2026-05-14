---
search:
  boost: 0.577
---
# Bun SQL for MySQL

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver configured with the MySQL adapter, allowing `ts-sql-query` to execute queries on [MySQL](../../supported-databases/mysql.md) or [MariaDB](../../supported-databases/mariadb.md) databases.

!!! success "Supported databases"

    - [MySQL](../../supported-databases/mysql.md)
    - [MariaDB](../../supported-databases/mariadb.md)

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

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
