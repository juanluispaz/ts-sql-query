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
| The name of the type of a parameter | `getQueryParamType` | The name, like `'int'` or the one of a custom type, or `undefined` |
| The category of the type of a parameter | `getQueryParamTypeCategory` | A `TypeCategory`, like `'customInt'`, or `undefined` |
| Whether the database must receive the type of a parameter | `getQueryParamForceTypeCast` | A `boolean`, or `undefined` |
| Whether a parameter is the value given to a column in an insert or an update | `isQueryParamValueForColumn` | A `boolean` |
| The columns of the result, with the type of each one | `getQueryResultColumns` | An array of `QueryResultColumn`, or `undefined` |
| One column of the result, by its name in the row | `getQueryResultColumn` | A `QueryResultColumn`, or `undefined` |
| The configuration of the connection that executes the query | `getQueryConnectionConfiguration` | The connection, as a `ConnectionConfiguration`, or `undefined` |


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

## Get the type of each parameter

Each parameter of a query goes with the name of its type, the category of that type (the first argument of the column, like `'customInt'`), and whether the database must receive its type because the position where it's written gives it none (the query runners of PostgreSQL then write a cast or send the parameter with its type). `getQueryParamType`, `getQueryParamTypeCategory` and `getQueryParamForceTypeCast` read them for the parameter at an index, or return `undefined` for a parameter added without them, like one of a statement you run through the query runner yourself.

```ts
import { getQueryParamType, getQueryParamTypeCategory, getQueryParamForceTypeCast } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType } from "ts-sql-query/queryRunners/QueryRunner";
import type { TypeCategory } from "ts-sql-query" // or "ts-sql-query/TypeAdapter"

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        for (let index = 0; index < params.length; index++) {
            const type: string | undefined = getQueryParamType(query, params, index)
            const typeCategory: TypeCategory | undefined = getQueryParamTypeCategory(query, params, index)
            const forceTypeCast: boolean | undefined = getQueryParamForceTypeCast(query, params, index)
            console.log('parameter', index, params[index], type, typeCategory, forceTypeCast)
        }
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

In `select $1::int4 as i from customer where id = $2`, with the parameters `[ 7, 10 ]`, the first parameter is `'int'`, `'int'` and `true`: a constant selected on its own. The second is `'int'`, `'int'` and `false`: compared with the column `id`, it takes its type from it.

`isQueryParamValueForColumn(query, params, index)` says whether the parameter is the value given to a column of a table, in the values of an insert or in the set of an update, where the column gives it its type: in `insert into customer (first_name, company_id) values ($1, $2)` both are `true`; in a `where`, or anywhere else, `false`. The query runners of MariaDB, MySQL and SQL Server use it to leave a `stringDecimal` or a `customDecimal` without the cast they write elsewhere.

A query runner of your own that adds the parameters keeps this information. Its `addParam(params, value, type, typeCategory, forceTypeCast)` adds the value to `params`, calls `setQueryParamType(params, index, type, typeCategory, forceTypeCast)` from `ts-sql-query/queryRunners/QueryRunner` with the index of the value, and returns the placeholder as it is written in the SQL, with the cast if it writes one; `addOutParam(params, name, type, typeCategory, forceTypeCast)` does the same for an out parameter. A query runner that wraps another passes all of them on to it.

## Get the type of each column of the result

Each query the library builds also goes with the columns of its result, in the order of its select list. `getQueryResultColumns` returns them as an array of `QueryResultColumn`, each with:

| Property | What it is |
|---|---|
| `name` | The key of the column in a row returned by the database. `''` when the SQL gives the column no alias: the count query of a select page, the id returned by `returningLastInsertedId`, the value of a function |
| `path` | The property of the result object it fills, like `'customer.name'` for a nested object, `'result'` for a query that selects one column, `''` without one |
| `type` | The name of the type its value is converted with, like `'int'` or the one of a custom type |
| `typeCategory` | The category of that type, like `'customInt'`; `''` for an aggregated array, whose JSON text the library converts value by value |

The array is empty for a query that returns no columns: an insert, update or delete without returning, a procedure, and the statements of a transaction. `getQueryResultColumns` returns `undefined` for a statement you run through the query runner yourself. `getQueryResultColumn` finds one column by its `name`.

```ts
import { getQueryResultColumns } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType, QueryResultColumn } from "ts-sql-query/queryRunners/QueryRunner";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const columns: readonly QueryResultColumn[] | undefined = getQueryResultColumns(query, params)
        for (const column of columns ?? []) {
            console.log('result column', column.name, column.path, column.type, column.typeCategory)
        }
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

In `select id as id, first_name || $1 || last_name as name, birthday as birthday from customer where id = $2`, the columns are `id` (`'int'`, `'int'`), `name` (`'string'`, `'string'`) and `birthday` (`'localDate'`, `'localDate'`), each with the same `name` and `path`. The `name` is the alias as the database returns it. On PostgreSQL, an alias longer than 63 bytes is written shortened, and the `name` is that shortened alias, while `path` keeps the property.

A row can have more keys than the columns, when a `customizeQuery({ beforeColumns })` fragment adds columns of its own.

## Get the configuration of the connection

Each query the library builds also goes with the connection that executes it, so a query runner can read its configuration. `getQueryConnectionConfiguration` returns that connection, typed as `ConnectionConfiguration` (from `ts-sql-query/queryRunners/QueryRunner`), or `undefined` for a statement you run through the query runner yourself. `ConnectionConfiguration` has every setting of the connection, like `allowEmptyString` or `insensitiveCollation`; a setting a database doesn't have is `undefined` on its connections. The ones that say what the database receives and returns are:

| Property | What it is |
|---|---|
| `compatibilityVersion` | The `compatibilityVersion` of the connection |
| `uuidStrategy` | The `uuidStrategy` of the connection, or `undefined` on the databases without one (PostgreSQL and SQL Server) |
| `getDateTimeFormat(type)` | On SQLite, the format a `'date'`, `'time'` or `'dateTime'` is stored with |
| `sqliteRunsInApplicationTimeZone`, `treatUnexpectedIntegerDateTimeAsJulian`, `treatUnexpectedStringDateTimeAsUTC`, `unexpectedUnixDateTimeAreMilliseconds` | On SQLite, how dates are stored and read |

The values are read from the connection when you read them, so a connection whose class sets `compatibilityVersion` in a field gives that value. All the queries of a connection give the same object: the connection.

```ts
import { getQueryConnectionConfiguration } from 'ts-sql-query/queryRunners/QueryRunner';
import { InterceptorQueryRunner } from "ts-sql-query/queryRunners/InterceptorQueryRunner";
import type { QueryType, ConnectionConfiguration } from "ts-sql-query/queryRunners/QueryRunner";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const configuration: ConnectionConfiguration | undefined = getQueryConnectionConfiguration(query, params)
        if (configuration) {
            console.log('connection', this.database, configuration.compatibilityVersion, configuration.uuidStrategy)
            console.log('date-time format', configuration.getDateTimeFormat?.('dateTime'))
        }
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

On a SQLite connection whose class declares `protected override compatibilityVersion = 3_030_000`, with no other setting, the configuration gives `3030000` and `'uuid-extension'`, and `getDateTimeFormat('dateTime')` gives `'localdate milliseconds as text'`.
