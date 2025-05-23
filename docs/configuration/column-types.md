---
search:
  boost: 0.55
---
# Column types

This page describes how to define and configure the types of columns used in your tables when building a schema with `ts-sql-query`. It covers the predefined types, how to use custom types, and how to adapt values when interacting with the database.

## Typing

The following table lists the available column types you can assign, along with their corresponding TypeScript representation and general purpose.

`ts-sql-query` allows you to define the columns with the following types:

| Column type                     | TypeScript Type      | Description                                                       |
|---------------------------------|----------------------|-------------------------------------------------------------------|
| `boolean`                       | `boolean`            | Boolean value                                                     |
| `int`                           | `number`             | Integer number                                                    |
| `bigint`                        | `bigint`             | BigInt number                                                     |
| `double`                        | `number`             | Floating point number                                             |
| `string`                        | `string`             | String value                                                      |
| `uuid`                          | `string`             | UUID value                                                        |
| `localDate`                     | `Date`               | Date without time                                                 |
| `localTime`                     | `Date`               | Time without date                                                 |
| `localDateTime`                 | `Date`               | Date with time                                                    |
| `customInt`                     | *custom*             | Int value using a custom type                                     |
| `customDouble`                  | *custom*             | Double value using a custom type                                  |
| `customUuid`                    | *custom*             | UUID value using a custom type                                    |
| `customLocalDate`               | *custom*             | Date value using a custom type                                    |
| `customLocalTime`               | *custom*             | Time value using a custom type                                    |
| `customLocalDateTime`           | *custom*             | Date with time value using a custom type                          |
| `enum`                          | *custom*             | Enum value using a custom type                                    |
| `custom`                        | *custom*             | Custom equalable value                                            |
| `customComparable`              | *custom*             | Custom comparable value                                           |

You can define a column with these types as indicated next:

```ts
this.column('ColumnName', 'boolean')
this.column('ColumnName', 'int')
this.column('ColumnName', 'bigint')
this.column('ColumnName', 'double')
this.column('ColumnName', 'string')
this.column('ColumnName', 'uuid')
this.column('ColumnName', 'localDate')
this.column('ColumnName', 'localTime')
this.column('ColumnName', 'localDateTime')
this.column<MyIntType>('ColumnName', 'customInt', 'MyIntTypeName')
this.column<MyDoubleType>('ColumnName', 'customDouble', 'MyDoubleTypeName')
this.column<MyUuidType>('ColumnName', 'customUuid', 'MyUuidTypeName')
this.column<MyDateType>('ColumnName', 'customLocalDate', 'MyDateTypeName')
this.column<MyTimeType>('ColumnName', 'customLocalTime', 'MyTimeTypeName')
this.column<MyDateTimeType>('ColumnName', 'customLocalDateTime', 'MyDateTimeTypeName')
this.column<MyEnumType>('ColumnName', 'enum', 'MyEnumTypeName')
this.column<MyCustomType>('ColumnName', 'custom', 'MyCustomTypeName')
this.column<MyCustomComparableType>('ColumnName', 'customComparable', 'MyCustomComparableTypeName')
```

## Type adapters

You can control how a value is sent and received from the database. For that purpose, you can add a type adapter at the end of the column definition.

**Example**: Imagine you want to store an RGB colour as a single number in the database, but in your application, you want to handle it as an object with R, G & B properties as a number. You can define a type adapter as:

```ts
import { DefaultTypeAdapter, TypeAdapter } from "ts-sql-query/TypeAdapter"

interface RgbColor {r: number, g: number, b: number}

function isRgbColor(value: any): value is RgbColor {
    return typeof value === 'object'
        && typeof value.r === 'number'
        && typeof value.g === 'number'
        && typeof value.b === 'number'
}

export class RgbColorTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        if (type === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return {r: value[0], g: value[1], b: value[2]};
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return next.transformValueFromDB(value, type);
    }

    transformValueToDB(value: RgbColor, type: string, next: DefaultTypeAdapter): unknown {
        if (type === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return next.transformValueToDB(value, type)
    }

    // Optional
    transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        // You can force a type cast in the query if you want. With this code, the parameter in the SQL will looks like %1::bytea
        // By default, in PostgreSQL only, a type cast is generated when forceTypeCast is true
        if (type === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return next.transformPlaceholder(placeholder, type, forceTypeCast, valueSentToDB)
    }
}
```

And you can define the column as:

```ts
this.column<RgbColor>('ColumnName', 'custom', 'RgbColor', new RgbColorTypeAdapter())
```

!!! important

    - The type adapter handles all the values sending or coming from the database, including null/undefined values; you must handle it.
    - The `type` param tells you what the expected type is; you must verify it and only process the value if it is the one you are applying the rule.
    - The `next` gives you access to the default implementation; you must call if you cannot handle the type.

!!! tip

    Use a column-specific type adapter when the transformation logic only applies to a single field — for example, the `CustomBooleanTypeAdapter` used in the [Custom boolean values](../advanced/custom-booleans-values.md) section, where a specific column may store booleans as `'Y'`/`'N'`.

    However, when the transformation is generic and applicable to many columns or tables — such as with the `RgbColor` example — it's better to define the adapter globally in the connection object. This improves consistency and avoids repeating the logic for every field.

## Global type adapter

When a type adapter should apply globally across all uses of a type, the logic can be embedded in the connection object:

!!! tip

    This is the recommended approach when the same logic should apply across multiple columns or tables, ensuring consistency and avoiding duplication of logic in each column definition.

```ts
interface RgbColor {r: number, g: number, b: number}

function isRgbColor(value: any): value is RgbColor {
    return typeof value === 'object'
        && typeof value.r === 'number'
        && typeof value.g === 'number'
        && typeof value.b === 'number'
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected transformValueFromDB(value: unknown, type: string) {
        if (type === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return { r: value[0], g: value[1], b: value[2] };
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return super.transformValueFromDB(value, type);
    }
    protected transformValueToDB(value: unknown, type: string) {
        if (type === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return super.transformValueToDB(value, type);
    }   
    protected transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown): string {
        // You can force a type cast in the query if you want. With this code, the parameter in the SQL will looks like %1::bytea
        // By thefault, in PostgreSql only, a type cast is generated when forceTypeCast is true
        if (type === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return super.transformPlaceholder(placeholder, type, forceTypeCast, valueSentToDB)
    }
}
```

And you can define the column as:

```ts
this.column<RgbColor>('ColumnName', 'custom', 'RgbColor')
```
