---
search:
  boost: 0.7
---
# The context of a query

A query runner receives a query as its text and its parameters. To log or monitor it, you may want to know more: which query it is, where in your code it was executed, the type of each parameter or of each column of the result. The library keeps that for each query it builds in the **context of the query**, a `QueryContext`, which travels hidden with the parameters: it isn't sent to the database, and it doesn't show up when the parameters are listed, spread or serialised.

You read it in a query runner of your own, typically an [`InterceptorQueryRunner`](../configuration/query-runners/general-purpose/InterceptorQueryRunner.md), with its method `this.getQueryContext(query, params)`. Where you have no query runner, like in the function of a [`MockQueryRunner`](../configuration/query-runners/general-purpose/MockQueryRunner.md), use the function `getQueryContext(query, params)`, from `ts-sql-query`: it gives the same. A statement you run through the query runner yourself has an empty context: every property is `undefined`, or `false`.

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
| The configuration of the connection that executes the query | `connectionConfiguration` | The connection, as a `ConnectionConfiguration`, or `undefined` |

Each execution of a query has its own context, also when the same query is executed again before the first execution ends. The context is read-only.


## Retrieve the execution name of a query

With `customizeQuery`, you can give a query a name in the property `queryExecutionName`. It doesn't change the SQL. `executionName` gives that name, or `undefined` if the query has none. Selects, inserts, updates and deletes have this option, and in a select page, both queries get the name.

```ts
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const name: string | undefined = this.getQueryContext(query, params).executionName
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
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const metadata: unknown = this.getQueryContext(query, params).executionMetadata
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
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const stack: string | undefined = this.getQueryContext(query, params).executionStack
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

`executionSource` gives the same information as an object: a [`QueryExecutionSource`](../api/error-management/typescript-types.md), an `Error` whose `stack` is that stack trace. It's the same object that a [`TsSqlQueryExecutionError`](../api/error-management/typescript-types.md) has in its `source` property, and it's useful to give it to a tool that expects an error:

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
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const info : FunctionExecutingQueryInformation | undefined = this.getQueryContext(query, params).functionExecutingQuery
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

A [select page](../queries/select-page.md) executes a second query to get the count of rows. `isSelectPageCount` is `true` for that query, for example to log it separately.

```ts
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const isCount: boolean = this.getQueryContext(query, params).isSelectPageCount
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
| `type` | The name of its type, like `'int'` or the one of a custom type |
| `typeCategory` | The category of that type, the first argument of the column, like `'customInt'` |
| `forceTypeCast` | Whether the database must receive its type, because the position where it's written gives it none: the query runners of PostgreSQL then write a cast or send the parameter with its type |
| `isValueForColumn` | Whether it's the value given to a column of a table, in the values of an insert or in the set of an update, where the column gives it its type |
| `getMetadata(key)` | What a type adapter kept for the parameter under that `symbol`, or `undefined` |

```ts
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType } from "ts-sql-query";
import type { TypeCategory } from "ts-sql-query"

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const context = this.getQueryContext(query, params)
        for (let index = 0; index < params.length; index++) {
            const param = context.getParam(index)
            const type: string | undefined = param?.type
            const typeCategory: TypeCategory | undefined = param?.typeCategory
            const forceTypeCast: boolean | undefined = param?.forceTypeCast
            const isValueForColumn: boolean | undefined = param?.isValueForColumn
            console.log('parameter', index, params[index], type, typeCategory, forceTypeCast, isValueForColumn)
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

`isValueForColumn` is `true` for both parameters of `insert into customer (first_name, company_id) values ($1, $2)`, and `false` in a `where`, or anywhere else. The query runners of MariaDB, MySQL and SQL Server use it to leave a `stringDecimal` or a `customDecimal` without the cast they write elsewhere.

`getMetadata(key)` reads what a type adapter kept for the parameter with `setQueryParamMetadata`, in its `addQueryParamMetadata` (see [Type adapters API](../api/type-adapters.md)), under the `symbol` the adapter defines. The query runners of Oracle read the mark `OracleDateAsTimestampTypeAdapter` keeps to send its parameters as a `DATE`.

The library keeps all of this before it asks the query runner to add the parameter, so a query runner of your own has it without doing anything: its `addParam(params, value, type, typeCategory, forceTypeCast)` adds the value to `params` and returns the placeholder as it is written in the SQL, with the cast if it writes one, and `addOutParam(params, name, type, typeCategory, forceTypeCast)` does the same for an out parameter. A query runner that wraps another passes them on to it.

## Get the type of each column of the result

The context of each query the library builds also has the columns of its result, in the order of its select list. `resultColumns` gives them as an array of `QueryResultColumn`, each with:

| Property | What it is |
|---|---|
| `name` | The key of the column in a row returned by the database. `''` when the SQL gives the column no alias: the count query of a select page, the id returned by `returningLastInsertedId`, the value of a function |
| `path` | The property of the result object it fills, like `'customer.name'` for a nested object, `'result'` for a query that selects one column, `''` without one |
| `type` | The name of the type its value is converted with, like `'int'` or the one of a custom type |
| `typeCategory` | The category of that type, like `'customInt'`; `''` for an aggregated array, whose JSON text the library converts value by value |

The array is empty for a query that returns no columns: an insert, update or delete without returning, a procedure, and the statements of a transaction. `resultColumns` is `undefined` for a statement you run through the query runner yourself. `getResultColumn(name)` finds one column by its `name`.

```ts
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType, QueryResultColumn } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const columns: readonly QueryResultColumn[] | undefined = this.getQueryContext(query, params).resultColumns
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

The context of each query the library builds also has the connection that executes it, so a query runner can read its configuration. `connectionConfiguration` gives that connection, typed as `ConnectionConfiguration` (from `ts-sql-query`), or `undefined` for a statement you run through the query runner yourself. `ConnectionConfiguration` has every setting of the connection, like `allowEmptyString` or `insensitiveCollation`; a setting a database doesn't have is `undefined` on its connections. The ones that say what the database receives and returns are:

| Property | What it is |
|---|---|
| `compatibilityVersion` | The `compatibilityVersion` of the connection |
| `uuidStrategy` | The `uuidStrategy` of the connection, or `undefined` on the databases without one (PostgreSQL and SQL Server) |
| `getDateTimeFormat(type)` | On SQLite, the format a `'date'`, `'time'` or `'dateTime'` is stored with |
| `sqliteRunsInApplicationTimeZone`, `treatUnexpectedIntegerDateTimeAsJulian`, `treatUnexpectedStringDateTimeAsUTC`, `unexpectedUnixDateTimeAreMilliseconds` | On SQLite, how dates are stored and read |

The values are read from the connection when you read them, so a connection whose class sets `compatibilityVersion` in a field gives that value. All the queries of a connection give the same object: the connection.

```ts
import { InterceptorQueryRunner } from "ts-sql-query";
import type { QueryType, ConnectionConfiguration } from "ts-sql-query";

class MetadataLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const configuration: ConnectionConfiguration | undefined = this.getQueryContext(query, params).connectionConfiguration
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
