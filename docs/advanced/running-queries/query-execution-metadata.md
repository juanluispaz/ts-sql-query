---
search:
  boost: 0.7
---
# The context of a query

A query runner receives a query as its text and its parameters. To log or monitor it, you may want to know more: which query it is, where in your code it was executed, the type of each parameter or of each column of the result. The library keeps that for each query it builds in the **context of the query**, a `QueryContext`, which travels hidden with the parameters: it isn't sent to the database, and it doesn't show up when the parameters are listed, spread or serialised.

You read it with the function `getQueryContext(query, params)`, from `ts-sql-query`, in a query runner of your own, typically an [`InterceptorQueryRunner`](../../configuration/query-runners/general-purpose/InterceptorQueryRunner.md), or where you have no query runner, like in the function of a [`MockQueryRunner`](../../configuration/query-runners/general-purpose/MockQueryRunner.md). A statement you run through the query runner yourself has an empty context: every property is `undefined`, or `false`.

| You want | Read | It gives |
|---|---|---|
| The name you gave to the query | `executionName` | The name, or `undefined` |
| Other data you gave to the query | `executionMetadata` | What you gave, or `undefined` |
| Where in your code the query was executed, as text | `executionStack` | The stack trace, or `undefined` |
| The same, as an object | `executionSource` | A `QueryExecutionSource`, or `undefined` |
| The function that executed the query | `functionExecutingQuery` | An object with its name and position, or `undefined` |
| Whether it's the count query of a select page | `isSelectPageCount` | A `boolean` |
| What the library knows of a parameter | `getParam(index)` | A `QueryParamContext`, or `undefined` |
| The columns of the result, with the type of each one | `resultColumns` | An array of `QueryResultColumn`, or `undefined` |
| One column of the result, by its name in the row | `getResultColumn(name)` | A `QueryResultColumn`, or `undefined` |
| What a type adapter kept of the query, under its key | `getMetadata(key)` | What it kept, or `undefined` |
| The configuration of the connection that executes the query | `connectionConfiguration` | The connection, as a `ConnectionConfiguration`, or `undefined` |

Each execution of a query has its own context, also when the same query is executed again before the first execution ends. The context is read-only.


## Retrieve the execution name of a query

With `customizeQuery`, you can give a query a name in the property `queryExecutionName`. It doesn't change the SQL. `executionName` gives that name, or `undefined` if the query has none. Selects, inserts, updates and deletes have this option, and in a select page, both queries get the name.

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const name: string | undefined = getQueryContext(query, params).executionName
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

With `customizeQuery`, you can also give a query any data you want in the property `queryExecutionMetadata`, for example the area of your application it belongs to. `executionMetadata` gives that data, or `undefined` if the query has none.

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const metadata: unknown = getQueryContext(query, params).executionMetadata
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

`executionStack` gives a string with the stack trace of the place where the query was executed, or `undefined` if the information is unavailable.

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const stack: string | undefined = getQueryContext(query, params).executionStack
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

`executionSource` gives the same information as an object: a [`QueryExecutionSource`](../../api/error-management/typescript-types.md), an `Error` whose `stack` is that stack trace. It's the same object that a [`TsSqlQueryExecutionError`](../../api/error-management/typescript-types.md) has in its `source` property, and it's useful to give it to a tool that expects an error:

```ts
import { getQueryContext } from 'ts-sql-query';

function logQuerySource(query: string, params: any[]) {
    const source: Error | undefined = getQueryContext(query, params).executionSource
    console.log('query source', source)
}
```

## Get the function that requested the query

`functionExecutingQuery` gives an object with the function that executed the query and its position, taken from the stack trace, or `undefined` if the information is unavailable. Each property can be `undefined` too.

```ts
import type { FunctionExecutingQueryInformation } from 'ts-sql-query';
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const info : FunctionExecutingQueryInformation | undefined = getQueryContext(query, params).functionExecutingQuery
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

A [select page](../../queries/select-page.md) executes a second query to get the count of rows. `isSelectPageCount` is `true` for that query, for example to log it separately.

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const isCount: boolean = getQueryContext(query, params).isSelectPageCount
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

`getParam(index)` gives what the library knows of the parameter at that index of the parameters, a `QueryParamContext`, or `undefined` for a parameter of a statement you run through the query runner yourself:

| Property | What it is |
|---|---|
| `originalType` | The class of its original type, the one declared in the library, like `IntType` or the class of a type of yours; its `type` is the name of the type, like `'int'` |
| `requestedType` | The class of the type the parameter is sent with: the original one, unless the `transformValueToDB` of its type adapter or of the connection requested another with `setRequestedType`, like `StringType` for a date sent as its text (see [The original and the requested type](../data-types/type-adapters.md#the-original-and-the-requested-type)) |
| `forceTypeCast` | Whether the database must receive its type, because the position where it's written gives it none: the query runners of PostgreSQL then write a cast or send the parameter with its type |
| `isValueForColumn` | Whether it's the value given to a column of a table, in the values of an insert or in the set of an update, where the column gives it its type |
| `originalSqlDataType`, `requestedSqlDataType` | The type of the column in the database, when its type adapter says it ([`withSqlDataType`](../data-types/sql-data-types.md)): of the column it's given to or compared with; the requested one, the one it's sent with, unless the adapter requested another. `undefined` without one |
| `getMetadata(key)` | What a type adapter kept for the parameter under that `symbol`, or `undefined` |

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";
import type { DataTypeClass } from "ts-sql-query"

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const context = getQueryContext(query, params)
        for (let index = 0; index < params.length; index++) {
            const param = context.getParam(index)
            const originalType: DataTypeClass | undefined = param?.originalType
            const requestedType: DataTypeClass | undefined = param?.requestedType
            const forceTypeCast: boolean | undefined = param?.forceTypeCast
            const isValueForColumn: boolean | undefined = param?.isValueForColumn
            console.log('parameter', index, params[index], originalType?.type, requestedType?.type, forceTypeCast, isValueForColumn)
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

In `select $1::int4 as i from customer where id = $2`, with the parameters `[ 7, 10 ]`, the first parameter is an `IntType`, original and requested (its `type` is `'int'`), with `forceTypeCast` `true`: a constant selected on its own. The second is an `IntType` too, with `forceTypeCast` `false`: compared with the column `id`, it takes its type from it.

`isValueForColumn` is `true` for both parameters of `insert into customer (first_name, company_id) values ($1, $2)`, and `false` in a `where`, or anywhere else. The query runners of MariaDB, MySQL and SQL Server use it to leave an exact decimal without the cast they write elsewhere.

`getMetadata(key)` reads what a type adapter kept for the parameter with `context.setMetadata(key, value)`, in its `transformValueToDB`, under the `symbol` the adapter defines (see [Metadata of a query and its parameters](metadata.md)). The query runners of Oracle read the mark `OracleDateAsTimestampTypeAdapter` keeps to send its parameters as a `DATE`.

The library keeps all of this before it asks the query runner to add the parameter, so a query runner of your own has it without doing anything: its `addParam(params, value, type)` adds the value to `params` and returns the placeholder as it is written in the SQL, with the cast of the requested type if it writes one, reading the parameter in the context of the query at the index the value takes, and `addOutParam(params, name, type)` does the same for an out parameter. `type` is the type requested for the parameter, which the context has too. A query runner that wraps another passes all three on to it.

To add a parameter to SQL you write by hand, call `addParam` of the query runner with the type of the value: its class, or the name of a built-in or [registered](../../configuration/data-types.md#giving-your-type-by-its-name) type. The query runner sends it as a value of that type, as in a query of the library: a `localDate` on PostgreSQL goes as the text of the date, and a decimal on MySQL is cast to a decimal with its digits. With `undefined`, the query runner works the type out from the value, as the driver does. The cast a position needs is yours to write in the SQL.

```typescriptreact
const params: unknown[] = []
const day = queryRunner.addParam(params, new Date(Date.UTC(2024, 0, 15)), 'localDate')
const rows = await queryRunner.executeQuery('selectManyRows', `select id from customer where birthday = ${day}`, params)
```

## Get the type of each column of the result

The context of each query the library builds also has the columns of its result, in the order of its select list. `resultColumns` gives them as an array of `QueryResultColumn`, each with:

| Property | What it is |
|---|---|
| `name` | The key of the column in a row returned by the database. `''` when the SQL gives the column no alias: the count query of a select page, the id returned by `returningLastInsertedId`, the value of a function |
| `path` | The property of the result object it fills, like `'customer.name'` for a nested object, `'result'` for a query that selects one column, `''` without one |
| `originalType` | The class of the original type of its value, the one declared in the library, like `IntType` or the class of a type of yours; its `type` is the name of the type, like `'int'`. For an aggregated array, whose JSON text the library converts value by value, its `type` is `'aggregatedArray'` |
| `requestedType` | The class of the type of the value the database returns for the column: the one the `transformProjection` of its type adapter or of the connection requests with `setRequestedType`, like `StringType` for the text of a date (see [The original and the requested type](../data-types/type-adapters.md#the-original-and-the-requested-type)); otherwise the original one |

The array is empty for a query that returns no columns: an insert, update or delete without returning, a procedure, and the statements of a transaction. `resultColumns` is `undefined` for a statement you run through the query runner yourself. `getResultColumn(name)` finds one column by its `name`.

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType, QueryResultColumn } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const columns: readonly QueryResultColumn[] | undefined = getQueryContext(query, params).resultColumns
        for (const column of columns ?? []) {
            console.log('result column', column.name, column.path, column.originalType.type, column.requestedType.type)
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

The context of each query the library builds also has the connection that executes it, so a query runner can read its configuration. `connectionConfiguration` gives that connection, typed as `ConnectionConfiguration` (from `ts-sql-query`), or `undefined` for a statement you run through the query runner yourself. `ConnectionConfiguration` has every setting of the connection, like `allowEmptyString` or `insensitiveCollation`; a setting a database doesn't have is `undefined` on its connections. The ones that say what the database receives and returns are:

| Property | What it is |
|---|---|
| `compatibilityVersion` | The `compatibilityVersion` of the connection |
| `uuidStrategy` | The `uuidStrategy` of the connection, or `undefined` on the databases without one (PostgreSQL and SQL Server) |
| `getDateTimeFormat(type)` | On SQLite, the format a `'date'`, `'time'` or `'dateTime'` is stored with |
| `sqliteRunsInApplicationTimeZone`, `treatUnexpectedIntegerDateTimeAsJulian`, `treatUnexpectedStringDateTimeAsUTC`, `unexpectedUnixDateTimeAreMilliseconds` | On SQLite, how dates are stored and read |
| `sqlDataTypeFrom(nativeName)`, `nativeSqlDataTypeOf(sqlDataType)` | The conversion of the [SQL data types](../data-types/sql-data-types.md#the-types-of-a-database) of the connection: the native name of the `requestedSqlDataType` of a parameter in the database of the query, built once for each SQL data type |

The values are read from the connection when you read them, so a connection whose class sets `compatibilityVersion` in a field gives that value. All the queries of a connection give the same object: the connection.

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType, ConnectionConfiguration } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const configuration: ConnectionConfiguration | undefined = getQueryContext(query, params).connectionConfiguration
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

## Get what a type adapter kept of the query

`getMetadata(key)` of the context of the query reads what a type adapter kept of the whole query with `context.setQueryMetadata(key, value)`, while the query was built, under the `symbol` the adapter defines, or `undefined`. See [Metadata of a query and its parameters](metadata.md), with an example that writes and reads it.
