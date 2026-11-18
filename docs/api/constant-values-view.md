---
search:
  boost: 0.3
---
# Constant values view API

This API allows you to define and use constant values as if they were a virtual table or view in your queries. These values can be used to simulate joins with static data, define fragments, or structure expressions that act like inline tables. The API supports different types of fields, including nullable and non-nullable values, as well as custom and virtual columns.

To learn how to declare and use constant values as a view, see [Mapping constant values as a view](../configuration/mapping.md#mapping-constant-values-as-view).

A class of values doesn't declare a constructor: the one it inherits receives the name and an `OpaqueValues`, a type exported from `ts-sql-query` that only `Values.create` gives, so an instance is always created with `Values.create(...)`.

A method that takes a type takes it by its class (`DataTypeClass`): the class of a built-in type, like `IntType`, or a class of yours that extends a family, like `CentsType`, which extends `IntegersType<Cents, 'Cents'>`. It takes it by its name too (`DataTypeName`): the name of a built-in type (`'boolean'`, `'int'`, `'bigint'`, `'double'`, `'string'`, `'uuid'`, `'stringDecimal'`, `'localDate'`, `'localTime'` or `'localDateTime'`), or the type name of a class of yours [registered](../advanced/data-types/own-data-types.md#giving-your-type-by-its-name), like `'Cents'`. The value source it gives has the methods of that type, and `T` is the type of its values: see [Data types](../configuration/data-types.md) and [Value expressions](value-expressions.md).

```typescript
interface Values {
    /** Defines an alias for the view to be used in select queries */
    as(as: string): this
    /** Enables the view to be used in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Enables the view to be used in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    /**
     * Static method, called as Values.create(MyValuesClass, 'name', rows). It is the way to create an instance.
     * The class must not implement a constructor.
     * Each row has one property per column, with the required ones mandatory.
     * It throws an error if the list of rows is empty.
     */
    create<T extends Values>(type: new (name: string, values: any) => T, name: string, values: { [columnName: string]: any }[]): T

    // Protected methods that create a required column that doesn't admit null
    column<T>(type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column that admits null
    optionalColumn<T>(type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create a column from a sql fragment in the view
    virtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column from a sql fragment in the view
    optionalVirtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>
}
```
