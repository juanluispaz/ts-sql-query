---
search:
  boost: 0.3
---
# Constant values view API

This API allows you to define and use constant values as if they were a virtual table or view in your queries. These values can be used to simulate joins with static data, define fragments, or structure expressions that act like inline tables. The API supports different types of fields, including nullable and non-nullable values, as well as custom and virtual columns.

A class of values doesn't declare a constructor: the one it inherits receives the name and an `OpaqueValues`, a type exported from `ts-sql-query` that only `Values.create` gives, so an instance is always created with `Values.create(...)`.

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
    column(type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    column(type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(type: 'string', adapter?: TypeAdapter): StringValueSource
    column(type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    column(type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    column(type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    column(type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    column<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create an optional column that admits null
    optionalColumn(type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumn(type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumn(type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumn(type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalColumn(type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumn(type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumn(type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumn<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create a column from a sql fragment in the view
    virtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    virtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    virtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    virtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    virtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    virtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create an optional column from a sql fragment in the view
    optionalVirtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    optionalVirtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    optionalVirtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    optionalVirtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
}
```
