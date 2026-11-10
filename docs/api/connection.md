---
search:
  boost: 0.3
---
# Connection API

This interface exposes all the methods required to interact with the database via `ts-sql-query`. It allows creating, executing and customizing SQL expressions, managing transactions, using constants, aggregates and sequences, and composing raw or typed SQL fragments.

```typescript
interface Connection {
    /** Query runner used to create the connection */
    readonly queryRunner: QueryRunner
    /** The transformations of the connection, without any type adapter */
    readonly defaultTypeAdapter: DefaultTypeAdapter

    // Transaction management. A failure of beginTransaction, commit, rollback or transaction rejects the promise
    beginTransaction(isolationLevel?: TransactionIsolationLevel): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>
    isTransactionActive(): boolean
    transaction<T>(fn: () => T | Promise<T>, isolationLevel?: TransactionIsolationLevel): Promise<T>
    /**
     * Not available on SQLite. What each database accepts:
     * - MariaDB, MySQL: 'read uncommitted', 'read committed', 'snapshot', 'serializable', with an optional access mode, or only the access mode
     * - PostgreSQL: 'read committed', 'snapshot', 'serializable', with an optional access mode, or only the access mode
     * - Oracle: 'read committed', 'snapshot', or only the access mode
     * - SQL Server: 'read uncommitted', 'read committed', 'repeatable read', 'snapshot', 'serializable', without access mode
     */
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    // Functions that defer code to the end of the transaction. They throw if there is no open transaction
    executeBeforeNextCommit(fn: ()=> void): void
    executeBeforeNextCommit(fn: ()=> Promise<void>): void
    executeAfterNextCommit(fn: ()=> void): void
    executeAfterNextCommit(fn: ()=> Promise<void>): void
    executeAfterNextRollback(fn: ()=> void): void
    executeAfterNextRollback(fn: ()=> Promise<void>): void
    /** Throws if there is no open transaction */
    getTransactionMetadata(): Map<unknown, unknown>

    // Querying
    insertInto(table: Table): InsertExpression
    update(table: Table): UpdateExpression
    updateAllowingNoWhere(table: Table): UpdateExpression
    deleteFrom(table: Table): DeleteExpression
    deleteAllowingNoWhereFrom(table: Table): DeleteExpression
    selectFrom(table: Table | View): SelectExpression
    selectDistinctFrom(table: Table | View): SelectExpression
    selectFromNoTable(): SelectExpression

    // These methods create a subquery that depends on an outer table defined in the main query
    subSelectUsing(table: Table | View | OuterJoinSource): SelectExpression
    subSelectUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource): SelectExpression
    subSelectUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource, table3: Table | View | OuterJoinSource): SelectExpression
    subSelectUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource, table3: Table | View | OuterJoinSource, table4: Table | View | OuterJoinSource): SelectExpression
    subSelectUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource, table3: Table | View | OuterJoinSource, table4: Table | View | OuterJoinSource, table5: Table | View | OuterJoinSource): SelectExpression
    subSelectDistinctUsing(table: Table | View | OuterJoinSource): SelectExpression
    subSelectDistinctUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource): SelectExpression
    subSelectDistinctUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource, table3: Table | View | OuterJoinSource): SelectExpression
    subSelectDistinctUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource, table3: Table | View | OuterJoinSource, table4: Table | View | OuterJoinSource): SelectExpression
    subSelectDistinctUsing(table1: Table | View | OuterJoinSource, table2: Table | View | OuterJoinSource, table3: Table | View | OuterJoinSource, table4: Table | View | OuterJoinSource, table5: Table | View | OuterJoinSource): SelectExpression
    
    // Default value of a column, for inserts and updates. Not available on SQLite
    default(): Default

    // values that can be returned by the database
    pi(): NumberValueSource
    random(): NumberValueSource
    currentDate(): LocalDateValueSource
    currentTime(): LocalTimeValueSource
    currentDateTime(): LocalDateTimeValueSource
    currentTimestamp(): LocalDateTimeValueSource
    true(): BooleanValueSource
    false(): BooleanValueSource

    // Methods that create a value source with a constant value
    const(value: boolean, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    const(value: number, type: 'int', adapter?: TypeAdapter): NumberValueSource
    const(value: bigint, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    const(value: number, type: 'double', adapter?: TypeAdapter): NumberValueSource
    const(value: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    const(value: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    const(value: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    const(value: Date, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    const(value: Date, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    const(value: Date, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    const<T, TYPE_NAME extends string>(value: T, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME extends string>(value: T, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Methods that create a value source with an optional constant value
    optionalConst(value: boolean | null | undefined, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalConst(value: number | null | undefined, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalConst(value: bigint | null | undefined, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalConst(value: number | null | undefined, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalConst(value: string | null | undefined, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalConst(value: string | null | undefined, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalConst(value: string | null | undefined, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    optionalConst(value: Date | null | undefined, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalConst(value: Date | null | undefined, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalConst(value: Date | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // The exists and not exists of a subquery
    exists(select: Subquery): BooleanValueSource
    notExists(select: Subquery): BooleanValueSource

    // Aggregate functions. max, min, sum, average, stringConcat and anyValue return an optional value, whatever the type of the argument
    /** count(*) */
    countAll(): NumberValueSource
    /** count(value) */
    count(value: AnyValueSource): NumberValueSource
    /** count(distinct value) */
    countDistinct(value: AnyValueSource): NumberValueSource
    /** max(value) */
    max<TYPE extends ComparableValueSource<any, any>>(value: TYPE): TYPE
    /** min(value) */
    min<TYPE extends ComparableValueSource<any, any>>(value: TYPE): TYPE
    /** sum(value) */
    sum(value: NumberValueSource): NumberValueSource
    sum(value: BigintValueSource): BigintValueSource
    sum<T, TYPE_NAME extends string>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    sum<T, TYPE_NAME extends string>(value: CustomBigintValueSource<T, TYPE_NAME>): CustomBigintValueSource<T, TYPE_NAME>
    sum<T, TYPE_NAME extends string>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
    sum(value: StringDecimalValueSource): StringDecimalValueSource
    sum<T, TYPE_NAME extends string>(value: CustomDecimalValueSource<T, TYPE_NAME>): CustomDecimalValueSource<T, TYPE_NAME>
    /** sum(distinct value) */
    sumDistinct(value: NumberValueSource): NumberValueSource
    sumDistinct(value: BigintValueSource): BigintValueSource
    sumDistinct<T, TYPE_NAME extends string>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    sumDistinct<T, TYPE_NAME extends string>(value: CustomBigintValueSource<T, TYPE_NAME>): CustomBigintValueSource<T, TYPE_NAME>
    sumDistinct<T, TYPE_NAME extends string>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
    sumDistinct(value: StringDecimalValueSource): StringDecimalValueSource
    sumDistinct<T, TYPE_NAME extends string>(value: CustomDecimalValueSource<T, TYPE_NAME>): CustomDecimalValueSource<T, TYPE_NAME>
    /** avg(value). It always returns a number, a double, also for a bigint or a custom type */
    average(value: NumberValueSource | BigintValueSource | StringDecimalValueSource | CustomIntValueSource<any, any> | CustomBigintValueSource<any, any> | CustomDoubleValueSource<any, any> | CustomDecimalValueSource<any, any>): NumberValueSource
    /** avg(distinct value). It always returns a number, a double, also for a bigint or a custom type */
    averageDistinct(value: NumberValueSource | BigintValueSource | StringDecimalValueSource | CustomIntValueSource<any, any> | CustomBigintValueSource<any, any> | CustomDoubleValueSource<any, any> | CustomDecimalValueSource<any, any>): NumberValueSource
    /** group_concat(value, separator) sometimes called string_agg or listagg. The default separator is ',' */
    stringConcat(value: StringValueSource, separator?: string): StringValueSource
    /**
     * group_concat(distinct value, separator) sometimes called string_agg or listagg. The default separator is ','
     * Not available on SQL Server. On SQLite it doesn't accept a separator
     */
    stringConcatDistinct(value: StringValueSource, separator?: string): StringValueSource
    /** any_value(value): any value of the group (SQL:2023); not available on MariaDB and SQL Server. On SQLite the value is written as is (a bare column) */
    anyValue<TYPE extends AnyValueSource>(value: TYPE): TYPE
    /** Aggregate as object array */
    aggregateAsArray<T extends SelectValues>(columns: T): AggregatedArrayValueSourceProjectableAsNullable<T>
    /** Only available on MariaDB, PostgreSQL and SQLite */
    aggregateAsArrayDistinct<T extends SelectValues>(columns: T): AggregatedArrayValueSourceProjectableAsNullable<T>
    aggregateAsArrayOfOneColumn<T, TYPE_NAME extends string>(value: ValueSource<T, TYPE_NAME>): AggregatedArrayValueSource<T>
    /** Only available on MariaDB, PostgreSQL and SQLite */
    aggregateAsArrayOfOneColumnDistinct<T, TYPE_NAME extends string>(value: ValueSource<T, TYPE_NAME>): AggregatedArrayValueSource<T>

    // Methods that create SQL fragments
    fragmentWithType(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'stringDecimal', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<_T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression

    // Same as fragmentWithType, but the produced value is treated as an aggregate
    aggregateFragmentWithType(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'stringDecimal', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    aggregateFragmentWithType<_T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression

    /** 
     * This is a template, you can call as: .rawFragment`sql text with ${valueSourceParam}` 
     */
    rawFragment(sql: TemplateStringsArray, ...p: Array<AnyValueSource | Subquery>): RawFragment

    // Protected method that calls a stored procedure. Any failure rejects the promise
    executeProcedure(procedureName: string, params: AnyValueSource[]): Promise<void>

    // Protected methods that call a function. Any failure rejects the promise.
    // With 'optional' the promise also resolves to null; to simplify, that isn't written in the signatures below.
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<boolean>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<bigint>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<string>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<string>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'stringDecimal', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<string>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customInt', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customBigint', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customDouble', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customDecimal', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customUuid', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customLocalDate', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customLocalTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'enum', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'custom', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, TYPE_NAME extends string>(functionName: string, params: AnyValueSource[], returnType: 'customComparable', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>

    // Protected methods to define a sequence (only available on MariaDB, Oracle, PostgreSQL and SQL Server)
    sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource>
    sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'bigint', adapter?: TypeAdapter): Sequence<BigintValueSource>
    sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource>
    sequence(name: string, type: 'uuid', adapter?: TypeAdapter): Sequence<UuidValueSource>
    sequence(name: string, type: 'stringDecimal', adapter?: TypeAdapter): Sequence<StringDecimalValueSource>
    sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<LocalDateValueSource>
    sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<LocalTimeValueSource>
    sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<LocalDateTimeValueSource>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomIntValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomBigintValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomDoubleValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomDecimalValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomUuidValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalDateValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalTimeValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalDateTimeValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<EqualableValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<EqualableValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ComparableValueSource<T, TYPE_NAME>>

    // Protected methods to define reusable fragments
    /**
     * Defines an argument that accepts a value or a value source of the specified type
     */
    arg(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<boolean, 'boolean'>
    arg(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    arg(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<bigint, 'bigint'>
    arg(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    arg(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'string'>
    arg(type: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'uuid'>
    arg(type: 'stringDecimal', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'stringDecimal'>
    arg(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDate'>
    arg(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localTime'>
    arg(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDateTime'>
    arg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>

    /**
     * Defines an argument that accepts a value of the specified type, but not a value source
     */
    valueArg(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<boolean, 'boolean'>
    valueArg(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    valueArg(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<bigint, 'bigint'>
    valueArg(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    valueArg(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'string'>
    valueArg(type: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'uuid'>
    valueArg(type: 'stringDecimal', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'stringDecimal'>
    valueArg(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDate'>
    valueArg(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localTime'>
    valueArg(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDateTime'>
    valueArg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>

    /*
     * These protected methods receive the argument definitions that you create with arg or valueArg.
     * You can specify up to 5 argument definitions.
     */
    buildFragmentWithArgs(...argumentDefinitions: Argument<any, any>[]): FragmentBuilder
    buildFragmentWithArgsIfValue(...argumentDefinitions: Argument<any, any>[]): FragmentBuilderIfValue
    buildFragmentWithMaybeOptionalArgs(...argumentDefinitions: Argument<any, any>[]): FragmentBuilderMaybeOptional
    // Same as the build*FragmentWith* functions above, but the produced value is treated as an aggregate
    buildAggregateFragmentWithArgs(...argumentDefinitions: Argument<any, any>[]): FragmentBuilder
    buildAggregateFragmentWithArgsIfValue(...argumentDefinitions: Argument<any, any>[]): FragmentBuilderIfValue
    buildAggregateFragmentWithMaybeOptionalArgs(...argumentDefinitions: Argument<any, any>[]): FragmentBuilderMaybeOptional

    /**
     * Returns the same neutral boolean that the IfValue functions return when there is no value
     */
    noValueBoolean(): IfValueSource

    /**
     * Returns the same neutral boolean, with a type that stays the same after each and, or, onlyWhen...
     * In this way, you can build a boolean expression in a variable that you reassign.
     */
    dynamicBooleanExpressionUsing(table: Table | View): AlwaysIfValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View): AlwaysIfValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View, table3: Table | View): AlwaysIfValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View, table3: Table | View,  table4: Table | View): AlwaysIfValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View, table3: Table | View,  table4: Table | View,  table5: Table | View): AlwaysIfValueSource

    /**
     * Creates a condition whose criteria is provided by an external system
     */
    dynamicConditionFor(definition: Filterable, extension?: DynamicConditionExtension): DynamicConditionExpression

    /*
     * Protected method. The fn function receives the table name as its first argument, and the alias of the table
     * as its second argument, both as ValueSource.
     * The number of additional arguments in the fn function is the same in the resulting function (up to 5 arguments).
     * The first argument of the returned function is the table or view, the second argument
     * is a name for the customization; the additional arguments are the same defined in the fn function.
     */
    createTableOrViewCustomization(fn: (table: AnyValueSource, alias: AnyValueSource, ...params: any[]) => RawFragment): (tableOrView: Table | View, name: string, ...params: any[]) => CustomizedTableOrView

    /*
     * Configurations
     */

    /** 
     * Protected property that changes how an empty string is treated.
     * By default an empty string is treated as null. To send and receive empty strings, set this property to true.
     * Default value: false
     */
    allowEmptyString: boolean
    /**
     * Protected property with the collation of the insensitive operations. When it's not set, they use the function lower.
     * With an empty string, they use neither a collation nor lower.
     */
    insensitiveCollation?: string | undefined
    /**
     * Protected property with the minimum version of the database the SQL must support: major * 1_000_000 + minor * 1_000 + patch.
     * For example, 10_005_000 for MariaDB 10.5. By default, the latest version.
     */
    compatibilityVersion: number

    /** Protected method that transforms the values received from the database */
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    /** Protected method that transforms the values sent to the database */
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    /** Protected method that customizes the value placeholder in the query */
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string
    /**
     * Protected method that decides whether the database must receive the type of the parameter. It receives true where
     * the position in the SQL gives the parameter no type; the query runner then writes a cast or sends the parameter
     * with its type (PostgreSQL only). By default, it returns what it receives
     */
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
    /**
     * Protected method that writes the SQL of a value as it leaves the database, in a column of the result. By default,
     * the conversion of the library: SQL Server writes a decimal as its text; every other value keeps its SQL
     */
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string

    /** Protected method that returns true if the provided string is a reserved keyword */
    isReservedKeyword(word: string): boolean
    /** Protected method that returns the provided string as an identifier, always quoted */
    forceAsIdentifier(identifier: string): string
    /** 
     * Protected method that returns the provided identifier escaped.
     * The default implementation quotes the identifier only if it is a reserved keyword.
     * To quote all identifiers, reimplement this function returning the result of forceAsIdentifier.
     * allowReservedKeyword is true for the name of a function or a procedure (executeFunction, executeProcedure):
     * a reserved word is kept as it is, as quoted it would no longer be the built-in function of that name.
     */
    escape(identifier: string, strict: boolean, allowReservedKeyword?: boolean): string
}
```

```typescript
interface FragmentExpression {
    /** 
     * This is a template, you can call as: .sql`sql text with ${valueSourceParam}` 
     * You can specify up to 7 parameters.
     */
    sql(sql: TemplateStringsArray, ...p: AnyValueSource[]): AnyValueSource
}
```

```typescript
interface FragmentBuilder {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The number of arguments is the same specified in the function buildFragmentWithArgs (up to 5 arguments).
     * The arguments of the returned function will have the proper parameters type.
     */
    as(impl: (...args: AnyValueSource[]) => AnyValueSource): (...args: any) => AnyValueSource
}
```

```typescript
interface FragmentBuilderIfValue {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The number of arguments is the same specified in the function buildFragmentWithArgsIfValue (up to 5 arguments).
     * The impl function must return a boolean. An optional valueArg is received in impl as required.
     * If an optional valueArg has no value (null, undefined, an empty array, or an empty string unless allowEmptyString is true),
     * the returned function gives the neutral boolean, and the fragment isn't used in the query.
     * The arguments of the returned function will have the proper parameters type.
     */
    as(impl: (...args: AnyValueSource[]) => BooleanValueSource | IfValueSource | AlwaysIfValueSource): (...args: any) => IfValueSource
}
```

```typescript
interface FragmentBuilderMaybeOptional {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The number of arguments is the same specified in the function buildFragmentWithMaybeOptionalArgs (up to 5 arguments).
     * The arguments of the returned function will have the proper parameters type.
     * The function will return an optional value if any of the provided arguments when invoked is optional; 
     * otherwise, the return type will be marked as required.
     * All arguments that can be optional must be marked as optional; the return fragment must be marked as optional.
     */
    as(impl: (...args: AnyValueSource[]) => AnyValueSource): (...args: any) => AnyValueSource
}
```

```typescript
interface Sequence<T> {
    nextValue(): T
    currentValue(): T
}
```

```typescript
interface DynamicConditionExpression {
    /** The result is an optional boolean. The filter accepts the rules of the extension provided to dynamicConditionFor */
    withValues(filter: DynamicFilter): BooleanValueSource
}
```

Each connection adds protected configuration properties of its own. The page of each database explains them: [MariaDB](../configuration/supported-databases/mariadb.md), [MySQL](../configuration/supported-databases/mysql.md), [Oracle](../configuration/supported-databases/oracle.md), [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQLite](../configuration/supported-databases/sqlite.md) and [SQL Server](../configuration/supported-databases/sqlserver.md).

```typescript
interface MariaDBConnectionConfiguration {
    uuidStrategy: 'string' | 'uuid' // Default: 'uuid'
    usePlatformDependentRound: boolean // Default: false
}

interface MySqlConnectionConfiguration {
    uuidStrategy: 'string' | 'binary' // Default: 'binary'
    usePlatformDependentRound: boolean // Default: false
}

interface OracleConnectionConfiguration {
    uuidStrategy: 'string' | 'custom-functions' | 'built-in' // Default: 'built-in'
    ignoreNullInConcat: boolean // Default: false
    concatFunction?: string
    replaceCollation: string // Default: 'BINARY'
    replaceInsensitiveCollation: string // Default: 'BINARY_CI'
}

interface PostgreSqlConnectionConfiguration {
    usePlatformDependentRound: boolean // Default: false
    ignoreNullInMinAndMaxValue: boolean // Default: false
    minValueFunction?: string
    maxValueFunction?: string
    useLikeInsteadOfIlike: boolean // Default: false
}

interface SqliteConnectionConfiguration {
    uuidStrategy: 'string' | 'uuid-extension' // Default: 'uuid-extension'
    replaceAllInsensitiveFunction?: string
    /** Protected method with the format of a date, a time or a date time. By default, 'localdate milliseconds as text' */
    getDateTimeFormat(type: 'date' | 'time' | 'dateTime'): 'localdate seconds as text' | 'localdate milliseconds as text' | 'localdate seconds as text using T separator' | 'localdate milliseconds as text using T separator' | 'UTC seconds as text' | 'UTC milliseconds as text' | 'UTC seconds as text using T separator' | 'UTC milliseconds as text using T separator' | 'UTC seconds as text using Z timezone' | 'UTC milliseconds as text using Z timezone' | 'UTC seconds as text using T separator and Z timezone' | 'UTC milliseconds as text using T separator and Z timezone' | 'Julian day as real number' | 'Unix time seconds as integer' | 'Unix time milliseconds as integer'
    treatUnexpectedIntegerDateTimeAsJulian: boolean // Default: false
    treatUnexpectedStringDateTimeAsUTC: boolean // Default: false
    unexpectedUnixDateTimeAreMilliseconds: boolean // Default: false
}

interface SqlServerConnectionConfiguration {
    excludeTrailingBlanksInLength: boolean // Default: false
    ignoreNullInMinAndMaxValue: boolean // Default: false
    minValueFunction?: string
    maxValueFunction?: string
    replaceCollation: string // Default: 'Latin1_General_BIN2'
}
```
