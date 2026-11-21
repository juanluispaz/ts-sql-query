---
search:
  boost: 0.575
---
# LoggingQueryRunner

A query runner that calls your logger with each statement and its result or error, and runs the statement with the query runner it wraps. Useful for debugging, measuring and auditing the statements. It is an [`InterceptorQueryRunner`](InterceptorQueryRunner.md) that carries the instant each statement began; to carry data of your own between the call before a statement and the call after it, extend `InterceptorQueryRunner`. To log without a logger object, extend it: see [A logger of your own, as a class](#a-logger-of-your-own-as-a-class).

!!! success "Supported databases"

    - [MariaDB](../../../databases/mariadb/index.md)
    - [MySQL](../../../databases/mysql/index.md)
    - [Oracle](../../../databases/oracle/index.md)
    - [PostgreSQL](../../../databases/postgresql/index.md)
    - [SQLite](../../../databases/sqlite/index.md)
    - [SQL Server](../../../databases/sqlserver/index.md)

!!! tip

    `LoggingQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/running-queries/synchronous-query-runners.md) for more information.

## Creating it

```ts
import { LoggingQueryRunner } from "ts-sql-query";

async function main() {
    const connection = new DBConnection(new LoggingQueryRunner({
        onQuery(queryType, query, params) {
            console.log('onQuery', queryType, query, params)
        },
        onQueryResult(queryType, query, params, result) {
            console.log('onQueryResult', queryType, query, params, result)
        },
        onQueryError(queryType, query, params, error) {
            console.log('onQueryError', queryType, query, params, error)
        }
    }, otherQueryRunner));

    // Do your queries here
    connection // ...
}
```

## The functions of the logger

!!! warning "A logger shouldn't throw"

    The statement has already run when `onQueryResult` is called. If it throws, the promise of the query rejects with the reason `UNKNOWN`, although the statement went through and an insert has written its row. Handle your errors inside the logger.

The first argument of the constructor is an object of type `QueryLogger` (exported from `ts-sql-query`), a plain object or an instance of a class of yours, that can define these functions, all of them optional. Each one is called as a method of the logger, so `this` is the logger:

- **`onQuery`**: Executed before the query.
- **`onQueryResult`**: Executed after the successful execution of the query.
- **`onQueryError`**: Executed after the query in case of error.

They receive these arguments:

- **`queryType: QueryType`**: type of the query to be executed. The `QueryType` is defined as:

<!-- doc-code-snippet-template: simplifiedDefinition -->
```ts
type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' |
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' |
    'insertReturningOneRow' | 'insertReturningManyRows' | 'insertReturningOneColumnOneRow' | 'insertReturningOneColumnManyRows' |
    'update' | 'updateReturningOneRow' | 'updateReturningManyRows' | 'updateReturningOneColumnOneRow' | 'updateReturningOneColumnManyRows' |
    'delete' | 'deleteReturningOneRow' | 'deleteReturningManyRows' | 'deleteReturningOneColumnOneRow' | 'deleteReturningOneColumnManyRows' |
    'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' | 
    'executeDatabaseSchemaModification' | 'executeConnectionConfiguration'
```

- **`query: string`**: the SQL to be executed. It's empty for `beginTransaction`, `commit` and `rollback`.
- **`params: any[]`**: parameters received by the query. For `beginTransaction`, `commit` and `rollback` they're the options of the transaction: for `beginTransaction`, a `BeginTransactionOpts`, `[isolationLevel, accessMode]`, as the query runner receives them (the level is `undefined` when only the access mode is given, and the array is empty without either); for `commit` and `rollback`, a `CommitOpts` or `RollbackOpts`, empty after `connection.beginTransaction()`, and with the same values as the begin inside `connection.transaction(fn, level)`. These types are exported from `ts-sql-query`.
- **`result: any`**: (only in `onQueryResult`) result of the execution of the query.
- **`error: any`**: (only in `onQueryError`) error that happened executing the query.
- **`timestamps`**: an object with `startedAt`, the time before the execution, and in `onQueryResult` and `onQueryError` also `endedAt`, the time after it. Both are a `bigint` in nanoseconds, counted from an arbitrary starting point: `endedAt - startedAt` is the duration.

!!! info

    When the driver begins and commits the transaction by itself, as `postgres` and Bun SQL do in `connection.transaction(...)`, fake `beginTransaction`, `commit`, and `rollback` operations will be emitted to allow you to see them in the log: each one is given to `onQuery` and then to `onQueryResult`, one right after the other, with the timestamps of that moment.

## A logger of your own, as a class

To send the statements to a tracer or a metrics system, extend `LoggingQueryRunner` and override its protected methods `logQuery`, `logQueryResult` and `logQueryError`. They receive the same arguments as the functions of the logger, the timestamps included, and by default they call those functions; a subclass is created with only the query runner it wraps:

```ts
import { LoggingQueryRunner, type QueryRunner, type QueryType } from "ts-sql-query";

const durations: { queryType: QueryType, query: string, nanoseconds: bigint, failed: boolean }[] = []

class MeasuringQueryRunner<T extends QueryRunner> extends LoggingQueryRunner<T> {
    protected override logQueryResult(queryType: QueryType, query: string, _params: any[], _result: any, timestamps: { startedAt: bigint, endedAt: bigint }): void {
        durations.push({ queryType, query, nanoseconds: timestamps.endedAt - timestamps.startedAt, failed: false })
    }
    protected override logQueryError(queryType: QueryType, query: string, _params: any[], _error: any, timestamps: { startedAt: bigint, endedAt: bigint }): void {
        durations.push({ queryType, query, nanoseconds: timestamps.endedAt - timestamps.startedAt, failed: true })
    }
}

const connection = new DBConnection(new MeasuringQueryRunner(otherQueryRunner));
```

`logQuery` isn't overridden here, so it calls `onQuery` of a logger the class doesn't have: nothing. [`ConsoleLogQueryRunner`](ConsoleLogQueryRunner.md) is a `LoggingQueryRunner` made this way.

