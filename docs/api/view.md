---
search:
  boost: 0.3
---
# View API

This API defines the structure of database views within `ts-sql-query`. It provides methods to declare the columns exposed by the view, including their types and nullability. Although views are read-only and do not support insertions or updates, their column definitions are used internally by queries to ensure type safety and to generate valid SQL statements.

```typescript
interface View {
    /** Defines an alias for the view to be used in select queries */
    as(as: string): this
    /** Enables the view to be used in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Enables the view to be used in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that create a required column that doesn't admit null
    column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    column(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    column<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create an optional column that admits null
    optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

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
