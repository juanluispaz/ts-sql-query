---
search:
  boost: 0.577
---
# Bun SQL for PostgreSQL

This page explains how to use `ts-sql-query` with the [Bun SQL](https://bun.com/docs/runtime/sql) driver, allowing `ts-sql-query` to execute queries on [PostgreSQL](../../supported-databases/postgresql.md) databases.

!!! success "Supported databases"

    - [PostgreSQL](../../supported-databases/postgresql.md)

!!! danger "Experimental"

    This query runner is experimental.

    Bun SQL's PostgreSQL adapter currently has a known bug that requires a compatibility note. This status will be revisited when the upstream Bun issue is resolved.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

!!! warning "Date parameter binding"

    Bun SQL's PostgreSQL adapter currently serialises JavaScript `Date` parameters using `Date#toString()` (e.g. `"Mon Jan 15 2024 00:00:00 GMT+0000 (Coordinated Universal Time)"`) instead of an ISO/timestamp format. PostgreSQL rejects this with `invalid input syntax for type date` whenever the bound parameter targets a `date`, `time` or `timestamp` column or cast.

    The upstream report [oven-sh/bun#29010](https://github.com/oven-sh/bun/issues/29010) documents the same root cause — `Date#toString()` instead of ISO. Note that the issue's scope description excludes `Bun.SQL#unsafe(query, params)`, but in practice that path is also affected (verified empirically against Bun 1.3.14): `BunSqlPostgresQueryRunner` uses `unsafe(...)`, so every `Date` value bound from `ts-sql-query` through the bun adapter hits the same serialisation. The fix will most likely land in the shared serialiser and resolve both paths at once.

    Workaround: pass dates as ISO strings (`date.toISOString()` for `timestamp`, `date.toISOString().slice(0, 10)` for `date`), or install a `TypeAdapter` that converts `Date` operands before they reach the driver.

## Using a connection pool

Executes queries through a [Bun SQL](https://bun.com/docs/runtime/sql) connection configured with the PostgreSQL adapter.

```ts
import { SQL } from "bun";
import { BunSqlPostgresQueryRunner } from "ts-sql-query/queryRunners/BunSqlPostgresQueryRunner";

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
}
```
