---
search:
  boost: 0.3
---
# Type adapters API

This page documents the API for defining and customizing type adapters in `ts-sql-query`. Type adapters transform values when reading from or writing to the database, supporting use cases such as custom serialization, non-standard boolean mappings, and enforced type casting.

Type adapters control how values are serialized when writing to the database and deserialized when reading from it. They can be applied at the field level (when defining a table or view), or globally by overriding the `transformValueFromDB`, `transformValueToDB`, `transformPlaceholder` and `forceTypeCast` methods in the connection.

!!! info

    Type adapter definitions are in `ts-sql-query/TypeAdapter`, and they are also exported from `ts-sql-query`.

!!! tip

    The `CustomBooleanTypeAdapter` lets you define custom values to represent booleans when they don’t match the database's default boolean format. For example, a column might store `'yes'` for true and `'no'` for false instead of using standard boolean types. See [Custom booleans values](../advanced/custom-booleans-values.md) for more information.

Each transformation receives the name of the type and its category. The category is the first argument of the column, like `'customInt'` in `column('cost', 'customInt', 'Cents')`, or `''` when it isn't known. A custom type is converted as the type of its category (a `customInt` as an `int`, a `customLocalDate` as a `localDate`) unless its conversion is registered; an `enum`, a `custom` or a `customComparable` arrive as they come.

```typescript
type TypeCategory = 'boolean'
    | 'int' | 'bigint' | 'customInt' | 'customBigint'
    | 'double' | 'customDouble'
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
}
```

- `transformPlaceholder` receives the placeholder as the query runner wrote it, like `$1` or `$1::int4`, and returns the one written in the SQL.
- `forceTypeCast` decides whether the database must receive the type of the parameter: it receives `true` where the position in the SQL gives the parameter no type, and returns the value to use. The query runner then writes a cast, like `$1::int4`, or sends the parameter with its type when the driver can. Only the PostgreSQL query runners use it.

```typescript
interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
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
