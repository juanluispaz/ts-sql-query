---
search:
  boost: 0.3
---
# Type adpaters API

Type adapters allow customising how the values are sent and retrieved from the database, allowing to transform them. You can specify the type adapter per field when you define at the table or view; or, you can define general rules overriding the `transformValueFromDB` and `transformValueToDB`.

The `CustomBooleanTypeAdapter` allows defining custom values to express a boolean when they don't match the database's default values. For example, when you have a field in the database that is a boolean; but, the true value is represented with the string `yes`, and the false value is represented with the string `no`. See [Custom booleans values](../advanced/custom-booleans-values.md) for more information.

Type adapter definitions are in the file `ts-sql-query/TypeAdapter`.

```ts
interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string
}

interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string): unknown
    transformValueToDB(value: unknown, type: string): unknown
    transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown): string
}

class CustomBooleanTypeAdapter implements TypeAdapter {
    readonly trueValue: number | string
    readonly falseValue: number | string

    constructor(trueValue: number, falseValue: number)
    constructor(trueValue: string, falseValue: string)

    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
}

class ForceTypeCast implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformPlaceholder(placeholder: string, type: string, _forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string
}
```
