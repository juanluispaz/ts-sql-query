// BEGIN

/*
 * Simplified versions of the query's API
 */

interface ValueSource<T, TYPE_NAME extends string = string> {
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

    inIfValue(values: readonly T[] | null | undefined): IfValueSource
    in(values: readonly T[] | this): BooleanValueSource
    /** The result is optional if the column of the subquery is optional */
    in(select: Subquery): BooleanValueSource
    notInIfValue(values: readonly T[] | null | undefined): IfValueSource
    notIn(values: readonly T[] | this): BooleanValueSource
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
 * Represents a number of a type of yours that extends `AdditiveType`, like an amount of money: it is added and
 * subtracted with values of its own type. The value sources of the families below have these methods too
 */
interface AdditiveValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    abs(): this
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
 * Represents a number of a type of yours that extends `MultipliableType`: it is also multiplied
 */
interface MultipliableValueSource<T, TYPE_NAME extends string> extends AdditiveValueSource<T, TYPE_NAME> {
    multiply(value: T | this): this
}

/**
 * Represents an integer of a type of yours that extends `IntegersType`, sent to and received from the database as an
 * int, or as a bigint when its SQL data type doesn't fit in a number
 */
interface IntegersValueSource<T, TYPE_NAME extends string> extends MultipliableValueSource<T, TYPE_NAME> {
}

/**
 * Represents an exact decimal number of a type of yours that extends `DecimalsType`, sent to and received from the
 * database as its text, so it keeps every digit. The functions whose result can't be exact return a double
 */
interface DecimalsValueSource<T, TYPE_NAME extends string> extends MultipliableValueSource<T, TYPE_NAME> {
    ceil(): this
    floor(): this
    round(): this
    /** The number of decimals is a number, or a value source of one */
    roundn(value: number | NumberValueSource): this
    exp(): NumberValueSource
    ln(): NumberValueSource
    log10(): NumberValueSource
    sqrt(): NumberValueSource
    cbrt(): NumberValueSource
    acos(): NumberValueSource
    asin(): NumberValueSource
    atan(): NumberValueSource
    cos(): NumberValueSource
    cot(): NumberValueSource
    sin(): NumberValueSource
    tan(): NumberValueSource
    power(value: number | NumberValueSource): NumberValueSource
    logn(value: number | NumberValueSource): NumberValueSource
    atan2(value: number | NumberValueSource): NumberValueSource
}

/**
 * Represents a number of a type of yours that extends `DivisibleType`: it is also divided
 */
interface DivisibleValueSource<T, TYPE_NAME extends string> extends MultipliableValueSource<T, TYPE_NAME> {
    divide(value: T | this): this
}

/**
 * Represents a floating point number of a type of yours that extends `RealsType`, sent to and received from the
 * database as a double
 */
interface RealsValueSource<T, TYPE_NAME extends string> extends DivisibleValueSource<T, TYPE_NAME> {
    ceil(): this
    floor(): this
    round(): this
    /** The number of decimals can be a value of its type or a number, or a value source of either */
    roundn(value: T | number | this | NumberValueSource): this
    exp(): this
    ln(): this
    log10(): this
    sqrt(): this
    cbrt(): this
    acos(): this
    asin(): this
    atan(): this
    cos(): this
    cot(): this
    sin(): this
    tan(): this
    power(value: T | this): this
    logn(value: T | this): this
    atan2(value: T | this): this
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
 * Represents a UUID of a type of yours that extends `UuidsType`
 */
interface UuidsValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    asString(): StringValueSource
}

/**
 * Represents a date without time and without zone (using a Temporal.PlainDate)
 */
interface PlainDateValueSource extends ComparableValueSource<Temporal.PlainDate, 'plainDate'> {
    /** Gets the year (as Temporal's year) */
    year(): NumberValueSource
    /** Gets the month, from 1 (January) to 12 (as Temporal's month) */
    month(): NumberValueSource
    /** Gets the day of the month (as Temporal's day) */
    day(): NumberValueSource
    /** Gets the day of the week, from 1 (Monday) to 7 (Sunday) (as Temporal's dayOfWeek) */
    dayOfWeek(): NumberValueSource
    /** Gets the day of the year, from 1 to 366 (as Temporal's dayOfYear) */
    dayOfYear(): NumberValueSource
    /** This date at 00:00, or at the time given (as Temporal's toPlainDateTime) */
    toPlainDateTime(time?: Temporal.PlainTime | PlainTimeValueSource): PlainDateTimeValueSource
}

/**
 * Represents a time of the day without date and without zone (using a Temporal.PlainTime)
 */
interface PlainTimeValueSource extends ComparableValueSource<Temporal.PlainTime, 'plainTime'> {
    /** Gets the hour (as Temporal's hour) */
    hour(): NumberValueSource
    /** Gets the minute (as Temporal's minute) */
    minute(): NumberValueSource
    /** Gets the second, without its fraction (as Temporal's second) */
    second(): NumberValueSource
    /** Gets the millisecond of the second (as Temporal's millisecond) */
    millisecond(): NumberValueSource
    /** Gets the microsecond of the millisecond (as Temporal's microsecond) */
    microsecond(): NumberValueSource
}

/**
 * Represents a date and a time without zone (using a Temporal.PlainDateTime)
 */
interface PlainDateTimeValueSource extends ComparableValueSource<Temporal.PlainDateTime, 'plainDateTime'> {
    /** Gets the year (as Temporal's year) */
    year(): NumberValueSource
    /** Gets the month, from 1 (January) to 12 (as Temporal's month) */
    month(): NumberValueSource
    /** Gets the day of the month (as Temporal's day) */
    day(): NumberValueSource
    /** Gets the day of the week, from 1 (Monday) to 7 (Sunday) (as Temporal's dayOfWeek) */
    dayOfWeek(): NumberValueSource
    /** Gets the day of the year, from 1 to 366 (as Temporal's dayOfYear) */
    dayOfYear(): NumberValueSource
    /** Gets the hour (as Temporal's hour) */
    hour(): NumberValueSource
    /** Gets the minute (as Temporal's minute) */
    minute(): NumberValueSource
    /** Gets the second, without its fraction (as Temporal's second) */
    second(): NumberValueSource
    /** Gets the millisecond of the second (as Temporal's millisecond) */
    millisecond(): NumberValueSource
    /** Gets the microsecond of the millisecond (as Temporal's microsecond) */
    microsecond(): NumberValueSource
    /** Gets the date (as Temporal's toPlainDate) */
    toPlainDate(): PlainDateValueSource
    /** Gets the time of the day (as Temporal's toPlainTime) */
    toPlainTime(): PlainTimeValueSource
}

/**
 * Represents a local date without time of a type of yours that extends `LocalDatesType`. The getters give its parts in
 * UTC, as the getUTC… methods of the Date read
 */
interface LocalDatesValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the year */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource
}

/**
 * Represents a local time without date of a type of yours that extends `LocalTimesType`. The getters give its parts in
 * UTC, as the getUTC… methods of the Date read
 */
interface LocalTimesValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the hours */
    getHours(): NumberValueSource
    /** Gets the minutes */
    getMinutes(): NumberValueSource
    /** Gets the seconds */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource
}

/**
 * Represents a local date with time of a type of yours that extends `LocalDateTimesType`. The getters give its parts
 * in UTC, as the getUTC… methods of the Date read
 */
interface LocalDateTimesValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the year */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource
    /** Gets the hours */
    getHours(): NumberValueSource
    /** Gets the minutes */
    getMinutes(): NumberValueSource
    /** Gets the seconds */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds */
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
    /** The SQL data type of a type of the database of the connection, as its catalogue writes it */
    sqlDataTypeFrom(nativeName: string): SqlDataType
    /** The type of the database of the connection for a SQL data type; undefined when it can't hold it */
    nativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined

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
    sum(value: NumberValueSource): NumberValueSource
    sum(value: BigintValueSource): BigintValueSource
    sum(value: StringDecimalValueSource): StringDecimalValueSource
    sum<T, TYPE_NAME extends string>(value: AdditiveValueSource<T, TYPE_NAME>): AdditiveValueSource<T, TYPE_NAME>
    sum(value: StringDecimalValueSource): StringDecimalValueSource
    /** sum(distinct value) */
    sumDistinct(value: NumberValueSource): NumberValueSource
    sumDistinct(value: BigintValueSource): BigintValueSource
    sumDistinct(value: StringDecimalValueSource): StringDecimalValueSource
    sumDistinct<T, TYPE_NAME extends string>(value: AdditiveValueSource<T, TYPE_NAME>): AdditiveValueSource<T, TYPE_NAME>
    sumDistinct(value: StringDecimalValueSource): StringDecimalValueSource
    /** avg(value). It always returns a number, a double, also for a bigint or a custom type */
    average(value: NumberValueSource | BigintValueSource | StringDecimalValueSource | AdditiveValueSource<any, any>): NumberValueSource
    /** avg(distinct value). It always returns a number, a double, also for a bigint or a custom type */
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

    /** Protected method that transforms the values received from the database, as the type requested for them */
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown
    /** Protected method that transforms the values sent to the database, as the type requested for them */
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown
    /** Protected method that customizes the value placeholder in the query */
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext): string
    /** Protected method that writes the SQL of a value as it leaves the database, in a column of the result */
    transformProjection(sql: string, context: TypeAdapterProjectionContext): string

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
    and?: ReadonlyArray<DynamicFilter | undefined>
    or?: ReadonlyArray<DynamicFilter | undefined>
    [fieldOrRuleName: string]: FieldFilter | DynamicFilter | any
}

/**
 * The filter of a field, FilterOf<DataType>: an optional property for each operation the class of its data type exposes
 * to a filter (exposeFilterOperations), with the value its method takes. The shapes below are those of the built-in data
 * types: equality for boolean and the enums, also comparison for the numbers and the dates, also the text operators for
 * string; the uuids accept the text operators too, with a string, and apply asString before them.
 */
type FieldFilter = BooleanFilter | NumberFilter | BigintFilter | StringFilter | StringDecimalFilter | DateFilter | TimeFilter | DateTimeFilter | EqualableFilter<any> | ComparableFilter<any> | UuidsFilter<any>

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
    inIfValue?: readonly TYPE[] | null | undefined
    in?: readonly TYPE[]
    notInIfValue?: readonly TYPE[] | null | undefined
    notIn?: readonly TYPE[]
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

interface UuidsFilter<TYPE> extends ComparableFilter<TYPE> {
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
interface StringDecimalFilter extends ComparableFilter<string> { }

// Protected configuration properties that each connection adds
interface MariaDBConnectionConfiguration {
    uuidStrategy: 'string' | 'string as sent' | 'uuid' // Default: 'uuid'
    usePlatformDependentRound: boolean // Default: false
    useSimultaneousAssignment: boolean // Default: false
}

interface MySqlConnectionConfiguration {
    uuidStrategy: 'string' | 'string as sent' | 'binary' // Default: 'binary'
    usePlatformDependentRound: boolean // Default: false
}

interface OracleConnectionConfiguration {
    uuidStrategy: 'string' | 'string as sent' | 'custom-functions' | 'built-in' // Default: 'built-in'
    ignoreNullInConcat: boolean // Default: false
    concatFunction?: string
    usePlatformDependentRound: boolean // Default: false
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
    uuidStrategy: 'string' | 'string as sent' | 'uuid-extension' // Default: 'uuid-extension'
    replaceAllInsensitiveFunction?: string
    /** Protected method with the format of a date, a time or a date time. By default, 'localdate milliseconds as text' */
    getDateTimeFormat(type: 'date' | 'time' | 'dateTime'): 'localdate seconds as text' | 'localdate milliseconds as text' | 'localdate seconds as text using T separator' | 'localdate milliseconds as text using T separator' | 'UTC seconds as text' | 'UTC milliseconds as text' | 'UTC seconds as text using T separator' | 'UTC milliseconds as text using T separator' | 'UTC seconds as text using Z timezone' | 'UTC milliseconds as text using Z timezone' | 'UTC seconds as text using T separator and Z timezone' | 'UTC milliseconds as text using T separator and Z timezone' | 'Julian day as real number' | 'Unix time seconds as integer' | 'Unix time milliseconds as integer'
    sqliteRunsInApplicationTimeZone: boolean // Default: false
    usePlatformDependentRound: boolean // Default: false
    treatUnexpectedIntegerDateTimeAsJulian: boolean // Default: false
    treatUnexpectedStringDateTimeAsUTC: boolean // Default: false
    unexpectedUnixDateTimeAreMilliseconds: boolean // Default: false
}

interface SqlServerConnectionConfiguration {
    excludeTrailingBlanksInLength: boolean // Default: false
    usePlatformDependentRound: boolean // Default: false
    useUpperCaseUuid: boolean // Default: false
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
    column<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column that admits null
    optionalColumn<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>
    
    // Protected methods that create a required column that doesn't admit null and has a default value on insert
    columnWithDefaultValue<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>
    
    // Protected methods that create an optional column that admits null and has a default value on insert
    optionalColumnWithDefaultValue<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>
    
    // Protected methods that create a primary key column autogenerated in the database
    // When you insert you don't need to specify this column
    autogeneratedPrimaryKey<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create a primary key column not automatically generated
    // When you insert you must specify this column
    primaryKey<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>
      
    // Protected methods that create a primary key column generated by a sequence
    // When you insert you don't need to specify this column, it will be added automatically by ts-sql-query
    // Only available on MariaDB, Oracle, PostgreSQL and SQL Server
    autogeneratedPrimaryKeyBySequence<T>(name: string, sequenceName: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create a computed column that doesn't admit null
    computedColumn<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional computed column that admits null
    optionalComputedColumn<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create a column from a sql fragment in the table
    virtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column from a sql fragment in the table
    optionalVirtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>
}





interface View {
    /** Defines an alias for the view to be used in select queries */
    as(as: string): this
    /** Enables the view to be used in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Enables the view to be used in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that create a required column that doesn't admit null
    column<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column that admits null
    optionalColumn<T>(name: string, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create a column from a sql fragment in the view
    virtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column from a sql fragment in the view
    optionalVirtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>
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
    column<T>(type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column that admits null
    optionalColumn<T>(type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create a column from a sql fragment in the view
    virtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>

    // Protected methods that create an optional column from a sql fragment in the view
    optionalVirtualColumnFromFragment<T>(type: DataTypeName | DataTypeClass, fn: (fragment: FragmentExpression) => ValueSource<T>, adapter?: TypeAdapter): ValueSource<T>
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
    values(columns: readonly InsertSets[]): this
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
    dynamicValues(columns: readonly OptionalInsertSets[]): this

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







/**
 * The data type of each type name (here, the value source it gives): the built-in ones, and the ones of the user
 * registered with registerDataType and declared here (`declare module 'ts-sql-query' { interface DataTypes { Cents: CentsType } }`)
 */
interface DataTypes {
    boolean: BooleanValueSource, int: NumberValueSource, bigint: BigintValueSource, double: NumberValueSource,
    stringDecimal: StringDecimalValueSource, string: StringValueSource, uuid: UuidValueSource,
    localDate: LocalDateValueSource, localTime: LocalTimeValueSource, localDateTime: LocalDateTimeValueSource,
    plainDate: PlainDateValueSource, plainTime: PlainTimeValueSource, plainDateTime: PlainDateTimeValueSource
}
type DataTypeName = keyof DataTypes
/** Registers a data type of the user by the type name of its class (its static type) */
declare function registerDataType(dataType: DataTypeClass): void
/** The class of a data type: a built-in one, like `StringType`, or one of the user that extends a family */
type DataTypeClass = { readonly type: string, readonly sqlDataType?: SqlDataType | undefined }

interface TypeAdapter {
    /** The type of the value in the database; set it with withSqlDataType */
    readonly sqlDataType?: SqlDataType | undefined
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string
    transformProjection?(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string
}

type ProjectionOutput = 'resultColumn' | 'aggregatedArrayValue'

type ProjectionComparison = 'value' | 'equality' | 'columnEquality' | 'none'

/** The original type of a value never changes; the requested one, by default the original, is the one the next adapter and the library decide by */
interface TypeAdapterContext {
    readonly connectionConfiguration: ConnectionConfiguration
    /** The class of the original type (IntType, the class of a type of the user) */
    readonly originalType: DataTypeClass
    /** The class of the requested type */
    readonly requestedType: DataTypeClass
    /** The original type of the value in the database: the one of the type adapter; it never changes */
    readonly originalSqlDataType: SqlDataType | undefined
    /** The type of the value in the database requested for it; by default the original one */
    readonly requestedSqlDataType: SqlDataType | undefined
}

interface TypeAdapterValueToDBContext extends TypeAdapterContext {
    setRequestedType(type: DataTypeName | DataTypeClass): void
    setRequestedType(type: DataTypeName | DataTypeClass, typeAdapter: TypeAdapter): void
    resetRequestedType(): void
    /** The SQL data type the query runner receives with the parameter */
    setRequestedSqlDataType(sqlDataType: SqlDataType | undefined): void
    resetRequestedSqlDataType(): void
    forceTypeCast: boolean
    setMetadata(key: symbol, value: unknown): void
    getMetadata(key: symbol): unknown
    setQueryMetadata(key: symbol, value: unknown): void
    getQueryMetadata(key: symbol): unknown
}

interface TypeAdapterPlaceholderContext extends TypeAdapterContext {
    readonly index: number | undefined
    readonly valueSentToDB: unknown
    readonly forceTypeCast: boolean
    setMetadata(key: symbol, value: unknown): void
    getMetadata(key: symbol): unknown
    setQueryMetadata(key: symbol, value: unknown): void
    getQueryMetadata(key: symbol): unknown
}

interface TypeAdapterProjectionContext extends TypeAdapterContext {
    setRequestedType(type: DataTypeName | DataTypeClass): void
    setRequestedType(type: DataTypeName | DataTypeClass, typeAdapter: TypeAdapter): void
    resetRequestedType(): void
    /** The SQL data type the query runner receives with the column of the result */
    setRequestedSqlDataType(sqlDataType: SqlDataType | undefined): void
    resetRequestedSqlDataType(): void
    readonly output: ProjectionOutput
    comparison: ProjectionComparison
    setQueryMetadata(key: symbol, value: unknown): void
    getQueryMetadata(key: symbol): unknown
}

interface TypeAdapterValueFromDBContext extends TypeAdapterContext {
    setRequestedType(type: DataTypeName | DataTypeClass): void
    setRequestedType(type: DataTypeName | DataTypeClass, typeAdapter: TypeAdapter): void
    resetRequestedType(): void
    setRequestedSqlDataType(sqlDataType: SqlDataType | undefined): void
    resetRequestedSqlDataType(): void
}

/** Sets the SQL data type on the adapter given (a new one per column), or creates one that only says it */
declare function withSqlDataType(sqlDataType: SqlDataType): TypeAdapter
declare function withSqlDataType<ADAPTER extends TypeAdapter>(sqlDataType: SqlDataType, adapter: ADAPTER): ADAPTER

interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext): string
    transformProjection(sql: string, context: TypeAdapterProjectionContext): string
}

declare class CustomBooleanTypeAdapter implements TypeAdapter {
    readonly trueValue: number | string
    readonly falseValue: number | string

    constructor(trueValue: number, falseValue: number)
    constructor(trueValue: string, falseValue: string)
    // CustomBooleanTypeAdapter's constructor implementation ...

    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    // CustomBooleanTypeAdapter's transformValueToDB implementation ...
}

declare class ForceTypeCast implements TypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueFromDB implementation ...

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    // ForceTypeCast's transformValueToDB implementation ...
}

// END

/******************** 
 * Noops to make the compiler happy
 */

type RESULT = any
type Default = any
type QueryRunner = any
type OuterJoinSource = any
type Argument<_T, _TYPE_NAME extends string = string> = any
type RawFragment = any
type CustomizedTableOrView = any
type AnyValueSource = ValueSource<any, any>
type TransactionIsolationLevel = any
type ConnectionConfiguration = any
/** The type of a value in the database: its family with what refines it (see SqlDataType in TypeAdapter.ts) */
type SqlDataType = any

void function (_c: Connection, _v: Values, _config: MariaDBConnectionConfiguration | MySqlConnectionConfiguration | OracleConnectionConfiguration | PostgreSqlConnectionConfiguration | SqliteConnectionConfiguration | SqlServerConnectionConfiguration) { return null}
interface ValueSource<T, TYPE_NAME extends string = string> {
    makeCompilerHappy_type: T
    makeCompilerHappy_typeName: TYPE_NAME
}
// The value sources of the data types, each one given by the methods that take a data type (see ValueSource<T>)
void function (_uuid: UuidValueSource, _integers: IntegersValueSource<any, any>, _decimals: DecimalsValueSource<any, any>, _reals: RealsValueSource<any, any>, _uuids: UuidsValueSource<any, any>, _localDates: LocalDatesValueSource<any, any>, _localTimes: LocalTimesValueSource<any, any>, _localDateTimes: LocalDateTimesValueSource<any, any>) { return null }
