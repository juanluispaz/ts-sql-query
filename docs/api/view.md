---
search:
  boost: 0.3
---
# View API

This API defines the structure of database views within `ts-sql-query`. It provides methods to declare the columns exposed by the view, including their types and nullability. Although views are read-only and do not support insertions or updates, their column definitions are used internally by queries to ensure type safety and to generate valid SQL statements.

To learn how to declare a view and its columns, see [Mapping](../configuration/mapping.md); to choose the type of each column, [Data types](../configuration/data-types.md).

A method that takes a type takes it by its name (`BuiltInType`: `'boolean'`, `'int'`, `'bigint'`, `'double'`, `'string'`, `'uuid'`, `'stringDecimal'`, `'localDate'`, `'localTime'` or `'localDateTime'`) or by its class (`DataTypeClass`): the class of a built-in type, like `IntType` for `'int'`, or a class of yours that extends a family, like `CentsType`, which extends `IntegersType<Cents, 'Cents'>`. The value source it gives has the methods of that type, and `T` is the type of its values: see [Data types](../configuration/data-types.md) and [Value expressions](value-expressions.md).

```typescript
interface View {
    /** Defines an alias for the view to be used in select queries */
    as(as: string): this
    /** Enables the view to be used in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Enables the view to be used in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that create a required column that doesn't admit null
    column<T>(name: string, type: BuiltInType | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column that admits null
    optionalColumn<T>(name: string, type: BuiltInType | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create a column from a sql fragment in the view
    virtualColumnFromFragment<T>(type: BuiltInType | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column from a sql fragment in the view
    optionalVirtualColumnFromFragment<T>(type: BuiltInType | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>
}
```
