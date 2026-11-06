---
search:
  boost: 0.7
---
# Query execution metadata

A query runner receives a query as its text and its parameters. To log or monitor it, you may want to know more: which query it is, or where in your code it was executed. These functions, in `ts-sql-query/queryRunners/QueryRunner`, receive the text and the parameters and give that information. You call them in a query runner of your own, typically an [`InterceptorQueryRunner`](../configuration/query-runners/general-purpose/InterceptorQueryRunner.md).

| You want | Use | Returns |
|---|---|---|
| The name you gave to the query | `getQueryExecutionName` | The name, or `undefined` |
| Other data you gave to the query | `getQueryExecutionMetadata` | What you gave, or `undefined` |
| Where in your code the query was executed, as text | `getQueryExecutionStack` | The stack trace, or `undefined` |
| The same, as an object | `getQueryExecutionSource` | A `QueryExecutionSource`, or `undefined` |
| The function that executed the query | `getFunctionExecutingQuery` | An object with its name and position, or `undefined` |
| Whether it's the count query of a select page | `isSelectPageCountQuery` | A `boolean` |


## Retrieve the execution name of a query

With `customizeQuery`, you can give a query a name in the property `queryExecutionName`. It doesn't change the SQL. `getQueryExecutionName` returns that name, or `undefined` if the query has none. Selects, inserts, updates and deletes have this option, and in a select page, both queries get the name.

```ts
import { getQueryExecutionName } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType } from "ts-sql-query/queryRunners/QueryRunner";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const name: string | undefined = getQueryExecutionName(query, params)
        console.log('query execution name', name)
        // Additional information
        console.log('query type', queryType)
    }
    onQueryResult(): void {
        // Your MetadataLoggingQueryRunner's onQueryResult implementation ...
    }
    onQueryError(): void {
        // Your MetadataLoggingQueryRunner's onQueryError implementation ...
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

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

## Retrieve additional execution metadata

With `customizeQuery`, you can also give a query any data you want in the property `queryExecutionMetadata`, for example the area of your application it belongs to. `getQueryExecutionMetadata` returns that data, or `undefined` if the query has none.

```ts
import { getQueryExecutionMetadata } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType } from "ts-sql-query/queryRunners/QueryRunner";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const metadata: unknown = getQueryExecutionMetadata(query, params)
        console.log('query execution metadata', metadata)
        // Additional information
        console.log('query type', queryType)
    }
    onQueryResult(): void {
        // Your MetadataLoggingQueryRunner's onQueryResult implementation ...
    }
    onQueryError(): void {
        // Your MetadataLoggingQueryRunner's onQueryError implementation ...
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

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

## Get the query execution stack

`getQueryExecutionStack` returns a string with the stack trace of the place where the query was executed, or `undefined` if the information is unavailable.

```ts
import { getQueryExecutionStack } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType } from "ts-sql-query/queryRunners/QueryRunner";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const stack: string | undefined = getQueryExecutionStack(query, params)
        console.log('query execution stack', stack)
        // Additional information
        console.log('query type', queryType)
    }
    onQueryResult(): void {
        // Your MetadataLoggingQueryRunner's onQueryResult implementation ...
    }
    onQueryError(): void {
        // Your MetadataLoggingQueryRunner's onQueryError implementation ...
    }
}
```
 
**The stack trace will look like**:

```
Query executed at
    at CompoundSelectQueryBuilder.executeSelectMany (ts-sql-query/src/queryBuilders/SelectQueryBuilder.ts:187:24)
    at myFunction (myFolder/myFile.ts:112:10)
    at myOuterFunction (myFolder/myFile.ts:147:23)
    at ...
```

`getQueryExecutionSource` gives the same information as an object: a [`QueryExecutionSource`](../api/error-management/typescript-types.md), an `Error` whose `stack` is that stack trace. It's the same object that a [`TsSqlQueryExecutionError`](../api/error-management/typescript-types.md) has in its `source` property, and it's useful to give it to a tool that expects an error:

```ts
import { getQueryExecutionSource } from 'ts-sql-query/queryRunners/QueryRunner';

function logQuerySource(query: string, params: any[]) {
    const source: Error | undefined = getQueryExecutionSource(query, params)
    console.log('query source', source)
}
```

## Get the function that requested the query

`getFunctionExecutingQuery` returns an object with the function that executed the query and its position, taken from the stack trace, or `undefined` if the information is unavailable. Each property can be `undefined` too.

```ts
import { getFunctionExecutingQuery, FunctionExecutingQueryInformation } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType } from "ts-sql-query/queryRunners/QueryRunner";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
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
        // Additional information
        console.log('query type', queryType)
    }
    onQueryResult(): void {
        // Your MetadataLoggingQueryRunner's onQueryResult implementation ...
    }
    onQueryError(): void {
        // Your MetadataLoggingQueryRunner's onQueryError implementation ...
    }
}
```
 
**Properties of the returned object**:

- **functionName**: the name of the function.
- **fileName**: the name of the file, including its path.
- **lineNumber**: the line in the file, as a string.
- **positionNumber**: the position in the line, as a string.

## Detect if the query is for select page count

A [select page](../queries/select-page.md) executes a second query to get the count of rows. `isSelectPageCountQuery` returns `true` for that query, for example to log it separately.

```ts
import { isSelectPageCountQuery } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType } from "ts-sql-query/queryRunners/QueryRunner";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const isCount: boolean = isSelectPageCountQuery(query, params)
        console.log('the query is a select count in a select page', isCount)
        // Additional information
        console.log('query type', queryType)
    }
    onQueryResult(): void {
        // Your MetadataLoggingQueryRunner's onQueryResult implementation ...
    }
    onQueryError(): void {
        // Your MetadataLoggingQueryRunner's onQueryError implementation ...
    }
}
```
