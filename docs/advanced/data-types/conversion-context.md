---
search:
  boost: 0.5
---
# The context of a conversion

A value is converted by several steps on its way to the database and back: the type adapter of its column, the class of its data type, the type adapter of a type requested for it, and the connection. Each step receives, besides the value, a **context**: what the value is, what the step may change for the steps after it, and what it can tell the query runner. This page says what each step sees and when to use each part of the context. The list of every member is in [What each context has](../../api/type-adapters.md#what-each-context-has); writing the conversions themselves, in [Type adapters](type-adapters.md) and [A value of a class of yours](branded-and-opaque-types.md#a-value-of-a-class-of-yours).

## The steps and what each one sees

Every context has `originalType`, the class of the type declared for the value (its column, or the type given to `const`), and `requestedType`, the class of the type the value is sent or read as. They start equal; a step that calls `setRequestedType` before calling `next` changes `requestedType` for the steps after it (see [Requesting another type](#requesting-another-type)). Sending a value, the steps go in this order, each one calling the next:

1. the type adapter of the value (of its column, or given to `const`, `arg`, ...);
2. the class of its data type;
3. the type adapter of the requested type, when the type was requested with one (`setRequestedType(type, adapter)`);
4. the connection.

Reading a value, the calls go in the opposite order, and each step converts what `next` returns: the type adapter of the value calls the class, which calls the connection, which reads what the database gave. With a `MoneyType` like the one in [A value of a class of yours](branded-and-opaque-types.md#a-value-of-a-class-of-yours), which calls `setRequestedType('bigint')`, and a column that has a type adapter too:

| Step | `originalType` / `requestedType` it sees, sending | Reading, before `next` | Reading, after `next` |
|---|---|---|---|
| The type adapter of the column | `Money` / `Money` | `Money` / `Money` | `Money` / `bigint` |
| The class, `MoneyType` | `Money` / `Money`, and it requests `bigint` | `Money` / `Money`, and it requests `bigint` | `Money` / `bigint` |
| The connection | `Money` / `bigint` | `Money` / `bigint` | |

So the class works with the values of its own type, `Money`, and the connection, the last step, converts a `bigint`: what it checks and what it gives is what the class asked for. A step decides what the steps after it see, never the ones before it: sending, the type adapter of the column sees the type of the column, whatever the class requests; reading, it sees the requested type only once `next` has returned, when the value it receives is of that type.

The requested type is also the type the query runner sends the parameter with, and reads the column of the result as: it receives it in [the context of the query](../running-queries/query-execution-metadata.md#get-the-type-of-each-parameter) (`requestedType` of each parameter, and of each column of the result). See [The original and the requested type](type-adapters.md#the-original-and-the-requested-type) for an adapter that sends a date as its text.

## Requesting another type

A conversion that hands the value on as a value of another type says so with `context.setRequestedType(type)`, before calling `next`: a `Money` that goes and comes back as the `bigint` of its cents, a date sent and read as its text with `'string'`. The type goes by its name, like `'bigint'` or `'string'`, or by its class, like `StringType` or a class of yours. From then on, for the steps after it:

- The connection converts and checks the value as one of the requested type: it sends a `bigint`, and rejects what isn't one with `INVALID_VALUE_TO_SEND_TO_DATABASE`.
- The query runner sends the parameter with the requested type, like `$1::int8` where PostgreSQL needs it, and reads the column of the result as it; it receives it in [the context of the query](../running-queries/query-execution-metadata.md#get-the-type-of-each-parameter).
- `requestedType` in the context of each of them is the requested type; `originalType` doesn't change.

`setRequestedType(type, adapter)` requests it with a type adapter of its own, which converts between the two types: it goes just before the connection, whoever requested it, so the class of a data type always works with the values of its own type. `resetRequestedType()` takes the requested type back to the original one.

It can be requested in `transformValueToDB`, for the value sent; in `transformValueFromDB`, for the value read, before calling `next`; and in `transformProjection`, to say that the SQL it returns gives a value of another type, like the text of a date written with `to_char`. `transformPlaceholder` can't: the parameter is already sent. Each one requests its own: a value sent as a `bigint` is read as one only if `transformValueFromDB` requests it too.

The examples, what the requested type is in each transformation, and how to compare it, are in [The original and the requested type](type-adapters.md#the-original-and-the-requested-type).

## Asking the database for the type of a parameter

Some positions in a query give a parameter no type, like a constant selected on its own: the database can't tell what `$1` is. There, `forceTypeCast` comes `true` in `transformValueToDB`, and the query runner gives the parameter its requested type: `select $1::int8 as v` on PostgreSQL with `pg`, the requested type of a `Money` above. Where the position gives the type, like `priority = $1`, it comes `false`, and the SQL has no cast.

A type adapter can set it, to give a parameter its type where the query needs it and the library can't see it, like the argument of a function of the database that has a version for each type:

```ts
import { Table, type TypeAdapter } from "ts-sql-query"

// Sends the value with its type, written as a cast where the query runner writes one
const withItsType: TypeAdapter = {
    transformValueToDB(value, context, next) {
        context.forceTypeCast = true
        return next.transformValueToDB(value, context)
    },
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
}

const tIssue = new class TIssue extends Table<DBConnection, 'TIssue'> {
    id = this.primaryKey('id', 'int')
    priority = this.column('priority', 'int', withItsType)
    constructor() {
        super('issue')
    }
}()

const urgentIssues = await connection.selectFrom(tIssue)
    .where(tIssue.priority.equals(1))
    .select({ id: tIssue.id })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select id as id 
    from issue 
    where priority = ?
    ```
=== "MySQL"
    ```mysql
    select id as id 
    from issue 
    where priority = ?
    ```
=== "Oracle"
    ```oracle
    select id as "id" 
    from issue 
    where priority = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select id as id 
    from issue 
    where priority = $1::int4
    ```
=== "SQLite"
    ```sqlite
    select id as id 
    from issue 
    where priority = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select id as id 
    from issue 
    where priority = @0
    ```

The parameters are: `[ 1 ]`

Only the query runners of PostgreSQL read it: `pg` and Bun SQL write the cast in the SQL (`$1::int4`), and postgres.js and PGlite send the parameter with its type. The other databases receive the parameter as they always do.

## Writing the parameter in the SQL

`transformPlaceholder` receives the placeholder as the query runner wrote it, like `$1`, and returns the SQL that goes in its place, like `lower($1)`. Its context says which parameter it is: `index`, its position in the params, and `valueSentToDB`, the value `transformValueToDB` gave, after every step converted it (`3n` for the `new Money(3n)` above). A `null` is a parameter too, with `valueSentToDB` `null`; `index` is `undefined` only when the placeholder is the literal `null`, which has no parameter. `forceTypeCast` can only be read there: the placeholder is already written. `requestedType` is the type the value was sent as.

## Deciding by the configuration of the connection

`connectionConfiguration`, in every context, is the configuration of the connection that runs the query: the same object the query runner reads in [the context of the query](../running-queries/query-execution-metadata.md#get-the-configuration-of-the-connection), with what the connection says of itself, like `allowEmptyString`, `compatibilityVersion`, `insensitiveCollation` or `useUpperCaseUuid`. A conversion that must agree with how the connection treats a value reads it there, instead of keeping its own copy.

## Telling the query runner

What a conversion knows of a parameter, and the query runner needs to send it, goes in its metadata: `setMetadata(key, value)` in `transformValueToDB` or `transformPlaceholder`, under a `symbol` of its own, and the query runner reads it with `getQueryContext`. `setQueryMetadata` does the same for the whole query. See [Metadata of a query and its parameters](../running-queries/metadata.md).

## Calls that change nothing

The library may call `transformValueToDB` only to look at a value, and `transformProjection` with an empty `sql` only to know whether it converts the value: what those calls write in their context is discarded. So a conversion must do the same whatever the call, and never count on being called once: a step that calls `next` twice goes through the rest of the chain twice.

The context of the SQL of a value as it leaves the database, `output` and `comparison` in `transformProjection`, is in [The SQL of a value read from the database](type-adapters.md#the-sql-of-a-value-read-from-the-database).
