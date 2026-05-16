---
search:
  boost: 0.7
---
# Synchronous query runners

Some query runners support executing queries synchronously if you provide a Promise implementation that supports it, like [synchronous-promise](https://www.npmjs.com/package/synchronous-promise).

!!! success "Supported query runners that connect to a database"

    - [BetterSqlite3QueryRunner](../configuration/query-runners/recommended/better-sqlite3.md)
    - [Sqlite3WasmOO1QueryRunner](../configuration/query-runners/recommended/sqlite-wasm-OO1.md)
    - [PgLiteQueryRunner](../configuration/query-runners/recommended/pglite.md)
    - [BunSqliteQueryRunner](../configuration/query-runners/recommended/bun_sqlite.md)
    - [NodeSqliteQueryRunner](../configuration/query-runners/recommended/node_sqlite.md)

!!! success "Supported general purposes query runners"

    - [InterceptorQueryRunner](../configuration/query-runners/general-purpose/InterceptorQueryRunner.md)
    - [LoggingQueryRunner](../configuration/query-runners/general-purpose/LoggingQueryRunner.md)
    - [MockQueryRunner](../configuration/query-runners/general-purpose/MockQueryRunner.md)
    - Others
        - [ConsoleLogQueryRunner](../configuration/query-runners/general-purpose/ConsoleLogQueryRunner.md)
        - [ConsoleLogNoopQueryRunner](../configuration/query-runners/general-purpose/ConsoleLogNoopQueryRunner.md)
        - [NoopQueryRunner](../configuration/query-runners/general-purpose/NoopQueryRunner.md)

## Unwrapping synchronous promises

`ts-sql-query` ships a `sync` helper that unwraps the result of a synchronous promise in a blocking manner, similar to how `await` unwraps regular promises. When combined with a promise implementation like [`synchronous-promise`](https://www.npmjs.com/package/synchronous-promise) — which resolves synchronously and does not defer `.then` execution — and one of the supported query runners listed above, it lets you interact with `ts-sql-query` in a fully synchronous style.

```ts
import { sync } from 'ts-sql-query' // or 'ts-sql-query/extras/sync';
```

The promise passed to `sync()` must be truly synchronous — typically a database operation wrapped with `SynchronousPromise`. If `sync()` detects that the operation has not resolved (or rejected) by the time `.then(...)` returns, it throws an error, preventing misuse.

!!! tip "No need to re-implement `sync()`"

    Previously, the recommendation was to copy a `sync()` implementation into your own codebase. That is no longer necessary — import it from `ts-sql-query` (or its `ts-sql-query/extras/sync` subpath) instead.

## Usage Example

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
import { sync } from "ts-sql-query"; // or "ts-sql-query/extras/sync"
import * as betterSqlite3 from "better-sqlite3";
import { SynchronousPromise } from "synchronous-promise";

const db = betterSqlite3('foobar.db', options);

function main() {
    const connection = new DBConnection(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }));
    // Do your queries here, surrounding each one with the sync function. For example:
    const selectCompanies = sync(
        connection.selectFrom(tCompany)
            .where(tCompany.isBig)
            .select({
                id: tCompany.id,
                name: tCompany.name
            })
            .executeSelectMany()
    );

    var result = sync(connection.insertInto...)
    result = sync(connection.update...)
    result = sync(connection.delete...)
}
```
