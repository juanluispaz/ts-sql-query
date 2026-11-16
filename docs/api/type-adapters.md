---
search:
  boost: 0.3
---
# Type adapters API

This page documents the API for defining and customizing type adapters in `ts-sql-query`. Type adapters transform values when reading from or writing to the database, supporting use cases such as custom serialization, non-standard boolean mappings, and enforced type casting.

Type adapters control how values are serialized when writing to the database and deserialized when reading from it. They can be applied at the field level (when defining a table or view), or globally by overriding the `transformValueFromDB`, `transformValueToDB`, `transformPlaceholder` and `transformProjection` methods in the connection.

To learn how to write a type adapter, where it goes and when to choose one, see [Type adapters](../advanced/type-adapters.md); for the data types it converts, [Data types](../configuration/data-types.md); for a boolean stored as other values, [Custom booleans values](../advanced/custom-booleans-values.md); and for what an adapter keeps for the query runner, [Metadata of a query and its parameters](../advanced/metadata.md). The type of the column in the database an adapter can say is in the [SQL data types API](sql-data-types.md).

!!! info

    Type adapter definitions are exported from `ts-sql-query`, and the one specific to Oracle, `OracleDateAsTimestampTypeAdapter`, from `ts-sql-query/oracle`.

!!! tip

    The `CustomBooleanTypeAdapter` lets you define custom values to represent booleans when they don’t match the database's default boolean format. For example, a column might store `'yes'` for true and `'no'` for false instead of using standard boolean types. See [Custom booleans values](../advanced/custom-booleans-values.md) for more information.

A type adapter has four transformations. Each one receives what it transforms and, before `next`, a context: what it is working on, where it says what else the library must know. `next` is the rest of the chain, the conversion of the library: the [conversion of the class of the data type](#the-conversion-of-the-class-of-a-data-type) and then the connection; it receives the same context.

```typescript
interface TypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string
    transformProjection?(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string
}

type ProjectionOutput = 'resultColumn' | 'aggregatedArrayValue'

type ProjectionComparison = 'value' | 'equality' | 'columnEquality' | 'none'
```

- `transformValueFromDB` converts a value read from the database, and `transformValueToDB` a value before it is sent.
- `transformPlaceholder` receives the placeholder as the query runner wrote it, like `$1` or `$1::int4`, and returns the one written in the SQL.
- `transformProjection` receives the SQL of a value as it leaves the database, as the library writes it, and returns the SQL to write. Where the value leaves is the `output` of its context: `'resultColumn'` is a column of the result of the query (a column of the select that is executed or of the `returning` of an insert, an update or a delete, or the value of a function called), and `'aggregatedArrayValue'` is a value inside the JSON of an aggregated array, where it returns the SQL of a value of any type the JSON function of the database takes, and `transformValueFromDB` receives its text. `transformValueFromDB` reads what it gives. `next.transformProjection` writes the conversion of the library: on SQL Server a decimal of a column of the result as its text, and on PostgreSQL and Oracle, with a database outside UTC, a `localDateTime` or a `localTime` with its zone. It adds no parameter, and when it doesn't convert the value it returns the SQL it receives. See [The SQL of a value read from the database](../advanced/type-adapters.md#the-sql-of-a-value-read-from-the-database).

## The original and the requested type

A value has two types in the context, so that what was declared and what is sent or read never get confused:

- The **original type**, `originalType`: the one declared in the library, like `column('released_on', ReleaseDayType)`, with `ReleaseDayType` a class that extends `LocalDatesType<ReleaseDay, 'ReleaseDay'>`, or `const(1, 'int')`. It never changes.
- The **requested type**, `requestedType`: the type the value is communicated with to the query runner and the database. By default it is the original one. A transformation can request another with `setRequestedType`, and the next type adapter of the chain and the conversion of the library decide by the type requested. It can be requested again, and `resetRequestedType()` requests the original type again.

`originalType` and `requestedType` are the class of the type, like `IntType` or `ReleaseDayType`. What the context reads of the class is `DataTypeClass`, exported from `ts-sql-query`: `type` is the name of the type, like `'int'` or `'ReleaseDay'`, and `sqlDataType` its type in the database, when it has one (see [SQL data types](../advanced/sql-data-types.md)):

```typescript
interface DataTypeClass {
    readonly type: string
    readonly sqlDataType?: SqlDataType | undefined
}
```

A type of yours is converted as its family says (see [Your own types](../configuration/data-types.md#your-own-types)) unless its conversion is registered.

Compare the type with its class, `context.requestedType === ReleaseDayType`, or its name, `context.requestedType.type === 'ReleaseDay'`. A comparison with a text, `context.requestedType === 'ReleaseDay'`, doesn't compile.

`setRequestedType` takes a type as a column does: a built-in one by its name or its class, like `setRequestedType('string')` or `setRequestedType(StringType)`, and one of yours by its class, like `setRequestedType(ReleaseDayType)`. With a type adapter, `setRequestedType(StringType, adapter)`, the value goes through that adapter just before the conversion of the connection, whoever requested it: once, and not the adapter already converting the value.

What the requested type is in each transformation:

| Transformation | The requested type is | Can request another |
|---|---|---|
| `transformValueToDB` | the type the value is sent with: the query runner sends the parameter as that type, with the cast or the type of the driver of that type | yes |
| `transformPlaceholder` | the type the value was sent with | no |
| `transformProjection` | the type of the value the SQL returned gives, which the query runner receives; it is read only when the SQL is converted | yes |
| `transformValueFromDB` | the type of the value received: the one `transformProjection` requested | yes, for what it gives `next` |

See [The original and the requested type](../advanced/type-adapters.md#the-original-and-the-requested-type) for an adapter that sends a date as its text, with its query and its SQL.

## The conversion of the class of a data type

The class of a data type converts the values of its type too, with the same four transformations as statics of the class, which by default convert nothing and call `next`:

```typescript
// The statics of BaseType, the class every data type extends
interface BaseTypeConversions {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string
}
```

A class that extends a data type overrides the ones it needs, with `static override`; a transformation of another shape doesn't compile. The conversion of a value is a chain, and each step calls `next` with what it gives the next one:

| Step | Sending a value | Reading a value |
|---|---|---|
| 1 | the type adapter of the value (of its column, or given to `const`, `arg`, ...) | the connection |
| 2 | the class of its data type | the type adapter of the requested type |
| 3 | the type adapter of the type requested with one (`setRequestedType(type, adapter)`) | the class of its data type |
| 4 | the connection | the type adapter of the value |

A step without the transformation is skipped (`transformPlaceholder` and `transformProjection` are optional in a type adapter). A step that calls `next` twice goes through the rest of the chain twice. The type adapter of a requested type goes just before the connection whoever requested it, so the class of the data type always works with the values of its type; the class of a requested type converts nothing: the type adapter that requests it is the one that gives `next` a value of that type.

## What each context has

Each transformation receives the context of what it works on. What each one has, and whether it can change it:

| Member | `transformValueToDB` | `transformPlaceholder` | `transformProjection` | `transformValueFromDB` |
|---|---|---|---|---|
| `connectionConfiguration` | reads | reads | reads | reads |
| `originalType` | reads | reads | reads | reads |
| `requestedType` | reads | reads | reads | reads |
| `setRequestedType`, `resetRequestedType` | changes | — | changes | changes |
| `forceTypeCast` | reads and changes | reads | — | — |
| `index`, `valueSentToDB` | — | reads | — | — |
| `setMetadata`, `getMetadata`, of the parameter | writes and reads | writes and reads | — | — |
| `setQueryMetadata`, `getQueryMetadata`, of the query | writes and reads | writes and reads | writes and reads | — |
| `output` | — | — | reads | — |
| `comparison` | — | — | reads and changes | — |

### In every context

- `connectionConfiguration` is the configuration of the connection, the same the [context of the query](../advanced/query-execution-metadata.md#get-the-configuration-of-the-connection) has.
- `originalType` is the class of the type declared for the value; `requestedType`, the class of the one requested for it, which `setRequestedType` changes and `resetRequestedType` takes back to the original: see [The original and the requested type](#the-original-and-the-requested-type).

### Of a parameter

- `forceTypeCast`, in `transformValueToDB`, says whether the database must receive the type of the parameter: it comes `true` where the position in the SQL gives the parameter no type, and the adapter can change it. The query runner then writes a cast of the requested type, like `$1::int4`, or sends the parameter with its type when the driver can. Only the PostgreSQL query runners use it. In `transformPlaceholder` it can only be read: the placeholder is already written.
- `index`, in `transformPlaceholder`, is the position of the parameter in the params, `undefined` when the placeholder is the literal `null`; `valueSentToDB` is the value `transformValueToDB` gave, `null` for the literal `null`.
- `setMetadata(key, value)` keeps, for the query runner, what the adapter knows of the parameter, under a `symbol` of its own; `getMetadata(key)` reads it back. See [Metadata of a query and its parameters](../advanced/metadata.md).

### Of the query

- `setQueryMetadata(key, value)` keeps, for the query runner, what the adapter knows of the whole query, under a `symbol` of its own; `getQueryMetadata(key)` reads it back. See [Metadata of a query and its parameters](../advanced/metadata.md).

### Of a projection

- `output` is where the value leaves the database: `'resultColumn'` or `'aggregatedArrayValue'` (see above).
- `comparison` says how the SQL returned compares with the value: `'value'` (the default) compares and orders like the value; `'equality'` compares like it but orders otherwise; `'columnEquality'`, as `'equality'` but only among the values of one column; `'none'` neither compares nor orders like it. The conversion of the library says `'columnEquality'` for a decimal of a column of the result on SQL Server. It's read only when the SQL is converted. See [How the converted SQL compares](../advanced/type-adapters.md#how-the-converted-sql-compares).
- `setRequestedType` says the SQL returned gives a value of another type, like `setRequestedType('string')` for the text of a date: the query runner receives it in the [context of the query](../advanced/query-execution-metadata.md#get-the-type-of-each-column-of-the-result), and on Oracle the out parameter of the `returning` of the column is of that type.

### Calls whose context is discarded

The library may call `transformValueToDB` only to look at a value, and `transformProjection` with an empty `sql` to know whether it converts the value: what those calls write in their context is discarded, so a transformation must say the same whatever the `sql` it receives.

### The interfaces

```typescript
interface TypeAdapterContext {
    readonly connectionConfiguration: ConnectionConfiguration
    readonly originalType: DataTypeClass
    readonly requestedType: DataTypeClass
}

interface TypeAdapterValueToDBContext extends TypeAdapterContext {
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime' | DataTypeClass): void
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime' | DataTypeClass, typeAdapter: TypeAdapter): void
    resetRequestedType(): void
    forceTypeCast: boolean
    setMetadata(key: symbol, value: unknown): void
    getMetadata(key: symbol): unknown
    setQueryMetadata(key: symbol, value: unknown): void
    getQueryMetadata(key: symbol): unknown
}

interface TypeAdapterPlaceholderContext extends TypeAdapterContext {
    readonly index: number | undefined
    readonly valueSentToDB: unknown
    readonly forceTypeCast: boolean
    setMetadata(key: symbol, value: unknown): void
    getMetadata(key: symbol): unknown
    setQueryMetadata(key: symbol, value: unknown): void
    getQueryMetadata(key: symbol): unknown
}

interface TypeAdapterProjectionContext extends TypeAdapterContext {
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime' | DataTypeClass): void
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime' | DataTypeClass, typeAdapter: TypeAdapter): void
    resetRequestedType(): void
    readonly output: ProjectionOutput
    comparison: ProjectionComparison
    setQueryMetadata(key: symbol, value: unknown): void
    getQueryMetadata(key: symbol): unknown
}

interface TypeAdapterValueFromDBContext extends TypeAdapterContext {
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime' | DataTypeClass): void
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime' | DataTypeClass, typeAdapter: TypeAdapter): void
    resetRequestedType(): void
}
```

```typescript
interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext): string
    transformProjection(sql: string, context: TypeAdapterProjectionContext): string
}
```

```typescript
class CustomBooleanTypeAdapter implements TypeAdapter {
    readonly trueValue: number | string
    readonly falseValue: number | string

    constructor(trueValue: number, falseValue: number)
    constructor(trueValue: string, falseValue: string)
    // CustomBooleanTypeAdapter's constructor implementation ...

    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueToDB implementation ...
}
```

```typescript
class ForceTypeCast implements TypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueToDB implementation ...
}
```

`ForceTypeCast` asks for the type of the parameter in every position, also where the library doesn't detect that PostgreSQL needs it. See [A position the library doesn't detect](../configuration/supported-databases/postgresql.md#a-position-the-library-doesnt-detect).

!!! tip

    You can create custom type adapters by implementing the `TypeAdapter` interface, giving you full control over how your application communicates with the database.
