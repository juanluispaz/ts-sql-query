---
search:
  boost: 0.575
---
# LoggingQueryRunner

A general-purpose query runner that intercepts all queries and delegates their execution to another query runner while allowing you to log query details. Useful for debugging, performance monitoring, and auditing executed statements.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `LoggingQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { LoggingQueryRunner } from "ts-sql-query/queryRunners/LoggingQueryRunner";

async function main() {
    const connection = new DBConnection(new LoggingQueryRunner({
        onQuery(queryType, query, params) {
            console.log('onQuery', queryType, query, params, { startedAt })
        },
        onQueryResult(queryType, query, params, result) {
            console.log('onQueryResult', queryType, query, params, result, { startedAt, endedAt })
        },
        onQueryError(queryType, query, params, error) {
            console.log('onQueryError', queryType, query, params, error, { startedAt, endedAt })
        }
    }, otherQueryRunner));
    // Do your queries here
}
```

## API Overview

The `LoggingQueryRunner` receives an object as first argument of the constructor that can define the following functions:

- **`onQuery`**: Executed before the query.
- **`onQueryResult`**: Executed after the successful execution of the query.
- **`onQueryError`**: Executed after the query in case of error.

All these functions receive as argument:

- **`type: QueryType`**: type of the query to be executed. The `QueryType` is defined as:

```ts
type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' |
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' |
    'insertReturningOneRow' | 'insertReturningManyRows' | 'insertReturningOneColumnOneRow' | 'insertReturningOneColumnManyRows' |
    'update' | 'updateReturningOneRow' | 'updateReturningManyRows' | 'updateReturningOneColumnOneRow' | 'updateReturningOneColumnManyRows' |
    'delete' | 'deleteReturningOneRow' | 'deleteReturningManyRows' | 'deleteReturningOneColumnOneRow' | 'deleteReturningOneColumnManyRows' |
    'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' | 
    'executeDatabaseSchemaModification' | 'executeConnectionConfiguration'
```

- **`query: string`**: query required to be executed, empty in the case of `beginTransaction`, `commit` or `rollback`
- **`params: any[]`**: parameters received by the query.
- **`result: any`**: (only in `onQueryResult`) result of the execution of the query.
- **`error: any`**: (only in `onQueryError`) error that happens executing the query.
- **`startedAt`**: elapsed time value in nanoseconds before the query execution.
- **`endedAt`**: (only in `onQueryResult` or  `onQueryError`) elapsed time value in nanoseconds after the query execution.

!!! info

    - `onQuery`, `onQueryResult`, and `onQueryError` are optional; you can define only the methods that you need.
    - In case the provided query runner doesn't support low-level transaction management, fake `beginTransaction`, `commit`, and `rollback` operations will be emitted to allow you to see them in the log.
