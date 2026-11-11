---
search:
  boost: 0.575
---
# InterceptorQueryRunner

A query runner that calls your code before and after each statement, and runs the statement with the query runner it receives in the constructor. What your code returns before the statement reaches it after the statement, like the time it started. If you only need to log, [`LoggingQueryRunner`](LoggingQueryRunner.md) takes an object with your functions and gives you the times.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `InterceptorQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

## Creating one

```ts
import type { QueryType } from "ts-sql-query";
import { InterceptorQueryRunner } from "ts-sql-query";

interface DurationPayload {
    startTime: number
}
class DurationLoggingQueryRunner extends InterceptorQueryRunner<DurationPayload> {
    onQuery(queryType: QueryType, query: string, params: any[]): DurationPayload {
        console.log('onQuery', queryType, query, params)
        return { startTime: Date.now() }
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, payload: DurationPayload): void {
        const duration = Date.now() - payload.startTime
        console.log('onQueryResult', queryType, query, params, result, duration)
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, payload: DurationPayload): void {
        const duration = Date.now() - payload.startTime
        console.log('onQueryError', queryType, query, params, error, duration)
    }
}

async function main() {
    const connection = new DBConnection(new DurationLoggingQueryRunner(otherQueryRunner));
    // Do your queries here
    connection // ...
}
```

## The functions you implement

!!! warning "These functions shouldn't throw"

    The statement has already run when `onQueryResult` is called. If it throws, the promise of the query rejects with the reason `UNKNOWN`, although the statement went through and an insert has written its row. Handle your errors inside them.

The `InterceptorQueryRunner` is an abstract class where you must implement the following functions:

- **`onQuery`**: Executed before the query. This function returns the payload data that will be received by the next functions.
- **`onQueryResult`**: Executed after the successful execution of the query. Receives as last argument the payload data created by the `onQuery` method.
- **`onQueryError`**: Executed after the query in case of error. Receives as last argument the payload data created by the `onQuery` method.

This class uses a generic type to define the payload returned by `onQuery` and later received by `onQueryResult` and `onQueryError`.

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

- **`query: string`**: the SQL query to be executed. It will be empty for `beginTransaction`, `commit`, or `rollback`.
- **`params: any[]`**: parameters received by the query. For `beginTransaction`, `commit` and `rollback` they're the options of the transaction: for `beginTransaction`, a `BeginTransactionOpts`, `[isolationLevel, accessMode]`, as the query runner receives them (the level is `undefined` when only the access mode is given, and the array is empty without either); for `commit` and `rollback`, a `CommitOpts` or `RollbackOpts`, empty after `connection.beginTransaction()`, and with the same values as the begin inside `connection.transaction(fn, level)`. These types are exported from `ts-sql-query`.
- **`result: any`**: (only in `onQueryResult`) result of the execution of the query.
- **`error: any`**: (only in `onQueryError`) error that happened executing the query.
- **`payload`**: (only in `onQueryResult` or `onQueryError`) payload data created by the `onQuery` function.

!!! info

    When the driver begins and commits the transaction by itself, as `postgres` and Bun SQL do in `connection.transaction(...)`, fake `beginTransaction`, `commit`, and `rollback` will be emitted to allow you to identify them.
