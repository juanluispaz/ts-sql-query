---
search:
  boost: 0.3
---
# Table API

This API defines the structure of database tables within `ts-sql-query`. It provides methods to declare columns of different types, including nullable and non-nullable fields, columns with default values, primary keys (auto-generated or not), computed columns, and virtual columns based on SQL fragments. These definitions are used internally by queries to ensure type safety and to generate valid SQL statements.

```typescript
interface Table {
    /** Defines an alias for the table to be used in select queries */
    as(as: string): this
    /** Enables the table to be used in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Enables the table to be used in a left join with an alias */
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
    column<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

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
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // Protected methods that allow to create a required column that doesn't admits null but have a default value when insert
    columnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    columnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    columnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    columnWithDefaultValue(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    columnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    columnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    columnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // Protected methods that allow to create an optional column that admits null and have a default value when insert
    optionalColumnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumnWithDefaultValue(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // Protected methods that allow to create a primary key column autogenerated in the database
    // When you insert you don't need specify this column
    autogeneratedPrimaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    autogeneratedPrimaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKey(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    autogeneratedPrimaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that allow to create a primary key column not automatically generated
    // When you insert you must specify this column
    primaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    primaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    primaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    primaryKey(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    primaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    primaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    primaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
      
    // Protected methods that allow to create a primary key column generated by a sequence
    // When you insert you don't need specify this column, it will be added automatically by ts-sql-query
    // This method is only supported by mariaDB, oracle, postgreSql and sqlServer
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, sequenceName: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, sequenceName: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME = T>(name: string, sequenceName: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that allow to create a computed column that doesn't admits null
    computedColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    computedColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    computedColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    computedColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    computedColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    computedColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    computedColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    computedColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    computedColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that allow to create an optional computed column that admits null
    optionalComputedColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalComputedColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalComputedColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalComputedColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalComputedColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalComputedColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalComputedColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalComputedColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalComputedColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that allows to create a sql fragment in the table
    virtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    virtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    virtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    virtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    virtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    virtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customInt', typeName: string, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customDouble', typeName: string, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customUuid', typeName: string, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDate', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'enum', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'custom', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customComparable', typeName: string, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that allows to create an optional sql fragment in the table
    optionalVirtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    optionalVirtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    optionalVirtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    optionalVirtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customInt', typeName: string, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customDouble', typeName: string, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customUuid', typeName: string, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDate', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'enum', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'custom', typeName: string, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME = T>(type: 'customComparable', typeName: string, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
}
```
