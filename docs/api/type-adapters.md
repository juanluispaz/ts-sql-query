---
search:
  boost: 0.3
---
# Type adapters API

This page documents the API for defining and customizing type adapters in `ts-sql-query`. Type adapters transform values when reading from or writing to the database, supporting use cases such as custom serialization, non-standard boolean mappings, and enforced type casting.

Type adapters control how values are serialized when writing to the database and deserialized when reading from it. They can be applied at the field level (when defining a table or view), or globally by overriding the `transformValueFromDB`, `transformValueToDB`, `transformPlaceholder`, `forceTypeCast` and `transformProjection` methods in the connection.

!!! info

    Type adapter definitions are in `ts-sql-query/TypeAdapter`, and they are also exported from `ts-sql-query`.

!!! tip

    The `CustomBooleanTypeAdapter` lets you define custom values to represent booleans when they don’t match the database's default boolean format. For example, a column might store `'yes'` for true and `'no'` for false instead of using standard boolean types. See [Custom booleans values](../advanced/custom-booleans-values.md) for more information.

Each transformation receives the name of the type and its category. The category is the first argument of the column, like `'customInt'` in `column('cost', 'customInt', 'Cents')`, or `''` when it isn't known. A custom type is converted as the type of its category (a `customInt` as an `int`, a `customLocalDate` as a `localDate`) unless its conversion is registered; an `enum`, a `custom` or a `customComparable` arrive as they come.

```typescript
type TypeCategory = 'boolean'
    | 'int' | 'bigint' | 'customInt' | 'customBigint'
    | 'double' | 'customDouble' | 'stringDecimal' | 'customDecimal'
    | 'string'
    | 'uuid' | 'customUuid'
    | 'localDate' | 'customLocalDate'
    | 'localTime' | 'customLocalTime'
    | 'localDateTime' | 'customLocalDateTime'
    | 'enum' | 'custom' | 'customComparable'
    | ''
```

```typescript
interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string
    forceTypeCast?(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean, next: DefaultTypeAdapter): boolean
    transformProjection?(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string
    projectionComparison?(type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): ProjectionComparison
    addQueryParamMetadata?(params: any[], index: number, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): void
}

type ProjectionOutput = 'resultColumn' | 'aggregatedArrayValue'

type ProjectionComparison = 'value' | 'equality' | 'columnEquality' | 'none'
```

- `transformPlaceholder` receives the placeholder as the query runner wrote it, like `$1` or `$1::int4`, and returns the one written in the SQL.
- `forceTypeCast` decides whether the database must receive the type of the parameter: it receives `true` where the position in the SQL gives the parameter no type, and returns the value to use. The query runner then writes a cast, like `$1::int4`, or sends the parameter with its type when the driver can. Only the PostgreSQL query runners use it.
- `transformProjection` receives the SQL of a value as it leaves the database, as the library writes it, and returns the SQL to write: `'resultColumn'` is a column of the result of the query (a column of the select that is executed or of the `returning` of an insert, an update or a delete, or the value of a function called), and `'aggregatedArrayValue'` is a value inside the JSON of an aggregated array, where it returns the SQL of a text that the library writes as a JSON string. `transformValueFromDB` reads what it gives. `next.transformProjection` writes the conversion of the library, which on SQL Server writes a decimal of a column of the result as its text; inside the JSON it has none. It adds no parameter, and when it doesn't convert the value it returns the SQL it receives. See [The SQL of a value read from the database](../configuration/column-types.md#the-sql-of-a-value-read-from-the-database).
- `projectionComparison` says how the SQL that `transformProjection` returns compares with the value, in the same `output`: `'value'`, it compares and orders like the value, and the query only has the converted SQL in place; `'equality'`, equal values give equal SQL and different values different SQL, but it orders otherwise, so the query orders by the value; `'columnEquality'`, as `'equality'` but only among the values of one column (the text of a decimal, whose scale is the one of its column), so the query also compares the value in a compound select; `'none'`, it neither compares nor orders like the value, so the query also compares the value in a distinct. Without it, `next.projectionComparison` answers for the conversion of the library: `'value'`, and `'columnEquality'` for a decimal of a column of the result on SQL Server. It isn't asked when `transformProjection` doesn't convert the value. See [How the converted SQL compares](../configuration/column-types.md#how-the-converted-sql-compares).
- `addQueryParamMetadata` keeps, for the query runner, what the adapter knows of a parameter, before the parameter is added at `index` of the `params`, after `transformValueToDB` (also for a `null`). It calls `setQueryParamMetadata(params, index, key, value)`, imported from `ts-sql-query` (or `ts-sql-query/TypeAdapter`), with a `symbol` of its own as the `key`, so it can't collide with anything else; the query runner reads it with `getQueryParamMetadata` (see [Query execution metadata](../advanced/query-execution-metadata.md#get-the-type-of-each-parameter)). The value isn't a parameter and isn't sent. `next.addQueryParamMetadata` keeps the one of the connection, which has none. `OracleDateAsTimestampTypeAdapter` uses it to have its parameters sent as a `DATE`.

```typescript
interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string
    projectionComparison(type: string, typeCategory: TypeCategory, output: ProjectionOutput): ProjectionComparison
    addQueryParamMetadata(params: any[], index: number, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): void
}
```

```typescript
class CustomBooleanTypeAdapter implements TypeAdapter {
    readonly trueValue: number | string
    readonly falseValue: number | string

    constructor(trueValue: number, falseValue: number)
    constructor(trueValue: string, falseValue: string)
    // CustomBooleanTypeAdapter's constructor implementation ...

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueToDB implementation ...
}
```

```typescript
class ForceTypeCast implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueToDB implementation ...

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string
    // ForceTypeCast's transformPlaceholder implementation ...

    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean, next: DefaultTypeAdapter): boolean
    // ForceTypeCast's forceTypeCast implementation ...
}
```

`ForceTypeCast` asks for the type of the parameter in every position, also where the library doesn't detect that PostgreSQL needs it. See [A position the library doesn't detect](../configuration/supported-databases/postgresql.md#a-position-the-library-doesnt-detect).

!!! tip

    You can create custom type adapters by implementing the `TypeAdapter` interface, giving you full control over how your application communicates with the database.
