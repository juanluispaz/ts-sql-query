---
search:
  boost: 0.7
---
<!-- doc-code-template: sqlite -->
# Synchronous query runners

A query normally returns a `Promise`. Some drivers run the query synchronously, and with them you can get the result without `await`, for example in code that can't be asynchronous. You need a query runner of the following lists, with a `Promise` implementation that resolves synchronously, like [synchronous-promise](https://www.npmjs.com/package/synchronous-promise), and the `sync` function.

!!! success "Supported query runners that connect to a database"

    - [BetterSqlite3QueryRunner](../configuration/query-runners/recommended/better-sqlite3.md)
    - [Sqlite3WasmOO1QueryRunner](../configuration/query-runners/recommended/sqlite-wasm-OO1.md)
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

`sync` gets the result of a synchronous promise, as `await` does with a regular one.

```ts
import { sync } from 'ts-sql-query'
```

The promise must be truly synchronous: it must have been resolved or rejected by the time `.then(...)` returns. If it hasn't, `sync` throws a `TsSqlProcessingError` with the reason `SYNCHRONOUS_PROMISE_EXPECTED`. If the promise is rejected, `sync` throws its error.

## Usage Example

Give the query runner the `Promise` implementation with its `promise` option. The general purpose query runners that wrap another one use that of the wrapped query runner.

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/sqlite/better-sqlite3";
import Database from "better-sqlite3";
import { SynchronousPromise } from "synchronous-promise";

const db = new Database('foobar.db', options);

const connection = new DBConnection(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }));
```

Then surround each query with `sync`:

```ts
import { sync } from "ts-sql-query";

const selectCompanies = sync(
    connection.selectFrom(tCompany)
        .where(tCompany.id.equals(123))
        .select({
            id: tCompany.id,
            name: tCompany.name
        })
        .executeSelectMany()
);
```

In a transaction, the function you pass to `transaction` doesn't need to be `async`. If it throws, the transaction is rolled back and `sync` throws the error:

```ts
import { sync } from "ts-sql-query";

const updatedCompanies = sync(connection.transaction(() => {
    return sync(
        connection.update(tCompany)
            .set({ name: 'Acme' })
            .where(tCompany.id.equals(123))
            .executeUpdate()
    );
}));
```
