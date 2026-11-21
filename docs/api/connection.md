---
search:
  boost: 0.3
---
# Connection API

This interface exposes all the methods required to interact with the database via `ts-sql-query`. It allows creating, executing and customizing SQL expressions, managing transactions, using constants, aggregates and sequences, and composing raw or typed SQL fragments.

To learn how to create and configure a connection and declare its tables, see [Connection](../configuration/connection.md) and [Mapping](../configuration/mapping.md); for transactions, [Transaction](../queries/transaction.md); for constants and fragments, [Basic query structure](../queries/basic-query-structure.md) and [SQL Fragments](../queries/sql-fragments.md); and for the conversion of the values, [Type adapters](../advanced/data-types/type-adapters.md).

A method that takes a type takes it by its class (`DataTypeClass`): the class of a built-in type, like `IntType`, or a class of yours that extends a family, like `CentsType`, which extends `IntegersType<Cents, 'Cents'>`. It takes it by its name too (`DataTypeName`): the name of a built-in type (`'boolean'`, `'int'`, `'bigint'`, `'double'`, `'string'`, `'uuid'`, `'stringDecimal'`, `'localDate'`, `'localTime'` or `'localDateTime'`), or the type name of a class of yours [registered](../advanced/data-types/own-data-types.md#giving-your-type-by-its-name), like `'Cents'`. The value source it gives has the methods of that type, and `T` is the type of its values: see [Data types](../configuration/data-types.md) and [Value expressions](value-expressions.md).

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
    currentPlainDate(): PlainDateValueSource
    currentPlainTime(): PlainTimeValueSource
    currentPlainDateTime(): PlainDateTimeValueSource
    /** The instant of now in the database, as Temporal's Now.instant(), with the digits of the fraction of a second it gives */
    currentInstant(): InstantValueSource
    /** The instant of the milliseconds since 1970-01-01T00:00Z, as Temporal's Instant.fromEpochMilliseconds: a number is sent as the instant */
    instantFromEpochMilliseconds(epochMilliseconds: number | NumberValueSource | BigintValueSource): InstantValueSource
    /** The instant of the nanoseconds since 1970-01-01T00:00Z, as Temporal's Instant.fromEpochNanoseconds: a bigint is sent as the instant */
    instantFromEpochNanoseconds(epochNanoseconds: bigint | BigintValueSource | NumberValueSource): InstantValueSource
    true(): BooleanValueSource
    false(): BooleanValueSource

    // Methods that create a value source with a constant value
    const<T>(value: T, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Methods that create a value source with an optional constant value
    optionalConst<T>(value: T | null | undefined, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>
    
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
    /** A number of yours, which extends AdditiveType or a family below it, gives its own type */
    sum(value: NumberValueSource): NumberValueSource
    sum(value: BigintValueSource): BigintValueSource
    sum<T, TYPE_NAME extends string>(value: AdditiveValueSource<T, TYPE_NAME>): AdditiveValueSource<T, TYPE_NAME>
    sum(value: StringDecimalValueSource): StringDecimalValueSource
    /** sum(distinct value) */
    sumDistinct(value: NumberValueSource): NumberValueSource
    sumDistinct(value: BigintValueSource): BigintValueSource
    sumDistinct<T, TYPE_NAME extends string>(value: AdditiveValueSource<T, TYPE_NAME>): AdditiveValueSource<T, TYPE_NAME>
    sumDistinct(value: StringDecimalValueSource): StringDecimalValueSource
    /** avg(value). It always returns a number, a double, also for a bigint or a number of yours */
    average(value: NumberValueSource | BigintValueSource | StringDecimalValueSource | AdditiveValueSource<any, any>): NumberValueSource
    /** avg(distinct value). It always returns a number, a double, also for a bigint or a number of yours */
    averageDistinct(value: NumberValueSource | BigintValueSource | StringDecimalValueSource | AdditiveValueSource<any, any>): NumberValueSource
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
    fragmentWithType(type: DataTypeName | DataTypeClass, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression

    // Same as fragmentWithType, but the produced value is treated as an aggregate
    aggregateFragmentWithType(type: DataTypeName | DataTypeClass, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression

    /** 
     * This is a template, you can call as: .rawFragment`sql text with ${valueSourceParam}` 
     */
    rawFragment(sql: TemplateStringsArray, ...p: Array<AnyValueSource | Subquery>): RawFragment

    // Protected method that calls a stored procedure. Any failure rejects the promise
    executeProcedure(procedureName: string, params: readonly AnyValueSource[]): Promise<void>

    // Protected methods that call a function. Any failure rejects the promise.
    // With 'optional' the promise also resolves to null; to simplify, that isn't written in the signatures below.
    executeFunction<T>(functionName: string, params: readonly AnyValueSource[], returnType: DataTypeName | DataTypeClass, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>

    // Protected methods to define a sequence (only available on MariaDB, Oracle, PostgreSQL and SQL Server)
    sequence<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): Sequence<ValueSource<T>>

    // Protected methods to define reusable fragments
    /**
     * Defines an argument that accepts a value or a value source of the specified type
     */
    arg<T>(type: DataTypeName | DataTypeClass, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T>

    /**
     * Defines an argument that accepts a value of the specified type, but not a value source
     */
    valueArg<T>(type: DataTypeName | DataTypeClass, required: 'required' | 'optional', adapter?: TypeAdapter): Argument<T>

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

    /** Protected method that transforms the values received from the database, as the type requested for them in the context */
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown
    /**
     * Protected method that transforms the values sent to the database, as the type requested for them in the context
     * (requestedType, by default the original one, originalType). In the context, forceTypeCast says whether the
     * database must receive the type of the parameter (true where the position in the SQL gives it no type; the query
     * runner then writes a cast or sends the parameter with its type, PostgreSQL only), and setMetadata keeps what the
     * query runner reads of the parameter
     */
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown
    /** Protected method that customizes the value placeholder in the query */
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext): string
    /**
     * Protected method that writes the SQL of a value as it leaves the database, in a column of the result. By default,
     * the conversion of the library: SQL Server writes a decimal as its text (saying 'columnEquality' in the context),
     * PostgreSQL and Oracle with a database outside UTC write a localDateTime or a localTime with its zone; every other
     * value keeps its SQL. In the context, comparison says how the SQL returned compares with the value: 'value' (the
     * default, it compares and orders like the value), 'equality' (it compares like the value but orders otherwise),
     * 'columnEquality' (as 'equality', only among the values of one column) or 'none'
     */
    transformProjection(sql: string, context: TypeAdapterProjectionContext): string

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

Each connection adds protected configuration properties of its own. The page of each database explains them: [MariaDB](../configuration/supported-databases/mariadb/index.md), [MySQL](../configuration/supported-databases/mysql/index.md), [Oracle](../configuration/supported-databases/oracle/index.md), [PostgreSQL](../configuration/supported-databases/postgresql/index.md), [SQLite](../configuration/supported-databases/sqlite/index.md) and [SQL Server](../configuration/supported-databases/sqlserver/index.md).

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
    temporalFunctions: 'installed' | 'not installed' // Default: 'not installed'
}

interface PostgreSqlConnectionConfiguration {
    usePlatformDependentRound: boolean // Default: false
    ignoreNullInMinAndMaxValue: boolean // Default: false
    minValueFunction?: string
    maxValueFunction?: string
    useLikeInsteadOfIlike: boolean // Default: false
    temporalFunctions: 'installed' | 'not installed' // Default: 'not installed'
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
