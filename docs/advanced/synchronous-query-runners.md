---
search:
  boost: 0.7
---
# Synchronous query runners

Some query runners support to execute the queries synchronously if you provide a Promise implementation that supports it, like [synchronous-promise](https://www.npmjs.com/package/synchronous-promise).

The query runners that support execute queries synchronously if you specify a synchronous Promise implementation are:

- [BetterSqlite3QueryRunner](../configuration/query-runners/recommended/better-sqlite3.md)
- [Sqlite3WasmOO1QueryRunner](../configuration/query-runners/recommended/sqlite-wasm-OO1.md)
- [ConsoleLogNoopQueryRunner](../configuration/query-runners/general-purpose/ConsoleLogNoopQueryRunner.md)
- [MockQueryRunner](../configuration/query-runners/general-purpose/MockQueryRunner.md)
- [NoopQueryRunner](../configuration/query-runners/general-purpose/NoopQueryRunner.md)

For example:

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
import * as betterSqlite3 from "better-sqlite3";
import { SynchronousPromise } from "synchronous-promise";

const db = betterSqlite3('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }));
    // Do your queries here,  surrounding it by the sync function. For example:
    const selectCompanies = sync(connection.selectFrom(tCompany)
    .where(tCustomCompany.isBig)
    .select({
        id: tCompany.id,
        name: tCompany.name
    }).executeSelectMany());

    var result = sync(connection.insertInto...)
    result = sync(connection.update...)
    result = sync(connection.delete...)
}
```

In the case of [synchronous-promise](https://www.npmjs.com/package/synchronous-promise), you will need this utility function that transforms a promise in a synchronous output:

```ts
/**
 * This function unwraps the synchronous promise in a synchronous way,
 * returning the result.
 */
function sync<T>(promise: Promise<T>): T {
    const UNSET = Symbol('unset');

    let result: T | typeof UNSET = UNSET;
    let error: unknown | typeof UNSET = UNSET;

    promise.then(
        (r) => (result = r),
        (e) => (error = e),
    );

    // Propagate error, if available
    if (error !== UNSET) {
        throw error;
    }

    // Propagate result, if available
    if (result !== UNSET) {
        return result;
    }

    // Note: This wrapper is to be used in combination with the `SynchronousPromise` type,
    // which is not strictly Promise-spec-compliant because it does not defer when calling
    // `.then`. See https://www.npmjs.com/package/synchronous-promise for more details.
    // To ensure that we're indeed using a synchronous promise, ensure that the promise resolved
    // immediately.
    throw new Error(
        'You performed a real async operation, not a database operation, ' +
            'inside the function dedicated to calling the database',
    );
}
```
