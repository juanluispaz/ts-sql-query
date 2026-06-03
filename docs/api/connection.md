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

    // Transaction management
    beginTransaction(isolationLevel?: TransactionIsolationLevel): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>
    isTransactionActive(): boolean
    transaction<T>(fn: () => Promise<T>, isolationLevel?: TransactionIsolationLevel): Promise<T>
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    // Fuctions that allow to defer a code execution till the end of the transaction
    executeBeforeNextCommit(fn: ()=> void): void
    executeBeforeNextCommit(fn: ()=> Promise<void>): void
    executeAfterNextCommit(fn: ()=> void): void
    executeAfterNextCommit(fn: ()=> Promise<void>): void
    executeAfterNextRollback(fn: ()=> void): void
    executeAfterNextRollback(fn: ()=> Promise<void>): void
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

    // These methods allows to create a subquery that depends of a outer table defined in the main query 
    subSelectUsing(table: Table | View): SelectExpression
    subSelectUsing(table1: Table | View, table2: Table | View): SelectExpression
    subSelectUsing(table1: Table | View, table2: Table | View, table3: Table | View): SelectExpression
    subSelectDistinctUsing(table: Table | View): SelectExpression
    subSelectDistinctUsing(table1: Table | View, table2: Table | View): SelectExpression
    subSelectDistinctUsing(table1: Table | View, table2: Table | View, table3: Table | View): SelectExpression
    
    // default value for use in insert queries
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

    // methods that allows to create a value source with a constant value
    const(value: boolean, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    const(value: number, type: 'int', adapter?: TypeAdapter): NumberValueSource
    const(value: number, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    const(value: number, type: 'double', adapter?: TypeAdapter): NumberValueSource
    const(value: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    const(value: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    const(value: Date, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    const(value: Date, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    const(value: Date, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    const<T, TYPE_NAME = T>(value: T, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    const<T, TYPE_NAME = T>(value: T, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // methods that allows to create a value source with an optional constant value
    optionalConst(value: boolean | null | undefined, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalConst(value: number | null | undefined, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalConst(value: number | null | undefined, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalConst(value: number | null | undefined, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalConst(value: string | null | undefined, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalConst(value: string | null | undefined, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalConst(value: Date | null | undefined, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalConst(value: Date | null | undefined, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalConst(value: Date | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalConst<T, TYPE_NAME = T>(value: T, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T | null | undefined, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T | null | undefined, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalConst<T, TYPE_NAME = T>(value: T | null | undefined, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // allows to use the exits function on a subquery
    exists(select: Subquery): BooleanValueSource
    notExists(select: Subquery): BooleanValueSource

    // aggregate functions
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
    sum<T, TYPE_NAME>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    sum<T, TYPE_NAME>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
    /** sum(distinct value) */
    sumDistinct(value: NumberValueSource): NumberValueSource
    sumDistinct<T, TYPE_NAME>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    sumDistinct<T, TYPE_NAME>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
    /** avg(value) */
    average(value: NumberValueSource): NumberValueSource
    average<T, TYPE_NAME>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    average<T, TYPE_NAME>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
    /** avg(disctinct value) */
    averageDistinct(value: NumberValueSource): NumberValueSource
    averageDistinct<T, TYPE_NAME>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    averageDistinct<T, TYPE_NAME>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
    /** group_concat(value, separator) sometimes called string_agg or listagg. The default separator is ',' */
    stringConcat(value: StringValueSource, separator?: string): StringValueSource
    /** group_concat(distinct value, separator) sometimes called string_agg or listagg. The default separator is ',' */
    stringConcatDistinct(value: StringValueSource, separator?: string): StringValueSource
    /** Aggregate as object array */
    aggregateAsArray<T extends SelectValues>(columns: T): AggregatedArrayValueSourceProjectableAsNullable<T>
    aggregateAsArrayDistinct<T extends SelectValues>(columns: T): AggregatedArrayValueSourceProjectableAsNullable<T>
    aggregateAsArrayOfOneColumn<T, TYPE_NAME>(value: ValueSource<T, TYPE_NAME>): AggregatedArrayValueSource<T>
    aggregateAsArrayOfOneColumnDistinct<T, TYPE_NAME>(value: ValueSource<T, TYPE_NAME>): AggregatedArrayValueSource<T>

    // Methods that allows create SQL fragments
    fragmentWithType(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'customInt', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'customDouble', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'customUuid', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'customLocalDate', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'customLocalTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'customLocalDateTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T, _TYPE_NAME = T>(type: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    
    /** 
     * This is a template, you can call as: .rawFragment`sql text with ${valueSourceParam}` 
     */
    rawFragment(sql: TemplateStringsArray, ...p: Array<AnyValueSource | Subquery>): RawFragment

    // Protected methods that allows call a stored procedure
    executeProcedure(procedureName: string, params: AnyValueSource[]): Promise<void>

    // Protected methods that allows call a function
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<boolean>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<bigint>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<string>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<string>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: AnyValueSource[], returnType: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'customInt', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'customDouble', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'customUuid', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'customLocalDate', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'customLocalTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'customLocalDateTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T, _TYPE_NAME = T>(functionName: string, params: AnyValueSource[], returnType: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>

    // Protected methods to define a sequence (only available in mariaDB, oracle, postgreSql and sqlServer)
    sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource>
    sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'bigint', adapter?: TypeAdapter): Sequence<BigintValueSource>
    sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource>
    sequence(name: string, type: 'uuid', adapter?: TypeAdapter): Sequence<UuidValueSource>
    sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<LocalDateValueSource>
    sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<LocalTimeValueSource>
    sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<LocalDateTimeValueSource>
    sequence<T, TYPE_NAME = T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): Sequence<CustomIntValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): Sequence<CustomDoubleValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): Sequence<CustomUuidValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalDateValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalTimeValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalDateTimeValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<T, TYPE_NAME>>
    sequence<T, TYPE_NAME = T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): Sequence<ComparableValueSource<T, TYPE_NAME>>

    // Protected methods to define reusable fragments
    /**
     * Allows to define arguments that acept the value or a value source of the type specified
     */
    arg(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<boolean, 'boolean'>
    arg(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    arg(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<bigint, 'bigint'>
    arg(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    arg(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'string'>
    arg(type: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'uuid'>
    arg(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDate'>
    arg(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localTime'>
    arg(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDateTime'>
    arg<T, TYPE_NAME = T>(type: 'customInt', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'customDouble', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'customUuid', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'customLocalDate', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'customLocalTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'customLocalDateTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    arg<T, TYPE_NAME = T>(type: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>

    /**
     * Allows to define arguments that acept the value (but no a value source) of the type specified
     */
    valueArg(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<boolean, 'boolean'>
    valueArg(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    valueArg(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<bigint, 'bigint'>
    valueArg(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<number, 'number'>
    valueArg(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'string'>
    valueArg(type: 'uuid', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<string, 'uuid'>
    valueArg(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDate'>
    valueArg(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localTime'>
    valueArg(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument<Date, 'localDateTime'>
    valueArg<T, TYPE_NAME = T>(type: 'customInt', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'customDouble', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'customUuid', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'customLocalDate', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'customLocalTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'customLocalDateTime', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>
    valueArg<T, TYPE_NAME = T>(type: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T, TYPE_NAME>

    /*
     * This functions receive the argument definition that you can create calling the arg function or the valueArg function.
     * You can specify up to 5 argument definitions
     */
    buildFragmentWithArgs(...argumentDefinitions: Argument<any, any>[]): FragmentBuilder
    buildFragmentWithArgsIfValue(...argumentDefinitions: Argument<any, any>[]): FragmentBuilderIfValue
    buildFragmentWithMaybeOptionalArgs(...argumentDefinitions: Argument<any, any>[]): FragmentBuilderMaybeOptional

    /**
     * Return the same special neutral boolean mark returned by the IfValue functions when there is no value
     */
    noValueBoolean(): BooleanValueSource

    /**
     * Return the same special neutral boolean mark returned by the IfValue functions when there is no value in a way it can be used
     * to create dynamic boolean expression where the variable is reasigned (it have a stable type)
     */
    dynamicBooleanExpressionUsing(table: Table | View): BooleanValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View): BooleanValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View, table3: Table | View): BooleanValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View, table3: Table | View,  table4: Table | View): BooleanValueSource
    dynamicBooleanExpressionUsing(table1: Table | View, table2: Table | View, table3: Table | View,  table4: Table | View,  table5: Table | View): BooleanValueSource

    /**
     * Allows to create a condition where the criteria is provided by an external system
     */
    dynamicConditionFor(definition: { [key: string ]: AnyValueSource }): DynamicConditionExpression

    /*
     * The fn function will receive as first argument the table name as ValueSource,
     * as the second argument is the alias of the table as ValueSource
     * The number of additional arguments in the fn function is the same in the resulting function (up to 5 arguments).
     * The first argument of the returned function is the table or view, the second argument
     * is a name for the customization; the additional arguments are the same defined in the fn function.
     */
    createTableOrViewCustomization(fn: (table: AnyValueSource, alias: AnyValueSource, ...params: any[]) => RawFragment): (tableOrView: Table | View, name: string, ...params: any[]) => CustomizedTableOrView

    /*
     * Configurations
     */

    /** 
     * Protected property that allows changing the behaviour of empty string treatment.
     * By default empty string as treated as null, if you want to allow to send and receive empty string to the database set this property to true
     * Default value: false
     */
    allowEmptyString: boolean

    /** Protected method that allows to transform the values received from the database */
    transformValueFromDB(value: unknown, type: string): unknown
    /** Protected method that allows to transform the values that will be send to the database */
    transformValueToDB(value: unknown, type: string): unknown
    /** Protected method that allows to customize the value placeholder in the query */
    transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown): string

    /** Protected method that returns true if the provided string is a reserved keyword, otherwise return false */
    isReservedKeyword(word: string): boolean
    /** Protected method that returns the provided string as a indefier quoting it all the time */
    forceAsIdentifier(identifier: string): string
    /** 
     * Protected method that returns the provided identifier escaped.
     * The default implementation quote the identifier only if it is a reserved keyword.
     * If you want all identifiers quoted, you must reimplement this function returning the result of the forceAsIdentifier function.
     */
    escape(identifier: string, strict: boolean): string
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
     * The nunber of arguments is the same specified in the function buildFragmentWithArgs (up to 5 arguments).
     * The arguments of the returned function will have the proper parameters type.
     */
    as(impl: (...args: AnyValueSource[]) => AnyValueSource): (...args: any) => AnyValueSource
}
```

```typescript
interface FragmentBuilderIfValue {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The nunber of arguments is the same specified in the function buildFragmentWithArgsIfValue (up to 5 arguments).
     * Any optional valueArg will be treated as required, the function received as argument will be not called if
     * that argument receives null or undefined.
     * The arguments of the returned function will have the proper parameters type.
     */
    as(impl: (...args: AnyValueSource[]) => AnyValueSource): (...args: any) => BooleanValueSource
}
```

```typescript
interface FragmentBuilderMaybeOptional {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The nunber of arguments is the same specified in the function buildFragmentWithArgs (up to 5 arguments).
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
    withValues(filter: DynamicFilter): BooleanValueSource
}
```
