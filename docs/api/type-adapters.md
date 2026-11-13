---
search:
  boost: 0.3
---
# Type adapters API

This page documents the API for defining and customizing type adapters in `ts-sql-query`. Type adapters transform values when reading from or writing to the database, supporting use cases such as custom serialization, non-standard boolean mappings, and enforced type casting.

Type adapters control how values are serialized when writing to the database and deserialized when reading from it. They can be applied at the field level (when defining a table or view), or globally by overriding the `transformValueFromDB`, `transformValueToDB`, `transformPlaceholder` and `transformProjection` methods in the connection.

!!! info

    Type adapter definitions are exported from `ts-sql-query`, and the one specific to Oracle, `OracleDateAsTimestampTypeAdapter`, from `ts-sql-query/oracle`.

!!! tip

    The `CustomBooleanTypeAdapter` lets you define custom values to represent booleans when they don’t match the database's default boolean format. For example, a column might store `'yes'` for true and `'no'` for false instead of using standard boolean types. See [Custom booleans values](../advanced/custom-booleans-values.md) for more information.

A type adapter has four transformations. Each one receives what it transforms and, before `next`, a context: what it is working on, where it says what else the library must know. `next` is the conversion of the library, the connection, and receives the same context.

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
- `transformProjection` receives the SQL of a value as it leaves the database, as the library writes it, and returns the SQL to write. Where the value leaves is the `output` of its context: `'resultColumn'` is a column of the result of the query (a column of the select that is executed or of the `returning` of an insert, an update or a delete, or the value of a function called), and `'aggregatedArrayValue'` is a value inside the JSON of an aggregated array, where it returns the SQL of a value of any type the JSON function of the database takes, and `transformValueFromDB` receives its text. `transformValueFromDB` reads what it gives. `next.transformProjection` writes the conversion of the library: on SQL Server a decimal of a column of the result as its text, and on PostgreSQL and Oracle, with a database outside UTC, a `localDateTime` or a `localTime` with its zone. It adds no parameter, and when it doesn't convert the value it returns the SQL it receives. See [The SQL of a value read from the database](../configuration/column-types.md#the-sql-of-a-value-read-from-the-database).

## The original and the requested type

A value has two types in the context, so that what was declared and what is sent or read never get confused:

- The **original type**, `originalType` and `originalCustomType`: the one declared in the library, like `column('released_on', 'customLocalDate', 'ReleaseDay')` or `const(1, 'int')`. It never changes.
- The **requested type**, `requestedType` and `requestedCustomType`: the type the value is communicated with to the query runner and the database. By default it is the original one. A transformation can request another with `setRequestedType`, and the next type adapter of the chain and the conversion of the library decide by the type requested. It can be requested again, and `resetRequestedType()` requests the original type again.

`originalType` and `requestedType` are the name of the type, like `'int'` or `'ReleaseDay'`. `originalCustomType` and `requestedCustomType` say which custom type it is, as a column declares it, and are `undefined` for a built-in type:

```typescript
type CustomType = 'customInt' | 'customBigint' | 'customDouble' | 'customDecimal'
    | 'customUuid'
    | 'customLocalDate' | 'customLocalTime' | 'customLocalDateTime'
    | 'enum' | 'custom' | 'customComparable'
```

A custom type is converted as the built-in type it is based on (a `customInt` as an `int`, a `customLocalDate` as a `localDate`) unless its conversion is registered; an `enum`, a `custom` or a `customComparable` arrive as they come.

`setRequestedType` takes a type as a column does: a built-in one by its name, like `setRequestedType('string')`, and a custom one with which custom type it is, like `setRequestedType('customLocalDate', 'ReleaseDay')`.

What the requested type is in each transformation:

| Transformation | The requested type is | Can request another |
|---|---|---|
| `transformValueToDB` | the type the value is sent with: the query runner sends the parameter as that type, with the cast or the type of the driver of that type | yes |
| `transformPlaceholder` | the type the value was sent with | no |
| `transformProjection` | the type of the value the SQL returned gives, which the query runner receives; it is read only when the SQL is converted | yes |
| `transformValueFromDB` | the type of the value received: the one `transformProjection` requested | yes, for what it gives `next` |

For example, on PostgreSQL, an adapter that sends a `ReleaseDay` as its text `DD/MM/YYYY` requests a `string`, so `next` checks a text and the query runner sends a text, and converts that text to a date where the placeholder is written:

```typescript
const dayMonthYear: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        if (value instanceof Date) {
            context.setRequestedType('string')
            const day = String(value.getUTCDate()).padStart(2, '0')
            const month = String(value.getUTCMonth() + 1).padStart(2, '0')
            return next.transformValueToDB(day + '/' + month + '/' + value.getUTCFullYear(), context)
        }
        return next.transformValueToDB(value, context)
    },
    transformPlaceholder(placeholder, context, next) {
        if (context.requestedType === 'string') {
            return 'to_date(' + placeholder + ", 'DD/MM/YYYY')"
        }
        return next.transformPlaceholder(placeholder, context)
    },
}
```

An adapter whose `transformProjection` requests a `string`, like the text of a date, receives that text in `transformValueFromDB`; when it gives `next` a value of the original type, it requests the original type again with `resetRequestedType()`.

## What each context has

```typescript
interface TypeAdapterContext {
    readonly connectionConfiguration: ConnectionConfiguration
    readonly originalType: string
    readonly originalCustomType: CustomType | undefined
    readonly requestedType: string
    readonly requestedCustomType: CustomType | undefined
}

interface TypeAdapterValueToDBContext extends TypeAdapterContext {
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime'): void
    setRequestedType(customType: CustomType, type: string): void
    resetRequestedType(): void
    forceTypeCast: boolean
    setMetadata(key: symbol, value: unknown): void
    getMetadata(key: symbol): unknown
}

interface TypeAdapterPlaceholderContext extends TypeAdapterContext {
    readonly index: number | undefined
    readonly valueSentToDB: unknown
    readonly forceTypeCast: boolean
    setMetadata(key: symbol, value: unknown): void
    getMetadata(key: symbol): unknown
}

interface TypeAdapterProjectionContext extends TypeAdapterContext {
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime'): void
    setRequestedType(customType: CustomType, type: string): void
    resetRequestedType(): void
    readonly output: ProjectionOutput
    comparison: ProjectionComparison
}

interface TypeAdapterValueFromDBContext extends TypeAdapterContext {
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime'): void
    setRequestedType(customType: CustomType, type: string): void
    resetRequestedType(): void
}
```

- `connectionConfiguration` is the configuration of the connection, the same the [context of the query](../advanced/query-execution-metadata.md#get-the-configuration-of-the-connection) has.
- `originalType`, `originalCustomType`, `requestedType`, `requestedCustomType`, `setRequestedType` and `resetRequestedType`: see [The original and the requested type](#the-original-and-the-requested-type).
- `forceTypeCast`, in `transformValueToDB`, says whether the database must receive the type of the parameter the value is sent in: it comes `true` where the position in the SQL gives the parameter no type, and the adapter can change it. The query runner then writes a cast of the requested type, like `$1::int4`, or sends the parameter with its type when the driver can. Only the PostgreSQL query runners use it. In `transformPlaceholder` it can only be read: the placeholder is already written.
- `setMetadata(key, value)` keeps, for the query runner, what the adapter knows of the parameter, under a `symbol` of its own as the `key`, so it can't collide with anything else; the query runner reads it in the context of the query, with `getParam(index)?.getMetadata(key)` (see [The context of a query](../advanced/query-execution-metadata.md#get-the-type-of-each-parameter)). It isn't a parameter and isn't sent. `OracleDateAsTimestampTypeAdapter` uses it to have its parameters sent as a `DATE`.
- `index`, in `transformPlaceholder`, is the position of the parameter, `undefined` when the placeholder is the literal `null`, and `valueSentToDB` the value `transformValueToDB` gave, `null` for the literal `null`.
- `output`, in `transformProjection`, is where the value leaves the database (see above).
- `comparison`, in `transformProjection`, says how the SQL it returns compares with the value: `'value'` (the default), it compares and orders like the value, and the query only has the converted SQL in place; `'equality'`, equal values give equal SQL and different values different SQL, but it orders otherwise, so the query orders by the value; `'columnEquality'`, as `'equality'` but only among the values of one column (the text of a decimal, whose scale is the one of its column), so the query also compares the value in a compound select; `'none'`, it neither compares nor orders like the value, so the query also compares the value in a distinct. The conversion of the library says `'columnEquality'` for a decimal of a column of the result on SQL Server. It's read only when the SQL is converted. See [How the converted SQL compares](../configuration/column-types.md#how-the-converted-sql-compares).
- In `transformProjection`, `setRequestedType` says the SQL returned gives a value of another type, like `setRequestedType('string')` for the text of a date. The query runner receives it in the [context of the query](../advanced/query-execution-metadata.md#get-the-type-of-each-column-of-the-result) (`requestedType`, `requestedCustomType`), and on Oracle the out parameter of the `returning` of the column is of that type; without it, of the type of the column.
- The library may call `transformValueToDB` only to look at a value, and `transformProjection` with an empty `sql` to know whether it converts the value: the context of that call is discarded, so a transformation must say the same whatever the `sql` it receives.

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
