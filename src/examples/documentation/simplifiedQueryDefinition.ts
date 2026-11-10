// BEGIN

/*
 * Simplified versions of the query's API
 */

interface ValueSource<T, TYPE_NAME extends string> {
    isConstValue(): boolean
    /**
     * It returns the proper type of the value, instead of the any type included here to simplify
     * If the value source is not a const value it throws an error
     */
    getConstValue(): any
    /**
     * Makes the query fail if the value source is used in it and the boolean value provided as argument is false.
     * execute* rejects the promise with the error. query() and params() throw it.
     */
    allowWhen(when: boolean, errorMessage: string): this
    allowWhen(when: boolean, error: Error): this
    /**
     * Makes the query fail if the value source is used in it and the boolean value provided as argument is true.
     * execute* rejects the promise with the error. query() and params() throw it.
     */
    disallowWhen(when: boolean, errorMessage: string): this
    disallowWhen(when: boolean, error: Error): this
}

interface NullableValueSource<T, TYPE_NAME extends string> extends ValueSource<T, TYPE_NAME> {
    isNull(): BooleanValueSource
    isNotNull(): BooleanValueSource
    /** The result is required if the provided value is required */
    valueWhenNull(value: T | this): this
    /** The result is optional */
    nullIfValue(value: T | this): this
    /** The result is optional */
    asOptional(): this
    /** The value is required when the object that contains it has a value */
    asRequiredInOptionalObject(): this
    /** The value when the argument is true, and null otherwise. The result is optional */
    onlyWhenOrNull(when: boolean): this
    /** Null when the argument is true, and the value otherwise. The result is optional */
    ignoreWhenAsNull(when: boolean): this
}

interface EqualableValueSource<T, TYPE_NAME extends string> extends NullableValueSource<T, TYPE_NAME> {
    equalsIfValue(value: T | null | undefined): IfValueSource
    equals(value: T | this): BooleanValueSource
    notEqualsIfValue(value: T | null | undefined): IfValueSource
    notEquals(value: T | this): BooleanValueSource
    isIfValue(value: T | null | undefined): IfValueSource
    /** 'is' is the same as equals, but returns true when both are null. The result is required */
    is(value: T | null | undefined | this): BooleanValueSource
    isNotIfValue(value: T | null | undefined): IfValueSource
    /** The result is required */
    isNot(value: T | null | undefined | this): BooleanValueSource

    inIfValue(values: T[] | null | undefined): IfValueSource
    in(values: T[] | this): BooleanValueSource
    /** The result is optional if the column of the subquery is optional */
    in(select: Subquery): BooleanValueSource
    notInIfValue(values: T[] | null | undefined): IfValueSource
    notIn(values: T[] | this): BooleanValueSource
    /** The result is optional if the column of the subquery is optional */
    notIn(select: Subquery): BooleanValueSource
    inN(...value: Array<T | this>): BooleanValueSource
    notInN(...value: Array<T | this>): BooleanValueSource
}

interface ComparableValueSource<T, TYPE_NAME extends string> extends EqualableValueSource<T, TYPE_NAME> {
    lessThanIfValue(value: T | null | undefined): IfValueSource
    lessThan(value: T | this): BooleanValueSource
    greaterThanIfValue(value: T | null | undefined): IfValueSource
    greaterThan(value: T | this): BooleanValueSource
    lessOrEqualIfValue(value: T | null | undefined): IfValueSource
    lessOrEqual(value: T | this): BooleanValueSource
    greaterOrEqualIfValue(value: T | null | undefined): IfValueSource
    greaterOrEqual(value: T | this): BooleanValueSource
    between(value: T | this, value2: T | this): BooleanValueSource
    notBetween(value: T | this, value2: T | this): BooleanValueSource
}

/**
 * Represents a boolean
 */
interface BooleanValueSource extends EqualableValueSource<boolean, 'boolean'> {
    negate(): this
    and(value: boolean | BooleanValueSource | IfValueSource | AlwaysIfValueSource): this
    or(value: boolean | BooleanValueSource | IfValueSource | AlwaysIfValueSource): this
    /** Returns a boolean expression that only applies if the argument is true */
    onlyWhen(condition: boolean): IfValueSource
    /** Returns a boolean expression that only applies if the argument is false, it is ignored when true */
    ignoreWhen(condition: boolean): IfValueSource
}

/**
 * Represents a boolean that may have no value: the result of an *IfValue function, onlyWhen, ignoreWhen or noValueBoolean.
 * When it has no value it is neutral: an and or an or with it gives the other operand, and a where with it is left out.
 */
interface IfValueSource {
    /** A neutral boolean stays neutral */
    negate(): IfValueSource
    /** The result is a BooleanValueSource if the argument is a boolean or a BooleanValueSource */
    and(value: boolean | BooleanValueSource | IfValueSource | AlwaysIfValueSource): BooleanValueSource | IfValueSource
    /** The result is a BooleanValueSource if the argument is a boolean or a BooleanValueSource */
    or(value: boolean | BooleanValueSource | IfValueSource | AlwaysIfValueSource): BooleanValueSource | IfValueSource
    /** Returns a boolean expression that only applies if the argument is true */
    onlyWhen(condition: boolean): IfValueSource
    /** Returns a boolean expression that only applies if the argument is false, it is ignored when true */
    ignoreWhen(condition: boolean): IfValueSource
    /**
     * Returns true when it has no value: null, undefined, an empty string (unless allowEmptyString is true) or an empty array
     * was provided to the *IfValue function, or the condition was discarded by onlyWhen or ignoreWhen.
     */
    trueWhenNoValue(): BooleanValueSource
    /** Same as trueWhenNoValue, but it returns false */
    falseWhenNoValue(): BooleanValueSource
    /** Same as trueWhenNoValue, but it returns the provided value. The result is an IfValueSource if the argument is one */
    valueWhenNoValue(value: boolean | BooleanValueSource): BooleanValueSource
    valueWhenNoValue(value: IfValueSource | AlwaysIfValueSource): IfValueSource
}

/**
 * The same as IfValueSource, but every method returns this same type. It is the result of dynamicBooleanExpressionUsing,
 * and allows to reassign a variable while a boolean expression is built.
 */
interface AlwaysIfValueSource {
    negate(): this
    and(value: boolean | BooleanValueSource | IfValueSource | AlwaysIfValueSource): this
    or(value: boolean | BooleanValueSource | IfValueSource | AlwaysIfValueSource): this
    onlyWhen(condition: boolean): this
    ignoreWhen(condition: boolean): this
    trueWhenNoValue(): this
    falseWhenNoValue(): this
    valueWhenNoValue(value: boolean | BooleanValueSource | IfValueSource | AlwaysIfValueSource): this
}

/**
 * Represents an int or a double
 */
interface NumberValueSource extends ComparableValueSource<number, 'number'> {
    /** It may lose the decimals: the value is rounded when necessary */
    asInt(): NumberValueSource
    asDouble(): NumberValueSource
    /** It may lose the decimals: the value is rounded when necessary */
    asBigint(): BigintValueSource
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    exp(): this
    ln(): this
    log10(): this
    sqrt(): this
    cbrt(): this
    sign(): this
    acos(): this
    asin(): this
    atan(): this
    cos(): this
    cot(): this
    sin(): this
    tan(): this
    power(value: number | this): this
    logn(value: number | this): this
    roundn(value: number | this): this
    /**
     * This function establishes a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: number | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: number | this): this
    add(value: number | this): this
    subtract(value: number | this): this
    multiply(value: number | this): this
    divide(value: number | this): this
    modulo(value: number | this): this
    atan2(value: number | this): this
}

/**
 * Represents a bigint
 */
interface BigintValueSource extends ComparableValueSource<bigint, 'bigint'> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    sign(): NumberValueSource
    /**
     * This function establishes a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: bigint | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: bigint | this): this
    add(value: bigint | this): this
    subtract(value: bigint | this): this
    modulo(value: bigint | this): this
}

/**
 * Represents a string
 */
interface StringValueSource extends ComparableValueSource<string, 'string'> {
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    equalsInsensitive(value: string | this): BooleanValueSource
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notEqualsInsensitive(value: string | this): BooleanValueSource
    likeIfValue(value: string | null | undefined): IfValueSource
    like(value: string | this): BooleanValueSource
    notLikeIfValue(value: string | null | undefined): IfValueSource
    notLike(value: string | this): BooleanValueSource
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource
    likeInsensitive(value: string | this): BooleanValueSource
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notLikeInsensitive(value: string | this): BooleanValueSource
    startsWithIfValue(value: string | null | undefined): IfValueSource
    startsWith(value: string | this): BooleanValueSource
    notStartsWithIfValue(value: string | null | undefined): IfValueSource
    notStartsWith(value: string | this): BooleanValueSource
    endsWithIfValue(value: string | null | undefined): IfValueSource
    endsWith(value: string | this): BooleanValueSource
    notEndsWithIfValue(value: string | null | undefined): IfValueSource
    notEndsWith(value: string | this): BooleanValueSource
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    startsWithInsensitive(value: string | this): BooleanValueSource
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notStartsWithInsensitive(value: string | this): BooleanValueSource
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    endsWithInsensitive(value: string | this): BooleanValueSource
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notEndsWithInsensitive(value: string | this): BooleanValueSource
    containsIfValue(value: string | null | undefined): IfValueSource
    contains(value: string | this): BooleanValueSource
    notContainsIfValue(value: string | null | undefined): IfValueSource
    notContains(value: string | this): BooleanValueSource
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    containsInsensitive(value: string | this): BooleanValueSource
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notContainsInsensitive(value: string | this): BooleanValueSource
    toLowerCase(): StringValueSource
    toUpperCase(): StringValueSource
    length(): NumberValueSource
    trim(): StringValueSource
    trimLeft(): StringValueSource
    trimRight(): StringValueSource
    reverse(): StringValueSource
    /** Forces a collation on this expression. The name is the one of the database, so it isn't portable */
    collate(collation: string): StringValueSource
    concatIfValue(value: string | null | undefined): StringValueSource
    concat(value: string | this): StringValueSource
    /** The same as concatIgnoringNull, and the operand is dropped when it has no value. The result is optional if this value is optional */
    concatIgnoringNullIfValue(value: string | null | undefined): StringValueSource
    /** A concatenation that reads null as an empty string. The result is optional only if both operands are optional */
    concatIgnoringNull(value: string | this): StringValueSource
    substrToEnd(start: number | NumberValueSource): StringValueSource
    substringToEnd(start: number | NumberValueSource): StringValueSource
    substr(start: number | NumberValueSource, count: number | NumberValueSource): StringValueSource
    substring(start: number | NumberValueSource, end: number | NumberValueSource): StringValueSource
    /** At most one of the arguments can be a value source */
    replaceAllIfValue(findString: string | null | undefined | this, replaceWith: string | null | undefined | this): StringValueSource
    replaceAll(findString: string | this, replaceWith: string | this): StringValueSource
    /** At most one of the arguments can be a value source */
    replaceAllInsensitiveIfValue(findString: string | null | undefined | this, replaceWith: string | null | undefined | this): StringValueSource
    replaceAllInsensitive(findString: string | this, replaceWith: string | this): StringValueSource
}

/**
 * Represents an UUID
 */
interface UuidValueSource extends ComparableValueSource<string, 'uuid'> {
    asString(): StringValueSource
}

/**
 * Represents a local date without time (using a Date object)
 */
interface LocalDateValueSource extends ComparableValueSource<Date, 'localDate'> {
    /** Gets the year, in UTC (as getUTCFullYear) */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11), in UTC (as getUTCMonth) */
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month, in UTC (as getUTCDate) */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday), in UTC (as getUTCDay) */
    getDay(): NumberValueSource
}

/**
 * Represents a local time without date (using a Date object)
 */
interface LocalTimeValueSource extends ComparableValueSource<Date, 'localTime'> {
    /** Gets the hours, in UTC (as getUTCHours) */
    getHours(): NumberValueSource
    /** Gets the minutes, in UTC (as getUTCMinutes) */
    getMinutes(): NumberValueSource
    /** Gets the seconds, in UTC (as getUTCSeconds) */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds, in UTC (as getUTCMilliseconds) */
    getMilliseconds(): NumberValueSource
}

/**
 * Represents a local date with time (using a Date object)
 */
interface LocalDateTimeValueSource extends ComparableValueSource<Date, 'localDateTime'> {
    /** Gets the year, in UTC (as getUTCFullYear) */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11), in UTC (as getUTCMonth) */
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month, in UTC (as getUTCDate) */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday), in UTC (as getUTCDay) */
    getDay(): NumberValueSource
    /** Gets the hours, in UTC (as getUTCHours) */
    getHours(): NumberValueSource
    /** Gets the minutes, in UTC (as getUTCMinutes) */
    getMinutes(): NumberValueSource
    /** Gets the seconds, in UTC (as getUTCSeconds) */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds, in UTC (as getUTCMilliseconds) */
    getMilliseconds(): NumberValueSource
    /** Gets the time value in milliseconds */
    getTime(): NumberValueSource
}

/**
 * Represents a custom int
 */
interface CustomIntValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    sign(): NumberValueSource
    /**
     * This function establishes a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: T | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: T | this): this
    add(value: T | this): this
    subtract(value: T | this): this
    multiply(value: T | this): this
    modulo(value: T | this): this
}

/**
 * Represents a custom bigint
 */
interface CustomBigintValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    sign(): NumberValueSource
    /**
     * This function establishes a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: T | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: T | this): this
    add(value: T | this): this
    subtract(value: T | this): this
    modulo(value: T | this): this
}

/**
 * Represents a custom double
 */
interface CustomDoubleValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    exp(): this
    ln(): this
    log10(): this
    sqrt(): this
    cbrt(): this
    sign(): NumberValueSource
    acos(): this
    asin(): this
    atan(): this
    cos(): this
    cot(): this
    sin(): this
    tan(): this
    power(value: T | this): this
    logn(value: T | this): this
    /** The number of decimals can be a value of the custom type or a number, or a value source of either */
    roundn(value: T | number | this | NumberValueSource): this
    /**
     * This function establishes a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: T | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: T | this): this
    add(value: T | this): this
    subtract(value: T | this): this
    multiply(value: T | this): this
    divide(value: T | this): this
    modulo(value: T | this): this
    atan2(value: T | this): this
}

/**
 * Represents a custom decimal: a decimal number of a type of your own, sent to and received from the database as its
 * text, so it keeps every digit. The functions whose result can't be exact return a double.
 */
interface CustomDecimalValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    exp(): NumberValueSource
    ln(): NumberValueSource
    log10(): NumberValueSource
    sqrt(): NumberValueSource
    cbrt(): NumberValueSource
    sign(): NumberValueSource
    acos(): NumberValueSource
    asin(): NumberValueSource
    atan(): NumberValueSource
    cos(): NumberValueSource
    cot(): NumberValueSource
    sin(): NumberValueSource
    tan(): NumberValueSource
    power(value: number | NumberValueSource): NumberValueSource
    logn(value: number | NumberValueSource): NumberValueSource
    /** The number of decimals is a number, or a value source of one */
    roundn(value: number | NumberValueSource): this
    /**
     * This function establishes a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: T | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: T | this): this
    add(value: T | this): this
    subtract(value: T | this): this
    multiply(value: T | this): this
    modulo(value: T | this): this
    atan2(value: number | NumberValueSource): NumberValueSource
}

/**
 * Represents a decimal number whose value is its text, a JavaScript string (`'1.50'`), kept with every digit
 */
interface StringDecimalValueSource extends ComparableValueSource<string, 'stringDecimal'> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    exp(): NumberValueSource
    ln(): NumberValueSource
    log10(): NumberValueSource
    sqrt(): NumberValueSource
    cbrt(): NumberValueSource
    sign(): NumberValueSource
    acos(): NumberValueSource
    asin(): NumberValueSource
    atan(): NumberValueSource
    cos(): NumberValueSource
    cot(): NumberValueSource
    sin(): NumberValueSource
    tan(): NumberValueSource
    power(value: number | NumberValueSource): NumberValueSource
    logn(value: number | NumberValueSource): NumberValueSource
    /** The number of decimals is a number, or a value source of one */
    roundn(value: number | NumberValueSource): this
    /**
     * This function establishes a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: string | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: string | this): this
    add(value: string | this): this
    subtract(value: string | this): this
    multiply(value: string | this): this
    modulo(value: string | this): this
    atan2(value: number | NumberValueSource): NumberValueSource
}

/**
 * Represents a custom UUID
 */
interface CustomUuidValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    asString(): StringValueSource
}

/**
 * Represents a custom local date without time (using a Date object)
 */
interface CustomLocalDateValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the year, in UTC (as getUTCFullYear) */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11), in UTC (as getUTCMonth) */
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month, in UTC (as getUTCDate) */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday), in UTC (as getUTCDay) */
    getDay(): NumberValueSource
}

/**
 * Represents a custom local time without date (using a Date object)
 */
interface CustomLocalTimeValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the hours, in UTC (as getUTCHours) */
    getHours(): NumberValueSource
    /** Gets the minutes, in UTC (as getUTCMinutes) */
    getMinutes(): NumberValueSource
    /** Gets the seconds, in UTC (as getUTCSeconds) */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds, in UTC (as getUTCMilliseconds) */
    getMilliseconds(): NumberValueSource
}

/**
 * Represents a custom local date with time (using a Date object)
 */
interface CustomLocalDateTimeValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the year, in UTC (as getUTCFullYear) */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11), in UTC (as getUTCMonth) */
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month, in UTC (as getUTCDate) */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday), in UTC (as getUTCDay) */
    getDay(): NumberValueSource
    /** Gets the hours, in UTC (as getUTCHours) */
    getHours(): NumberValueSource
    /** Gets the minutes, in UTC (as getUTCMinutes) */
    getMinutes(): NumberValueSource
    /** Gets the seconds, in UTC (as getUTCSeconds) */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds, in UTC (as getUTCMilliseconds) */
    getMilliseconds(): NumberValueSource
    /** Gets the time value in milliseconds */
    getTime(): NumberValueSource
}

/**
 * Represents the result of an aggregate as object array
 */
interface AggregatedArrayValueSource<T> extends ValueSource<T, 'aggregated'> {
    /** Returns an empty array when there is no value, which is the default. The result is required */
    useEmptyArrayForNoValue(): AggregatedArrayValueSource<T>
    /** The result is optional, an array with at least one element when it has a value */
    asOptionalNonEmptyArray(): AggregatedArrayValueSource<T>
    asRequiredInOptionalObject(): AggregatedArrayValueSource<T>
    onlyWhenOrNull(when: boolean): AggregatedArrayValueSource<T>
    ignoreWhenAsNull(when: boolean): AggregatedArrayValueSource<T>
}

interface AggregatedArrayValueSourceProjectableAsNullable<T> extends AggregatedArrayValueSource<T> {
    /** Returns the optional values as null instead of optional undefined values */
    projectingOptionalValuesAsNullable(): AggregatedArrayValueSource<T>
}






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
    sum(value: StringDecimalValueSource): StringDecimalValueSource
    sum<T, TYPE_NAME extends string>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    sum<T, TYPE_NAME extends string>(value: CustomBigintValueSource<T, TYPE_NAME>): CustomBigintValueSource<T, TYPE_NAME>
    sum<T, TYPE_NAME extends string>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
    sum<T, TYPE_NAME extends string>(value: CustomDecimalValueSource<T, TYPE_NAME>): CustomDecimalValueSource<T, TYPE_NAME>
    /** sum(distinct value) */
    sumDistinct(value: NumberValueSource): NumberValueSource
    sumDistinct(value: BigintValueSource): BigintValueSource
    sumDistinct(value: StringDecimalValueSource): StringDecimalValueSource
    sumDistinct<T, TYPE_NAME extends string>(value: CustomIntValueSource<T, TYPE_NAME>): CustomIntValueSource<T, TYPE_NAME>
    sumDistinct<T, TYPE_NAME extends string>(value: CustomBigintValueSource<T, TYPE_NAME>): CustomBigintValueSource<T, TYPE_NAME>
    sumDistinct<T, TYPE_NAME extends string>(value: CustomDoubleValueSource<T, TYPE_NAME>): CustomDoubleValueSource<T, TYPE_NAME>
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
    /** Protected method that decides whether the database must receive the type of the parameter */
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
    /** Protected method that writes the SQL of a value as it leaves the database, in a column of the result */
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string

    /** Protected method that returns true if the provided string is a reserved keyword */
    isReservedKeyword(word: string): boolean
    /** Protected method that returns the provided string as an identifier, always quoted */
    forceAsIdentifier(identifier: string): string
    /** 
     * Protected method that returns the provided identifier escaped.
     * The default implementation quotes the identifier only if it is a reserved keyword.
     * To quote all identifiers, reimplement this function returning the result of forceAsIdentifier.
     */
    escape(identifier: string, strict: boolean, allowReservedKeyword?: boolean): string
}

interface FragmentExpression {
    /** 
     * This is a template, you can call as: .sql`sql text with ${valueSourceParam}` 
     * You can specify up to 7 parameters.
     */
    sql(sql: TemplateStringsArray, ...p: AnyValueSource[]): AnyValueSource
}

interface FragmentBuilder {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The number of arguments is the same specified in the function buildFragmentWithArgs (up to 5 arguments).
     * The arguments of the returned function will have the proper parameters type.
     */
    as(impl: (...args: AnyValueSource[]) => AnyValueSource): (...args: any) => AnyValueSource
}

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

interface Sequence<T> {
    nextValue(): T
    currentValue(): T
}

interface DynamicConditionExpression {
    /** The result is an optional boolean. The filter accepts the rules of the extension provided to dynamicConditionFor */
    withValues(filter: DynamicFilter): BooleanValueSource
}

/** The fields of a dynamic condition: a value source, or an object with more fields inside */
type Filterable = { [fieldName: string]: AnyValueSource | Filterable }

/**
 * The rules of your own of a dynamic condition. A rule is a function that receives its configuration and returns
 * a boolean. They can be grouped in inner objects.
 */
type DynamicConditionExtension = { [ruleName: string]: ((rule: any) => BooleanValueSource | IfValueSource | AlwaysIfValueSource) | DynamicConditionExtension }

/**
 * The criteria of a dynamic condition. Every property is optional:
 * - not, and, or: the logical operations. Several properties in a filter are joined using and.
 * - One property per field of the definition provided to dynamicConditionFor, with the filter of its type.
 *   A field that is an object has a filter of this same type.
 * - One property per rule of the extension provided to dynamicConditionFor, with the configuration its function
 *   receives; a rule is also accepted inside the filter of a field.
 * An operator with an empty value (null, an empty string, an empty array) adds no condition.
 */
type DynamicFilter = {
    not?: DynamicFilter
    and?: Array<DynamicFilter | undefined>
    or?: Array<DynamicFilter | undefined>
    [fieldOrRuleName: string]: FieldFilter | DynamicFilter | any
}

/**
 * The filter of a field, according to its type: BooleanFilter for boolean, NumberFilter for int and double, BigintFilter for bigint,
 * StringFilter for string and uuid, StringDecimalFilter for stringDecimal, DateFilter for localDate, TimeFilter for localTime, DateTimeFilter for localDateTime,
 * EqualableFilter for enum and custom, ComparableFilter for customComparable, and for the other custom types the filter of its name.
 * The uuid and customUuid types accept the text operators, and they apply asString before them.
 */
type FieldFilter = BooleanFilter | NumberFilter | BigintFilter | StringFilter | StringDecimalFilter | DateFilter | TimeFilter | DateTimeFilter | EqualableFilter<any> | ComparableFilter<any> | CustomIntFilter<any> | CustomBigintFilter<any> | CustomDoubleFilter<any> | CustomDecimalFilter<any> | CustomUuidFilter<any> | CustomLocalDateFilter<any> | CustomLocalTimeFilter<any> | CustomLocalDateTimeFilter<any>

interface NullableFilter {
    isNull?: boolean
    isNotNull?: boolean
}

interface EqualableFilter<TYPE> extends NullableFilter {
    equalsIfValue?: TYPE | null | undefined
    equals?: TYPE
    notEqualsIfValue?: TYPE | null | undefined
    notEquals?: TYPE
    isIfValue?: TYPE | null | undefined
    is?: TYPE | null | undefined
    isNotIfValue?: TYPE | null | undefined
    isNot?: TYPE | null | undefined
    inIfValue?: TYPE[] | null | undefined
    in?: TYPE[]
    notInIfValue?: TYPE[] | null | undefined
    notIn?: TYPE[]
}

interface ComparableFilter<TYPE> extends EqualableFilter<TYPE> {
    lessThanIfValue?: TYPE | null | undefined
    lessThan?: TYPE
    greaterThanIfValue?: TYPE | null | undefined
    greaterThan?: TYPE
    lessOrEqualIfValue?: TYPE | null | undefined
    lessOrEqual?: TYPE
    greaterOrEqualIfValue?: TYPE | null | undefined
    greaterOrEqual?: TYPE
}

interface StringFilter extends ComparableFilter<string> {
    equalsInsensitiveIfValue?: string | null | undefined
    equalsInsensitive?: string
    notEqualsInsensitiveIfValue?: string | null | undefined
    notEqualsInsensitive?: string
    likeIfValue?: string | null | undefined
    like?: string
    notLikeIfValue?: string | null | undefined
    notLike?: string
    likeInsensitiveIfValue?: string | null | undefined
    likeInsensitive?: string
    notLikeInsensitiveIfValue?: string | null | undefined
    notLikeInsensitive?: string
    startsWithIfValue?: string | null | undefined
    startsWith?: string
    notStartsWithIfValue?: string | null | undefined
    notStartsWith?: string
    endsWithIfValue?: string | null | undefined
    endsWith?: string
    notEndsWithIfValue?: string | null | undefined
    notEndsWith?: string
    startsWithInsensitiveIfValue?: string | null | undefined
    startsWithInsensitive?: string
    notStartsWithInsensitiveIfValue?: string | null | undefined
    notStartsWithInsensitive?: string
    endsWithInsensitiveIfValue?: string | null | undefined
    endsWithInsensitive?: string
    notEndsWithInsensitiveIfValue?: string | null | undefined
    notEndsWithInsensitive?: string
    containsIfValue?: string | null | undefined
    contains?: string
    notContainsIfValue?: string | null | undefined
    notContains?: string
    containsInsensitiveIfValue?: string | null | undefined
    containsInsensitive?: string
    notContainsInsensitiveIfValue?: string | null | undefined
    notContainsInsensitive?: string
}

interface CustomUuidFilter<TYPE> extends ComparableFilter<TYPE> {
    equalsInsensitiveIfValue?: TYPE | null | undefined
    equalsInsensitive?: TYPE
    notEqualsInsensitiveIfValue?: TYPE | null | undefined
    notEqualsInsensitive?: TYPE
    likeIfValue?: TYPE | null | undefined
    like?: TYPE
    notLikeIfValue?: TYPE | null | undefined
    notLike?: TYPE
    likeInsensitiveIfValue?: TYPE | null | undefined
    likeInsensitive?: TYPE
    notLikeInsensitiveIfValue?: TYPE | null | undefined
    notLikeInsensitive?: TYPE
    startsWithIfValue?: TYPE | null | undefined
    startsWith?: TYPE
    notStartsWithIfValue?: TYPE | null | undefined
    notStartsWith?: TYPE
    endsWithIfValue?: TYPE | null | undefined
    endsWith?: TYPE
    notEndsWithIfValue?: TYPE | null | undefined
    notEndsWith?: TYPE
    startsWithInsensitiveIfValue?: TYPE | null | undefined
    startsWithInsensitive?: TYPE
    notStartsWithInsensitiveIfValue?: TYPE | null | undefined
    notStartsWithInsensitive?: TYPE
    endsWithInsensitiveIfValue?: TYPE | null | undefined
    endsWithInsensitive?: TYPE
    notEndsWithInsensitiveIfValue?: TYPE | null | undefined
    notEndsWithInsensitive?: TYPE
    containsIfValue?: TYPE | null | undefined
    contains?: TYPE
    notContainsIfValue?: TYPE | null | undefined
    notContains?: TYPE
    containsInsensitiveIfValue?: TYPE | null | undefined
    containsInsensitive?: TYPE
    notContainsInsensitiveIfValue?: TYPE | null | undefined
    notContainsInsensitive?: TYPE
}

interface BooleanFilter extends EqualableFilter<boolean> { }
interface NumberFilter extends ComparableFilter<number> { }
interface BigintFilter extends ComparableFilter<bigint> { }
interface DateFilter extends ComparableFilter<Date> { }
interface TimeFilter extends ComparableFilter<Date> { }
interface DateTimeFilter extends ComparableFilter<Date> { }
interface CustomIntFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomBigintFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomDoubleFilter<TYPE> extends ComparableFilter<TYPE> { }
interface StringDecimalFilter extends ComparableFilter<string> { }
interface CustomDecimalFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomLocalDateFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomLocalTimeFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomLocalDateTimeFilter<TYPE> extends ComparableFilter<TYPE> { }

// Protected configuration properties that each connection adds
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
    sqliteRunsInApplicationTimeZone: boolean // Default: false
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







interface Table {
    /** Defines an alias for the table to be used in select queries */
    as(as: string): this
    /** Enables the table to be used in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Enables the table to be used in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource
    /**
     * Returns a reference to the values the row had before an update, to use in its returning clause.
     * Only available on MariaDB, PostgreSQL and SQL Server.
     */
    oldValues(): this
    /**
     * Returns a reference to the values of the new row of an insert with an on conflict clause, to use in its do update.
     * Only available on MariaDB, MySQL, PostgreSQL and SQLite.
     */
    valuesForInsert(): this

    // Protected methods that create a required column that doesn't admit null
    column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    column(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    column(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    column<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
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
    optionalColumn(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // Protected methods that create a required column that doesn't admit null and has a default value on insert
    columnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    columnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    columnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    columnWithDefaultValue(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    columnWithDefaultValue(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    columnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    columnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    columnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    columnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // Protected methods that create an optional column that admits null and has a default value on insert
    optionalColumnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumnWithDefaultValue(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalColumnWithDefaultValue(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalColumnWithDefaultValue<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
    
    // Protected methods that create a primary key column autogenerated in the database
    // When you insert you don't need to specify this column
    autogeneratedPrimaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    autogeneratedPrimaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKey(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    autogeneratedPrimaryKey(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    autogeneratedPrimaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKey<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create a primary key column not automatically generated
    // When you insert you must specify this column
    primaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    primaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    primaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    primaryKey(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    primaryKey(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    primaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    primaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    primaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    primaryKey<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
      
    // Protected methods that create a primary key column generated by a sequence
    // When you insert you don't need to specify this column, it will be added automatically by ts-sql-query
    // Only available on MariaDB, Oracle, PostgreSQL and SQL Server
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    autogeneratedPrimaryKeyBySequence<T, TYPE_NAME extends string>(name: string, sequenceName: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create a computed column that doesn't admit null
    computedColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    computedColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    computedColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    computedColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    computedColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    computedColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    computedColumn(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    computedColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    computedColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    computedColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    computedColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create an optional computed column that admits null
    optionalComputedColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalComputedColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalComputedColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalComputedColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalComputedColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalComputedColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource
    optionalComputedColumn(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    optionalComputedColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalComputedColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalComputedColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalComputedColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create a column from a sql fragment in the table
    virtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    virtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    virtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    virtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    virtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    virtualColumnFromFragment(type: 'stringDecimal', fn: (fragment: FragmentExpression) => StringDecimalValueSource, adapter?: TypeAdapter): StringDecimalValueSource
    virtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    virtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDecimalValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>

    // Protected methods that create an optional column from a sql fragment in the table
    optionalVirtualColumnFromFragment(type: 'boolean', fn: (fragment: FragmentExpression) => BooleanValueSource, adapter?: TypeAdapter): BooleanValueSource
    optionalVirtualColumnFromFragment(type: 'int', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'bigint', fn: (fragment: FragmentExpression) => BigintValueSource, adapter?: TypeAdapter): BigintValueSource
    optionalVirtualColumnFromFragment(type: 'double', fn: (fragment: FragmentExpression) => NumberValueSource, adapter?: TypeAdapter): NumberValueSource
    optionalVirtualColumnFromFragment(type: 'string', fn: (fragment: FragmentExpression) => StringValueSource, adapter?: TypeAdapter): StringValueSource
    optionalVirtualColumnFromFragment(type: 'uuid', fn: (fragment: FragmentExpression) => UuidValueSource, adapter?: TypeAdapter): UuidValueSource
    optionalVirtualColumnFromFragment(type: 'stringDecimal', fn: (fragment: FragmentExpression) => StringDecimalValueSource, adapter?: TypeAdapter): StringDecimalValueSource
    optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDecimalValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
}





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
    column(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    column<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
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
    optionalColumn(name: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
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
    virtualColumnFromFragment(type: 'stringDecimal', fn: (fragment: FragmentExpression) => StringDecimalValueSource, adapter?: TypeAdapter): StringDecimalValueSource
    virtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    virtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDecimalValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
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
    optionalVirtualColumnFromFragment(type: 'stringDecimal', fn: (fragment: FragmentExpression) => StringDecimalValueSource, adapter?: TypeAdapter): StringDecimalValueSource
    optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDecimalValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
}






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
    column(type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    column(type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    column(type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    column(type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    column<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    column<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
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
    optionalColumn(type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource
    optionalColumn(type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource
    optionalColumn(type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource
    optionalColumn(type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalColumn<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalColumn<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
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
    virtualColumnFromFragment(type: 'stringDecimal', fn: (fragment: FragmentExpression) => StringDecimalValueSource, adapter?: TypeAdapter): StringDecimalValueSource
    virtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    virtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDecimalValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
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
    optionalVirtualColumnFromFragment(type: 'stringDecimal', fn: (fragment: FragmentExpression) => StringDecimalValueSource, adapter?: TypeAdapter): StringDecimalValueSource
    optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: FragmentExpression) => LocalDateValueSource, adapter?: TypeAdapter): LocalDateValueSource
    optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: FragmentExpression) => LocalTimeValueSource, adapter?: TypeAdapter): LocalTimeValueSource
    optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: FragmentExpression) => LocalDateTimeValueSource, adapter?: TypeAdapter): LocalDateTimeValueSource
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomIntValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomIntValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomBigintValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomBigintValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDoubleValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDoubleValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomDecimalValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomDecimalValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomUuidValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomUuidValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => CustomLocalDateTimeValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => EqualableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): EqualableValueSource<T, TYPE_NAME>
    optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: FragmentExpression) => ComparableValueSource<T, TYPE_NAME>, adapter?: TypeAdapter): ComparableValueSource<T, TYPE_NAME>
}






interface InsertExpression {
    /**
     * Sets the shape of the values to insert. This shape allows you to map
     * each property in the values to insert with the column's name in the table, in that
     * way, the property in the value doesn't need to have the same name.
     * The only values to be inserted are the ones included in the shape.
     */
    shapedAs(shape: InsertShape): this
    /** 
     * Extends the previously set shape.
     * The values set after extending the shape will allow you to include the new properties in the extended shape.
     */
    extendShape(shape: InsertShape): this

    /** Alias to set method: sets the values for insert */
    values(columns: InsertSets): this
    /** Inserts multiple rows in the database */
    values(columns: InsertSets[]): this
    /** 
     * Sets the values for insert. An undefined value writes a null.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    set(columns: InsertSets): this
    /** 
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfValue(columns: OptionalInsertSets): this
    /** 
     * Sets a value only if the column was previously set.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfSet(columns: InsertSets): this
    /** 
     * Sets a value only if the column was previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Sets a value only if the column was not previously set.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Sets a value only if the column was not previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Unsets the listed columns previously set.
     * It can be used in an insert of multiple values.
     */
    ignoreIfSet(...columns: string[]): this
    /** 
     * Keeps only the listed columns previously set.
     * It can be used in an insert of multiple values.
     */
    keepOnly(...columns: string[]): this

    /** 
     * Sets a value for the specified columns that were previously given a value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasValue(columns: InsertSets): this
    /** 
     * Sets a value for the specified columns that were previously given a value, 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * Sets a value for the specified columns that have no value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasNoValue(columns: InsertSets): this
    /** 
     * Sets a value for the specified columns that have no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasNoValueIfValue(columns: OptionalInsertSets): this
    /** 
     * Unsets the listed columns if they have a value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unsets the listed columns if they have no value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unsets all columns that were set with no value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreAnySetWithNoValue(): this

    /** 
     * This only applies in an insert of multiple values.
     * Sets the values for insert 
     */
    setForAll(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfValue(columns: OptionalInsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was previously set 
     */
    setForAllIfSet(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was not previously set 
     */
    setForAllIfNotSet(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was not previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfNotSetIfValue(columns: OptionalInsertSets): this

    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that were previously given a value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValue(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that were previously given a value, 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that have no value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValue(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that have no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValueIfValue(columns: OptionalInsertSets): this

    /**
     * Throws an error, when it is called, if the indicated properties are set
     */
    disallowIfSet(errorMessage: string, ...columns: string[]): this
    disallowIfSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties are not set
     */
    disallowIfNotSet(errorMessage: string, ...columns: string[]): this
    disallowIfNotSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties were set with a value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties were not set or have no value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfNoValue(errorMessage: string, ...columns: string[]): this
    disallowIfNoValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if any column other than the listed ones is set.
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this

    //
    // When variants, that only apply if the first param is true
    //

    setWhen(when: boolean, columns: InsertSets): this
    setIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setIfSetWhen(when: boolean, columns: InsertSets): this
    setIfSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setIfNotSetWhen(when: boolean, columns: InsertSets): this
    setIfNotSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    ignoreIfSetWhen(when: boolean, ...columns: string[]): this
    keepOnlyWhen(when: boolean, ...columns: string[]): this
    setIfHasValueWhen(when: boolean, columns: InsertSets): this
    setIfHasValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setIfHasNoValueWhen(when: boolean, columns: InsertSets): this
    setIfHasNoValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    ignoreIfHasValueWhen(when: boolean, ...columns: string[]): this
    ignoreIfHasNoValueWhen(when: boolean, ...columns: string[]): this
    ignoreAnySetWithNoValueWhen(when: boolean): this
    setForAllWhen(when: boolean, columns: InsertSets): this
    setForAllIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfSetWhen(when: boolean, columns: InsertSets): this
    setForAllIfSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfNotSetWhen(when: boolean, columns: InsertSets): this
    setForAllIfNotSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfHasValueWhen(when: boolean, columns: InsertSets): this
    setForAllIfHasValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfHasNoValueWhen(when: boolean, columns: InsertSets): this
    setForAllIfHasNoValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    disallowIfSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfSetWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfNotSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfNotSetWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfValueWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfValueWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfNoValueWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfNoValueWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowAnyOtherSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSetWhen(when: boolean, error: Error, ...columns: string[]): this

    /** Sets the values dynamically */
    dynamicSet(): this
    dynamicSet(columns: OptionalInsertSets): this

    /** Alias to dynamicSet method: sets the values dynamically */
    dynamicValues(columns: OptionalInsertSets): this
    /** Inserts multiple rows in the database dynamically */
    dynamicValues(columns: OptionalInsertSets[]): this

    /** Inserts the default values in the table. Only available when the table has no required column without a default */
    defaultValues(): this

    /** Insert from a select */
    from(select: Subquery): this

    /** 
     * Indicates that the query must return the last inserted id. Only available when the table has an autogenerated primary key.
     * Note: inserting multiple rows, or with an on conflict clause, it is not available on MySQL.
     * Inserting from a select, it is not available on MySQL and Oracle.
     */
    returningLastInsertedId(): this

    // Methods to specify the on conflict clause, only available on MariaDB, MySQL, PostgreSQL and SQLite
    /** Specifies the "on conflict do nothing" clause */
    onConflictDoNothing(): this
    // Without indicating the conflict, only available on MariaDB, MySQL and SQLite
    /** Specifies the "on conflict do update" clause and next specify the sets */
    onConflictDoUpdateDynamicSet(): this
    onConflictDoUpdateDynamicSet(columns: UpdateSets): this
    /** Specifies the "on conflict do update set" clause, setting the columns provided as argument */
    onConflictDoUpdateSet(columns: UpdateSets): this
    /** 
     * Specifies the "on conflict do update set" clause, setting the columns provided as argument.
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    onConflictDoUpdateSetIfValue(columns: OptionalUpdateSets): this
    /** Specifies the "on conflict" clause indicating the index columns expected by this clause. Only available on PostgreSQL and SQLite */
    onConflictOn(column: AnyValueSource, ...columns: AnyValueSource[]): this
    /** Specifies the "on conflict on constraint" clause indicating the constraint expected by this clause. Only available on PostgreSQL */
    onConflictOnConstraint(constraint: RawFragment): this

    // Methods available when previously is called onConflictOn or onConflictOnConstraint
    /** Specifies the "do nothing" clause */
    doNothing(): this
    /** Specifies the "do update" clause and next specify the sets */
    doUpdateDynamicSet(): this
    doUpdateDynamicSet(columns: UpdateSets): this
    /** Specifies the "do update set" clause, setting the columns provided as argument */
    doUpdateSet(columns: UpdateSets): this
    /** 
     * Specifies the "do update set" clause, setting the columns provided as argument.
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    doUpdateSetIfValue(columns: OptionalUpdateSets): this

    // Methods to specify a where clause immediately after onConflictOn or any do update method
    // (after a do update method the condition can use the values to insert, see valuesForInsert).
    // Only available on PostgreSQL and SQLite
    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this
    /** Extends the where using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where using an or */
    or(condition: BooleanValueSource): this

    /**
     * Executes the insert. By default it returns the number of inserted rows
     * 
     * @param min Minimum number of rows that must be inserted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be inserted. If it is exceeded, the promise is rejected
     */
    executeInsert(min?: number, max?: number): Promise<RESULT>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods, not available on MySQL. Inserting from a select, not available on Oracle either
    /** 
     * Specifies the returning clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    returning(columns: InsertReturningValues): this
    /** Returns the optional values as null instead of optional undefined values. It can only be used immediately after returning(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Executes the insert query that returns one or no result from the database */
    executeInsertNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the insert query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeInsertOne(): Promise<RESULT>
    /** 
     * Executes the insert query that returns zero or many results from the database 
     * 
     * @param min Minimum number of rows that must be inserted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be inserted. If it is exceeded, the promise is rejected
     */
    executeInsertMany(min?: number, max?: number): Promise<RESULT[]>

    customizeQuery(customization: {
        afterInsertKeyword?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}

/** Columns required by the insert */
type InsertSets = { [columnName: string]: any }
/** Columns required by the insert, but marked as optionals */
type OptionalInsertSets = { [columnName: string]: any }
/**
 * Returning projection of the value that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type InsertReturningValues = { [columnName: string]: AnyValueSource }
/** Shape of the values to set */
type InsertShape = { [propertyNameInValues: string]: string /* column name in the insert table */ }




interface UpdateExpression {
    /**
     * Used to define the shape of the values to update. This shape allows you to map
     * each property in the values to update with the columns in the table, in that
     * way, the property in the value doesn't need to have the same name.
     * The only values to be updated are the ones included in the shape.
     */
    shapedAs(shape: UpdateShape): this
    /** 
     * Extends the previously set shape.
     * The values set after extending the shape will allow you to include the new properties in the extended shape.
     */
    extendShape(shape: UpdateShape): this
    
    /** Sets the values for update. An undefined value writes a null */
    set(columns: UpdateSets): this
    /**
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setIfValue(columns: OptionalUpdateSets): this
    /** Sets a value only if the column was previously set */
    setIfSet(columns: UpdateSets): this
    /**
     * Sets a value only if the column was previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     */
    setIfSetIfValue(columns: OptionalUpdateSets): this
    /** Sets a value only if the column was not previously set */
    setIfNotSet(columns: UpdateSets): this
    /** 
     * Sets a value only if the column was not previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     */
    setIfNotSetIfValue(columns: OptionalUpdateSets): this
    /** Unsets the previously set columns listed. */
    ignoreIfSet(...columns: string[]): this
    /** Keeps only the previously set columns listed. */
    keepOnly(...columns: string[]): this

    /** 
     * Sets a value for the specified columns that were previously assigned a value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasValue(columns: UpdateSets): this
    /** 
     * Sets a value for the specified columns that were previously assigned a value
     *  only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasValueIfValue(columns: OptionalUpdateSets): this
    /** 
     * Sets a value for the specified columns that have no value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasNoValue(columns: UpdateSets): this
    /** 
     * Sets a value for the specified columns that have no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasNoValueIfValue(columns: OptionalUpdateSets): this
    /** 
     * Unsets the listed columns if they have a value set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unsets the listed columns if they have no value set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unsets all columns that were set with no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreAnySetWithNoValue(): this

    /**
     * Throws an error, when it is called, if the indicated properties are set
     */
    disallowIfSet(errorMessage: string, ...columns: string[]): this
    disallowIfSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties are not set
     */
    disallowIfNotSet(errorMessage: string, ...columns: string[]): this
    disallowIfNotSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties were set with a value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties were not set or have no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfNoValue(errorMessage: string, ...columns: string[]): this
    disallowIfNoValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if any column other than the listed ones is set.
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this

    //
    // When variants, that only apply if the first param is true
    //

    setWhen(when: boolean, columns: UpdateSets): this
    setIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    setIfSetWhen(when: boolean, columns: UpdateSets): this
    setIfSetIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    setIfNotSetWhen(when: boolean, columns: UpdateSets): this
    setIfNotSetIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    ignoreIfSetWhen(when: boolean, ...columns: string[]): this
    keepOnlyWhen(when: boolean, ...columns: string[]): this
    setIfHasValueWhen(when: boolean, columns: UpdateSets): this
    setIfHasValueIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    setIfHasNoValueWhen(when: boolean, columns: UpdateSets): this
    setIfHasNoValueIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    ignoreIfHasValueWhen(when: boolean, ...columns: string[]): this
    ignoreIfHasNoValueWhen(when: boolean, ...columns: string[]): this
    ignoreAnySetWithNoValueWhen(when: boolean): this
    disallowIfSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfSetWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfNotSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfNotSetWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfValueWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfValueWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfNoValueWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfNoValueWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowAnyOtherSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSetWhen(when: boolean, error: Error, ...columns: string[]): this

    /** Sets the values dynamically */
    dynamicSet(): this
    dynamicSet(columns: UpdateSets): this

    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this

    /** Extends the where or the on clause of a join using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where or the on clause of a join using an or */
    or(condition: BooleanValueSource): this

    /**
     * Executes the update returning the number of updated rows
     * 
     * @param min Minimum number of rows that must be updated. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be updated. If it is exceeded, the promise is rejected
     */
    executeUpdate(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods, not available on MySQL
    /** 
     * Specifies the returning clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    returning(columns: UpdateReturningValues): this
    /** 
     * Returns the optional values as null instead of optional undefined values.
     * It can only be used immediately after returning(...) 
     */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Executes the update query that returns one or no result from the database */
    executeUpdateNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the update query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeUpdateOne(): Promise<RESULT>
    /** 
     * Executes the update query that returns zero or many results from the database 
     * 
     * @param min Minimum number of rows that must be updated. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be updated. If it is exceeded, the promise is rejected
     */
    executeUpdateMany(min?: number, max?: number): Promise<RESULT[]>

    /** Adds a from to the update query */
    from(table: Table | View): this

    // Joins right after the update, only available on MariaDB and MySQL. On the other databases they go after a from
    /** Adds a join to the update query */
    join(table: Table | View): this
    /** Adds an inner join to the update query */
    innerJoin(table: Table | View): this
    /** 
     * Adds a left join to the update query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Adds a left outer join to the update query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Creates the on clause of a join dynamically */
    dynamicOn(): this
    /** Specifies the on clause of a join */
    on(condition: BooleanValueSource): this

    customizeQuery(customization: {
        afterUpdateKeyword?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}

/** Columns required by the update */
type UpdateSets = { [columnName: string]: any }
/** Columns required by the update, but marked as optional */
type OptionalUpdateSets = { [columnName: string]: any }
/**
 * Returning projection of the value that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type UpdateReturningValues = { [columnName: string]: AnyValueSource }
/** Shape of the values to set */
type UpdateShape = { [propertyNameInValues: string]: string /* column name in the update table */ | AnyValueSource }



interface DeleteExpression {
    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this

    /** Extends the where or the on clause of a join using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where or the on clause of a join using an or */
    or(condition: BooleanValueSource): this

    /**
     * Executes the delete returning the number of deleted rows
     * 
     * @param min Minimum number of rows that must be deleted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be deleted. If it is exceeded, the promise is rejected
     */
    executeDelete(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods, not available on MySQL
    /** 
     * Specifies the returning clause.
     * The object keys define the names of the resulting properties, and the values specify the ValueSource to retrieve from.
     */
    returning(columns: DeleteReturningValues): this
    /** Returns the optional values as null instead of optional undefined values. It can only be used immediately after returning(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Executes the delete query and returns one or no result */
    executeDeleteNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the delete query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeDeleteOne(): Promise<RESULT>
    /** 
     * Executes the delete query that returns zero or many results from the database 
     * 
     * @param min Minimum number of rows that must be deleted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be deleted. If it is exceeded, the promise is rejected
     */
    executeDeleteMany(min?: number, max?: number): Promise<RESULT[]>

    /** Adds a using (like a from that doesn't delete) to the delete query. Not available on SQLite */
    using(table: Table | View): this

    // Joins right after deleteFrom, only available on MariaDB and MySQL. On the other databases they go after a using
    /** Adds a join to the delete query */
    join(table: Table | View): this
    /** Adds an inner join to the delete query */
    innerJoin(table: Table | View): this
    /** 
     * Adds a left join to the delete query. 
     * Note: You must call forUseInLeftJoin on a table or view before using it in a left join
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Adds a left outer join to the delete query. 
     * Note: You must call forUseInLeftJoin on a table or view before using it in a left join
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Creates the on clause of a join dynamically */
    dynamicOn(): this
    /** Specifies the on clause of a join */
    on(condition: BooleanValueSource): this

    customizeQuery(customization: {
        afterDeleteKeyword?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}

/**
 * Returning projection of the values that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type DeleteReturningValues = { [columnName: string]: AnyValueSource }





interface SelectExpression {
    /** Adds a from to the select query */
    from(table: Table | View): this

    /** Adds a join to the select query */
    join(table: Table | View): this
    /** Adds an inner join to the select query */
    innerJoin(table: Table | View): this
    /** 
     * Adds a left join to the select query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Adds a left outer join to the select query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftOuterJoin(source: OuterJoinSource): this

    // Optional variants of the joins: the join is left out of the query when no column of it is used
    optionalJoin(table: Table | View): this
    optionalInnerJoin(table: Table | View): this
    optionalLeftJoin(source: OuterJoinSource): this
    optionalLeftOuterJoin(source: OuterJoinSource): this

    /** Creates the on clause of a join dynamically */
    dynamicOn(): this
    /** Specifies the on clause of a join */
    on(condition: BooleanValueSource): this

    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this
    
    /** Specifies the group by of the select query */
    groupBy(...columns: AnyValueSource[]): this
    /** 
     * Specifies the group by of the select query.
     * 
     * If you already defined the select clause, you can use the name of
     * the properties returned by the select instead of its definition: the
     * group by refers to that column of the select.
     * 
     * Note: this overload is only available if you define the select clause first.
     */
    groupBy(...columns: string[]): this
    /**
     * Groups by every column of the select that is not an aggregate and refers
     * to a table or view (constants are left out), each one referred to as a
     * column of the select, like groupBy('<column name>').
     * 
     * Note: only available if you define the select clause first.
     */
    groupByNonAggregatedColumns(): this
    /** Creates the having clause of the group by dynamically */
    dynamicHaving(): this
    /** Specifies the having clause of the group by */
    having(condition: BooleanValueSource): this
    /**
     * Creates the having clause using the columns of the select: the
     * function receives them (with the same shape as the select) and each one is
     * written as the same expression the select list computes, with the same
     * parameters (by its alias on MySQL and MariaDB).
     * 
     * Note: this overload is only available if you define the select clause first.
     */
    having(condition: (columns: SelectValues) => BooleanValueSource): this

    /** 
     * Specifies the select clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    select(columns: SelectValues): this
    /** Returns the optional values as null instead of optional undefined values. It can only be used immediately after select(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the select clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    selectOneColumn(column: AnyValueSource): this
    /** 
     * Specifies the select clause of a query that returns only one column with count(*).
     */
    selectCountAll(): this

    /** 
     * Specifies an order by. It receives the name of a column returned by the query
     * (if you select one column, its name is 'result'), a value source or a raw fragment.
     */
    orderBy(column: string, mode?: OrderByMode): this
    orderBy(column: AnyValueSource, mode?: OrderByMode): this
    orderBy(column: RawFragment, mode?: OrderByMode): this
    /** Specifies an order by dynamically, parsed from the provided string */
    orderByFromString(orderBy: string): this
    orderByFromStringIfValue(orderBy: string | null | undefined): this
    /** Specifies an order by dynamically, parsed from the provided array of clauses (each element is one order by clause) */
    orderByFromStringArray(orderBy: readonly string[]): this
    orderByFromStringArrayIfValue(orderBy: ReadonlyArray<string | null | undefined> | null | undefined): this

    /** Specifies the maximum number of rows returned by the query */
    limit(limit: number): this
    limitIfValue(limit: number | null | undefined): this
    /** Specifies the number of first rows ignored by the query */
    offset(offset: number): this
    offsetIfValue(offset: number | null | undefined): this

    // Oracle's connect by syntax, only available on Oracle
    startWith(condition: BooleanValueSource): this
    connectBy(condition: (prior: (column: AnyValueSource) => AnyValueSource) => BooleanValueSource): this
    connectByNoCycle(condition: (prior: (column: AnyValueSource) => AnyValueSource) => BooleanValueSource): this
    orderingSiblingsOnly(): this

    /** Extends the where, the on clause of a join, or the having clause using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where, the on clause of a join, or the having clause using an or */
    or(condition: BooleanValueSource): this

    // Query compound operators. intersectAll, exceptAll and minusAll are not available on SQLite and SQL Server
    union(select: CompoundableSubquery): this
    unionAll(select: CompoundableSubquery): this
    intersect(select: CompoundableSubquery): this
    intersectAll(select: CompoundableSubquery): this
    except(select: CompoundableSubquery): this
    exceptAll(select: CompoundableSubquery): this
    minus(select: CompoundableSubquery): this // alias to except
    minusAll(select: CompoundableSubquery): this // alias to exceptAll

    // Recursive queries
    recursiveUnion(fn: (view: View) => CompoundableSubquery): this
    recursiveUnionAll(fn: (view: View) => CompoundableSubquery): this
    recursiveUnionOn(fn: (view: View) => BooleanValueSource): this
    recursiveUnionAllOn(fn: (view: View) => BooleanValueSource): this

    /** Executes the select query that returns one or no result from the database */
    executeSelectNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the select query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeSelectOne(): Promise<RESULT>
    /** Executes the select query that returns zero or many results from the database */
    executeSelectMany(): Promise<RESULT[]>
    /** 
     * Executes the select query that returns zero or many results from the database.
     * It sends two queries: one to get the data from the database, 
     * and another one to get the count of all data without the limit and the offset. 
     */
    executeSelectPage(): Promise<{ data: RESULT[], count: number }>
    /** 
     * Executes the select query as a select page, including extra properties in the resulting object.
     * If the object provided by argument includes the property count, the query that counts the data is omitted and
     * this value is used. If the object provided by argument includes the property data, the query that extracts 
     * the data is omitted and this value is used.
     */
    executeSelectPage<EXTRAS extends {}>(extras: EXTRAS): Promise<{ data: RESULT[], count: number } & EXTRAS>
    
    /**
     * Uses a select query as a view in another select. 
     * This select is included as a with clause in the final sql.
     * 
     * @param as name of the with clause in the final query (must be unique per final query)
     */
    forUseInQueryAs(as: string): View

    /**
     * Uses a select query as an inline query value in another select. 
     */
    forUseAsInlineQueryValue(): AnyValueSource

    /**
     * Uses a select query as an inline object array value in another select. 
     */
    forUseAsInlineAggregatedArrayValue(): AggregatedArrayValueSource<this>
    
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    /** After a compound operator it only accepts beforeQuery, afterQuery, beforeWithQuery, afterWithQuery, queryExecutionName and queryExecutionMetadata */
    customizeQuery(customization: {
        afterSelectKeyword?: RawFragment
        beforeColumns?: RawFragment
        customWindow?: RawFragment
        beforeOrderByItems?: RawFragment
        afterOrderByItems?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        beforeWithQuery?: RawFragment
        afterWithQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}

/**
 * Modes of sorting in an order by.
 * If the database doesn't support one of them, it is emulated.
 */
type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
                   'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
                   'desc nulls first insensitive' | 'desc nulls last insensitive'
/**
 * Select projection of the value that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type SelectValues = { [columnName: string]: AnyValueSource }
/**
 * Here we use the Subquery type to indicate that you can use any select as subquery
 */
type Subquery = SelectExpression

/**
 * Here we use the CompoundableSubquery type to indicate that you can use a select with a compound operator (union, intersect)
 */
type CompoundableSubquery = SelectExpression







type TypeCategory = 'boolean'
    | 'int' | 'bigint' | 'customInt' | 'customBigint'
    | 'double' | 'customDouble' | 'customDecimal'
    | 'string'
    | 'uuid' | 'customUuid'
    | 'localDate' | 'customLocalDate'
    | 'localTime' | 'customLocalTime'
    | 'localDateTime' | 'customLocalDateTime'
    | 'enum' | 'custom' | 'customComparable'
    | ''

interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string
    forceTypeCast?(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean, next: DefaultTypeAdapter): boolean
    transformProjection?(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string
}

type ProjectionOutput = 'resultColumn' | 'aggregatedArrayValue'

interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string
}

declare class CustomBooleanTypeAdapter implements TypeAdapter {
    readonly trueValue: number | string
    readonly falseValue: number | string

    constructor(trueValue: number, falseValue: number)
    constructor(trueValue: string, falseValue: string)
    // CustomBooleanTypeAdapter's constructor implementation ...

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueToDB implementation ...
}

declare class ForceTypeCast implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueToDB implementation ...

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string
    // ForceTypeCast's transformPlaceholder implementation ...

    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean, next: DefaultTypeAdapter): boolean
    // ForceTypeCast's forceTypeCast implementation ...
}

// END

/******************** 
 * Noops to make the compiler happy
 */

type RESULT = any
type Default = any
type QueryRunner = any
type OuterJoinSource = any
type Argument<_T, _TYPE_NAME extends string> = any
type RawFragment = any
type CustomizedTableOrView = any
type AnyValueSource = ValueSource<any, any>
type TransactionIsolationLevel = any

void function (_c: Connection, _v: Values, _config: MariaDBConnectionConfiguration | MySqlConnectionConfiguration | OracleConnectionConfiguration | PostgreSqlConnectionConfiguration | SqliteConnectionConfiguration | SqlServerConnectionConfiguration) { return null}
interface ValueSource<T, TYPE_NAME extends string> {
    makeCompilerHappy_type: T
    makeCompilerHappy_typeName: TYPE_NAME
}