---
search:
  boost: 0.575
---
# InterceptorQueryRunner

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

A query runner that intercept all the queries and delegate the execution of the queries to the query runner received as second argument in the constructor.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { QueryType } from "ts-sql-query/queryRunners/QueryRunner";
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";

interface DurationPlayload {
    startTime: number
}
class DurationLogginQueryRunner extends InterceptorQueryRunner<DurationPlayload> {
    onQuery(queryType: QueryType, query: string, params: any[]): DurationPlayload {
        console.log('onQuery', queryType, query, params)
        return { startTime: Date.now() }
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, playload: DurationPlayload): void {
        const duration = Date.now() - playload.startTime
        console.log('onQueryResult', queryType, query, params, result, duration)
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, playload: DurationPlayload): void {
        const duration = Date.now() - playload.startTime
        console.log('onQueryError', queryType, query, params, error, duration)
    }
}

async function main() {
    const connection = new DBConnection(new DurationLogginQueryRunner(otherQueryRunner));
    // Do your queries here
}
```

The `InterceptorQueryRunner` is an abstract class where you must implement the following functions:

- **`onQuery`**: Executed before the query. This function returns the playload data that will be recived by the next functions.
- **`onQueryResult`**: Executed after the successful execution of the query. Receives as last argument the playload data created by the `onQuery` method.
- **`onQueryError`**: Executed after the query in case of error. Receives as last argument the playload data created by the `onQuery` method.

This class receives as the first generic type the playload type created when the query execution starts and receives when the query execution ends

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
- **`error: any`**: (only in `onQueryError`) error that happens executiong the query.
- **`playload: PLAYLOAD_TYPE`**:  (only in `onQueryResult` or `onQueryError`) playload data created by the `onQuery` function.

!!! info

    In case the provided query runner doesn't support low-level transaction management, fake `beginTransaction`, `commit`, and `rollback` will be emitted to allow you to identify them.
