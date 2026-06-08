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

    [@electric-sql/pglite](https://www.npmjs.com/package/@electric-sql/pglite) `^0.4.4`

    This information reflects the driver version pinned in this project's `devDependencies` and exercised by the CI suite. Other compatible versions may work but are not actively tested.

!!! danger "Experimental"

    This query runner is experimental.

    pglite's in-process driver has a known parameter-binding limitation that requires a compatibility workaround (see *Date parameter binding* below). This status will be revisited when the upstream pglite issue is resolved.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

!!! warning "Date parameter binding"

    pglite's in-process parameter serialiser cannot bind a JavaScript `Date`: for a parameter whose type it infers as text (a placeholder without an explicit `::cast`) it rejects it with `Invalid input for string type`. The wire-protocol PostgreSQL drivers (`pg`, `postgres`) don't hit this because they serialise the `Date` to a string on the client before sending it; pglite's serialiser does not. The upstream report is [electric-sql/pglite#1021](https://github.com/electric-sql/pglite/issues/1021).

    **Workaround (already applied):** `PgLiteQueryRunner` handles this for you — it serialises every `Date` parameter to an ISO 8601 string (`date.toISOString()`) before binding it, mirroring what `pg` / `postgres` send, so `localDate` / `localDateTime` values bind correctly in every position. This is a best-effort workaround built into the runner; it **may change without backwards compatibility** once [electric-sql/pglite#1021](https://github.com/electric-sql/pglite/issues/1021) is fixed upstream. If you need different behaviour, install a `TypeAdapter` that converts `Date` operands before they reach the driver.

## Using a single connection

Executes queries through a dedicated [PgLite](https://www.npmjs.com/package/@electric-sql/pglite) connection.

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
