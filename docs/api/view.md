---
search:
  boost: 0.3
---
# View API

This API defines the structure of database views within `ts-sql-query`. It provides methods to declare the columns exposed by the view, including their types and nullability. Although views are read-only and do not support insertions or updates, their column definitions are used internally by queries to ensure type safety and to generate valid SQL statements.

```ts
interface View {
    /** Allows to define an alias for the view to be used in the selects queries */
    as(as: string): this
    /** Allows  to use the view in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Allows  to use the view in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that allow to create a required column that doesn't admits null
    column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    column(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    column<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T>
    column<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T>

    // Protected methods that allow to create an optional column that admits null
    optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T>

    // Protected methods that allows to create a sql fragment in the view
    virtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    virtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    virtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    virtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    virtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    virtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customInt', typeName: string, fn: (fragment: FragmentExpression) => CustomIntValueSource<T>, adapter?: TypeAdapter): CustomIntValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customDouble', typeName: string, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T>, adapter?: TypeAdapter): CustomDoubleValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customUuid', typeName: string, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T>, adapter?: TypeAdapter): CustomUuidValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDate', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T>, adapter?: TypeAdapter): CustomLocalDateValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'enum', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T>, adapter?: TypeAdapter): EqualableValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'custom', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T>, adapter?: TypeAdapter): EqualableValueSource<T>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customComparable', typeName: string, fn: (fragment: FragmentExpression) => ComparableValueSource<T>, adapter?: TypeAdapter): ComparableValueSource<T>

    // Protected methods that allows to create an optional sql fragment in the view
    optionalVirtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    optionalVirtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    optionalVirtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    optionalVirtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customInt', typeName: string, fn: (fragment: FragmentExpression) => CustomIntValueSource<T>, adapter?: TypeAdapter): CustomIntValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customDouble', typeName: string, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T>, adapter?: TypeAdapter): CustomDoubleValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customUuid', typeName: string, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T>, adapter?: TypeAdapter): CustomUuidValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDate', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T>, adapter?: TypeAdapter): CustomLocalDateValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'enum', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T>, adapter?: TypeAdapter): EqualableValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'custom', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T>, adapter?: TypeAdapter): EqualableValueSource<T>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customComparable', typeName: string, fn: (fragment: FragmentExpression) => ComparableValueSource<T>, adapter?: TypeAdapter): ComparableValueSource<T>
}
```
