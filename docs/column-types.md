# Column types

## Typing

ts-sql-query allows you to define the columns with the following types:

| Comunn type        | Typescript Type      | Extended type   | Description                                                       |
|--------------------|----------------------|-----------------|-------------------------------------------------------------------|
| `boolean`          | `boolean`            | `boolean`       | Boolean value                                                     |
| `stringInt`        | `string` or `number` | `stringInt`     | Integer number reprecented as number or string when it is too big |
| `int`              | `number`             | `int`           | Integer number                                                    |
| `bigint`           | `bigint`             | `bigint`        | BigInt number                                                     |
| `stringDouble`     | `string` or `number` | `stringDouble`  | Floating point number reprecented as number or string             |
| `double`           | `number`             | `double`        | Floating point number                                             |
| `string`           | `string`             | `string`        | String value                                                      |
| `localDate`        | `Date`               | `LocalDate`     | Date without time                                                 |
| `localTime`        | `Date`               | `LocalTime`     | Time without date                                                 |
| `localDateTime`    | `Date`               | `LocalDateTime` | Date with time                                                    |
| `enum`             | *custom*             | *custom*        | Enum value with custom type                                       |
| `custom`           | *custom*             | *custom*        | Custom equalable value                                            |
| `customComparable` | *custom*             | *custom*        | Custom comparable value                                           |

The extended types are defined in the [ts-extended-types](https://www.npmjs.com/package/ts-extended-types) package. Its types allow you to make your application even more type-safe and better represent the data structure handled by the database. To use these types, you must extend the type-safe variant of the connections defined at [Supported databases with extended types](./supported-databases-with-extended-types.md)

You can define a column with these types as indicated next:

```ts
this.column('ColumnName', 'boolean')
this.column('ColumnName', 'stringInt')
this.column('ColumnName', 'int')
this.column('ColumnName', 'bigint')
this.column('ColumnName', 'stringDouble')
this.column('ColumnName', 'double')
this.column('ColumnName', 'string')
this.column('ColumnName', 'localDate')
this.column('ColumnName', 'localTime')
this.column('ColumnName', 'localDateTime')
this.column<MyEnumType>('ColumnName', 'enum', 'MyEnumTypeName')
this.column<MyCustomType>('ColumnName', 'custom', 'MyCustomTypeName')
this.column<MyCustomComparableType>('ColumnName', 'customComparable', 'MyCustomComparableTypeName')
```

## Type adapters

You can control how a value is sent and received from the database. For that purpose, you can add at the end of the column definition a type adapter.

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
    public transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        if (type === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return {r: value[0], g: value[1], b: value[2]};
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return next.transformValueFromDB(value, type);
    }

    public transformValueToDB(value: RgbColor, type: string, next: DefaultTypeAdapter): unknown {
        if (type === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return next.transformValueToDB(value, type)
    }
}
```

And you can define the column as:

```ts
this.column<RgbColor>('ColumnName', 'custom', 'RgbColor', new RgbColorTypeAdapter())
```

**Important**:

- The type adapter handles all the values sending or coming from the database, including null/undefined values; you must handle it.
- The `type` param tells you what the expected type is; you must verify it and only process the value if it is the one you are applying the rule.
- The `next` gives you access to the default implementation; you must call if you cannot handle the type.

Type adapter is useful when you define a rule that only applies to that specific column, for example, the `CustomBooleanTypeAdapter` explained in the [Custom booleans values](../advanced-usage/#custom-booleans-values) section. For the `RgbColor` example, it is not specific for one field, them; it will be better to define the rule globally in the connection object as explained in the next section.

## Globally type adapter

The connection object can host the logic of the type adapter when we want to be able to use the type in any place. If you create a custom type that applies to the whole database, the connection is the best place to define the transformation rule.

```ts
interface RgbColor {r: number, g: number, b: number}

function isRgbColor(value: any): value is RgbColor {
    return typeof value === 'object'
        && typeof value.r === 'number'
        && typeof value.g === 'number'
        && typeof value.b === 'number'
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    transformValueFromDB(value: unknown, type: string) {
        if (type === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return { r: value[0], g: value[1], b: value[2] };
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return super.transformValueFromDB(value, type);
    }
    transformValueToDB(value: unknown, type: string) {
        if (type === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return super.transformValueToDB(value, type);
    }
}
```

And you can define the column as:

```ts
this.column<RgbColor>('ColumnName', 'custom', 'RgbColor')
```