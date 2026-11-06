---
search:
  boost: 0.575
---
# LoggingQueryRunner

A query runner that calls your logger with each statement and its result or error, and runs the statement with the query runner it wraps. Useful for debugging, measuring and auditing the statements. To carry data of your own between the call before a statement and the call after it, use [`InterceptorQueryRunner`](InterceptorQueryRunner.md).

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `LoggingQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

## Creating it

```ts
import { LoggingQueryRunner } from "ts-sql-query/queryRunners/LoggingQueryRunner";

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

The first argument of the constructor is an object that can define these functions, all of them optional:

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
- **`params: any[]`**: parameters received by the query.
- **`result: any`**: (only in `onQueryResult`) result of the execution of the query.
- **`error: any`**: (only in `onQueryError`) error that happened executing the query.
- **`timestamps`**: an object with `startedAt`, the time before the execution, and in `onQueryResult` and `onQueryError` also `endedAt`, the time after it. Both are a `bigint` in nanoseconds, counted from an arbitrary starting point: `endedAt - startedAt` is the duration.

!!! info

    When the driver begins and commits the transaction by itself, as `postgres` and Bun SQL do in `connection.transaction(...)`, fake `beginTransaction`, `commit`, and `rollback` operations will be emitted to allow you to see them in the log, with `startedAt` and `endedAt` at `0n`.
