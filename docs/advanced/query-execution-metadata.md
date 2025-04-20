---
search:
  boost: 0.7
---
# Query execution metadata

When you are implementing your own query runner, there is some metadata available about the query that is trying to be executed.

!!! tip

    These features are optional and are mainly intended for logging, debugging, or advanced monitoring purposes.

## Get the query execution stack

The `getQueryExecutionStack` will return a string with the stack trace where the query was requested to be executed and return `undefined` if the information is unavailable.

```ts
import { getQueryExecutionStack } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner, QueryType } from "ts-sql-query/queryRunners/InterceptorQueryRunner";

class DurationLogginQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): DurationPlayload {
        const stack: string | undefined = getQueryExecutionStack(query, params)
        console.log('query execution stack', stack)
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, playload: void): void {
        ...    
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, playload: void): void {
        ...
    }
}
```
 
**The stack strace will looks like**:

```
Error: Query executed at
    at CompoundSelectQueryBuilder.executeSelectMany (ts-sql-query/src/queryBuilders/SelectQueryBuilder.ts:187:24)
    at myFunction (myFolder/myFile.ts:112:10)
    at myOuterFunction (myFolder/myFile.ts:147:23)
    at ...
```

## Get the function that requested the query

The `getFunctionExecutingQuery` will return an object with information related to the function that requests to execute the query and return `undefined` if the information is unavailable. Each property can be `undefined` if that information is unavailable.

```ts
import { getFunctionExecutingQuery, FunctionExecutingQueryInformation } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner, QueryType } from "ts-sql-query/queryRunners/InterceptorQueryRunner";

class DurationLogginQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): DurationPlayload {
        const info : FunctionExecutingQueryInformation | undefined = getFunctionExecutingQuery(query, params)
        if (!info) {
            return
        }
        const functionName: string | undefined = info.functionName
        const fileName: string | undefined = info.fileName
        const lineNumber: string | undefined = info.lineNumber
        const positionNumber: string | undefined = info.positionNumber
        console.log('Name of the function where the query was requested to be executed', functionName)
        console.log('Name of the file where the query was requested to be executed', fileName)
        console.log('Line number where the query was requested to be executed', lineNumber)
        console.log('Position in the line where the query was requested to be executed', positionNumber)
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, playload: void): void {
        ...    
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, playload: void): void {
        ...
    }
}
```
 
**Properties of the returned object**:

- **functionName**: string with the function name that requested the execution of the query, `undefined` if that information is unavailable.
- **fileName**: string with the file name (including path) that requested the execution of the query, `undefined` if that information is unavailable.
- **lineNumber**: string with the line number in the file that requested the execution of the query, `undefined` if that information is unavailable.
- **positionNumber**: string with the position in the line that requested the execution of the query, `undefined` if that information is unavailable.

## Detect if the query is for select page count

The [Select page](../queries/select-page.md) is the only place where `ts-sql-query` executes a second query to return the count of elements. The function `isSelectPageCountQuery` allows you to identify if the requested query corresponds to the select count in a select page.

```ts
import { isSelectPageCountQuery } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner, QueryType } from "ts-sql-query/queryRunners/InterceptorQueryRunner";

class DurationLogginQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): DurationPlayload {
        const isCount: boolean = isSelectPageCountQuery(query, params)
        console.log('the query is a select count in a select page', isCount)
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, playload: void): void {
        ...    
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, playload: void): void {
        ...
    }
}
```

## Retrieve the execution name of a query

Before you execute a query, you can customize the query; in the customization possible, you can specify a property called `queryExecutionName` to put an informative name for that query execution. You can use the `getQueryExecutionName` to get that name (or `undefined` if it was not provided).

```ts
import { getQueryExecutionName } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner, QueryType } from "ts-sql-query/queryRunners/InterceptorQueryRunner";

class DurationLogginQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): DurationPlayload {
        const name: string | undefined = getQueryExecutionName(query, params)
        console.log('query execution name', name)
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, playload: void): void {
        ...    
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, playload: void): void {
        ...
    }
}
```

You can specify the informative name in this way:

```ts
const customizedSelect = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }).customizeQuery({
        queryExecutionName: 'My query name'
    })
    .executeSelectOne()
```

## Retrieve additional execution metadata

Before executing a query, you can customize it by specifying options using `queryExecutionMetadata` to put additional metadata for that query execution. You can use the `getQueryExecutionMetadata` to get that metadata (or `undefined` if it was not provided).

```ts
import { getQueryExecutionMetadata } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner, QueryType } from "ts-sql-query/queryRunners/InterceptorQueryRunner";

class DurationLogginQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): DurationPlayload {
        const metadata: unknown = getQueryExecutionMetadata(query, params)
        console.log('query execution metadata', metadata)
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, playload: void): void {
        ...    
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, playload: void): void {
        ...
    }
}
```

You can specify the metadata in this way:

```ts
const customizedSelect = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }).customizeQuery({
        queryExecutionMetadata: { myMetadataProp: 'my metadata value' }
    })
    .executeSelectOne()
```
