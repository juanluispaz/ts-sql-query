# General purpose query runners

**Important**: A ts-sql-query connection object and the queries runners objects received as constructor's arguments represent a dedicated connection; consequently, don't share connections between requests when you are handling HTTP requests; create one connection object per request with its own query runners. Even when the ts-sql-query connection object uses a query runner that receives a connection pool, the ts-sql-query connection sill represents a dedicated connection to the database extracted automatically from the pool and must not be shared.

## ConsoleLogNoopQueryRunner

A fake connections that write all the queries to the standard output using `console.log` and returns an empty result.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogNoopQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogNoopQueryRunner";

async function main() {
    const connection = new DBConection(new ConsoleLogNoopQueryRunner());
    // Do your queries here
}
```

**Note**: `ConsoleLogNoopQueryRunner` supports synchronous query execution. See [Synchronous query runners](../../advanced-usage/#synchronous-query-runners) for more information.

## ConsoleLogQueryRunner

A query runner that write all the queries to the standard output using `console.log` and delegate the execution of the queries to the query runner received as argument in the constructor.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogQueryRunner";

async function main() {
    const connection = new DBConection(new ConsoleLogQueryRunner(otherQueryRunner));
    // Do your queries here
}
```

## LoggingQueryRunner

A query runner that intercept all the queries allowing you to log it and delegate the execution of the queries to the query runner received as second argument in the constructor.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { LoggingQueryRunner } from "ts-sql-query/queryRunners/LoggingQueryRunner";

async function main() {
    const connection = new DBConection(new LoggingQueryRunner({
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
}
```

The `LoggingQueryRunner` receives an object as first argument of the constructor that can define the following functions:

- **`onQuery`**: Executed before the query.
- **`onQueryResult`**: Executed after the successful execution of the query.
- **`onQueryError`**: Executed after the query in case of error.

All these functions receive as argument:

- **`type: QueryType`**: type of the query to be executed. The `QueryType` is defined as:

```ts
type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' | 
'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' | 'update' | 'delete' | 
'executeProcedure' | 'executeFunction' | 
'beginTransaction' | 'commit' | 'rollback' |
'executeDatabaseSchemaModification'
```

- **`query: string`**: query required to be executed, empty in the case of `beginTransaction`, `commit` or `rollback`
- **`params: any[]`**: parameters received by the query.
- **`result: any`**: (only in `onQueryResult`) result of the execution of the query.
- **`error: any`**: (only in `onQueryError`) error that happens executiong the query.

**Note**: `onQuery`, `onQueryResult` and `onQueryError` are optionals; you can defined only the method that you needs.

## MockQueryRunner

Mock connection that allows you inspect the queries and return the desired value as result of the query execution.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

async function main() {
    const connection = new DBConection(new MockQueryRunner(
        (type, query, params, index) => {
            // verify your queries here
        }
    ));

    // Do your queries here
}
```

The `MockQueryRunner` receives a function as argument to the constructor, this function returns the result of the query execution and receive as argument:

- **`type: QueryType`**: type of the query to be executed. The `QueryType` is defined as:

```ts
type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' | 
'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' | 'update' | 'delete' | 
'executeProcedure' | 'executeFunction' | 
'beginTransaction' | 'commit' | 'rollback' |
'executeDatabaseSchemaModification'
```

- **`query: string`**: query required to be executed
- **`params: any[]`**: parameters received by the query
- **`index: number`**: this is a counter of queries executed by the connection; that means, when the first query is executed the value is 0, when the second query is executed the value is 1, etc.

**Note**: `MockQueryRunner` supports synchronous query execution. See [Synchronous query runners](../../advanced-usage/#synchronous-query-runners) for more information.

## NoopQueryRunner

A fake connections that returns an empty result.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { NoopQueryRunner } from "ts-sql-query/queryRunners/NoopQueryRunner";

async function main() {
    const connection = new DBConection(new NoopQueryRunner());
    // Do your queries here
}
```

**Note**: `NoopQueryRunner` supports synchronous query execution. See [Synchronous query runners](../../advanced-usage/#synchronous-query-runners) for more information.