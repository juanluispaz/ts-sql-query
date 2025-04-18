---
search:
  boost: 0.3
---
# Value expressions API

All values managed by the database are represented as a subclass of `ValueSource`, almost all methods listed here support the TypeScript value and the database value (as overload).

The methods which name ends with `IfValue` do the same that the one without `IfValue` but only if the provided value(s) are different to undefined, null, empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour) or an empty array, otherwise it is ignored.

Be aware, in the database, when null is part of an operation the result of the operation is null (It is not represented in the following definition but it is implemented)

All the data manipulation operations are implemented as a methods inside the value, that means if you what to calculate the abolute, in sql is `abs(value)` but in ts-sql-query is reprecented as `value.abs()`.

```ts
interface ValueSource<T> {
    isConstValue(): boolean
    /**
     * It returns the proper type of the value, instead of the any type included here to simplify
     * If the value source is not a const value it throws an error
     */
    getConstValue(): any
    /**
     * Throw an error if the value source is used in the generated sql query when the boolean value provided as argument is false
     */
    allowWhen(when: boolean, errorMessage: string): this
    allowWhen(when: boolean, error: Error): this
    /**
     * Throw an error if the value source is used in the generated sql query when the boolean value provided as argument is true
     */
    disallowWhen(when: boolean, errorMessage: string): this
    disallowWhen(when: boolean, error: Error): this
}

interface NullableValueSource<T> extends ValueSource<T> {
    isNull(): BooleanValueSource
    isNotNull(): BooleanValueSource
    valueWhenNull(value: T | this): this
    nullIfValue(value: T | this): this
    asOptional(): this
    asRequiredInOptionalObject(): this
    onlyWhenOrNull(when: boolean): this
    ignoreWhenAsNull(when: boolean): this
}

interface EqualableValueSource<T> extends NullableValueSource<T> {
    equalsIfValue(value: T | null | undefined): BooleanValueSource
    equals(value: T | this): BooleanValueSource
    notEqualsIfValue(value: T | null | undefined): BooleanValueSource
    notEquals(value: T | this): BooleanValueSource
    isIfValue(value: T | null | undefined): BooleanValueSource
    /** 'is' is the same that equals, but returns true when booth are null */
    is(value: T | this): BooleanValueSource
    isNotIfValue(value: T | null | undefined): BooleanValueSource
    isNot(value: T | this): BooleanValueSource

    inIfValue(values: T[] | null | undefined): BooleanValueSource
    in(values: T[] | this[]): BooleanValueSource
    in(select: Subquery): BooleanValueSource
    notInIfValue(values: T[] | null | undefined): BooleanValueSource
    notIn(values: T[] | this[]): BooleanValueSource
    notIn(select: Subquery): BooleanValueSource
    inN(...value: T[] | this[]): BooleanValueSource
    notInN(...value: T[] | this[]): BooleanValueSource
}

interface ComparableValueSource<T> extends EqualableValueSource<T> {
    lessThanIfValue(value: T | null | undefined): BooleanValueSource
    lessThan(value: T | this): BooleanValueSource
    greaterThanIfValue(value: T | null | undefined): BooleanValueSource
    greaterThan(value: T | this): BooleanValueSource
    lessOrEqualsIfValue(value: T | null | undefined): BooleanValueSource
    lessOrEquals(value: T | this): BooleanValueSource
    greaterOrEqualsIfValue(value: T | null | undefined): BooleanValueSource
    greaterOrEquals(value: T | this): BooleanValueSource
    between(value: T | this, value2: T | this): BooleanValueSource
    notBetween(value: T | this, value2: T | this): BooleanValueSource
}

/**
 * Represents a boolean
 */
interface BooleanValueSource extends EqualableValueSource<boolean> {
    negate(): this
    and(value: boolean): this
    or(value: boolean): this
    /** This function returns a boolean expression that only applies if the argument is true */
    onlyWhen(condition: boolean): this
    /** This function returns a boolean expression that only applies if the argument is false, it is ignored when true */
    ignoreWhen(condition: boolean): this
    /** This function allows to return a true value when null or undefined were provided to the *IfValue function */
    trueWhenNoValue(): this
    /** This function allows to return a false value when null or undefined were provided to the *IfValue function */
    falseWhenNoValue(): this
    /** This function allows to return a value when null or undefined were provided to the *IfValue function */
    valueWhenNoValue(value: boolean | this): this
}

/**
 * Represents an int or a double
 */
interface NumberValueSource extends ComparableValueSource<number> {
    asInt(): NumberValueSource
    asDouble(): NumberValueSource
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
     * This function establish a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: number | this): this
    /**
     * This function establish a maximun value for the current value, that means the smallest value must be returned
     */
    maxValue(value: number | this): this
    add(value: number | this): this
    substract(value: number | this): this
    multiply(value: number | this): this
    divide(value: number | this): this
    modulo(value: number | this): this
    atan2(value: number | this): this
}

/**
 * Represents a bigint
 */
interface BigintValueSource extends ComparableValueSource<bigint> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    sign(): NumberValueSource
    /**
     * This function establish a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: bigint | this): this
    /**
     * This function establish a maximun value for the current value, that means the smallest value must be returned
     */
    maxValue(value: bigint | this): this
    add(value: bigint | this): this
    substract(value: bigint | this): this
    multiply(value: bigint | this): this
    modulo(value: bigint | this): this
}

/**
 * Represents a string
 */
interface StringValueSource extends ComparableValueSource<string> {
    equalsInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    equalsInsensitive(value: string | this): BooleanValueSource
    notEqualsInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    notEqualsInsensitive(value: string | this): BooleanValueSource
    likeIfValue(value: string | null | undefined): BooleanValueSource
    like(value: string | this): BooleanValueSource
    notLikeIfValue(value: string | null | undefined): BooleanValueSource
    notLike(value: string | this): BooleanValueSource
    likeInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    likeInsensitive(value: string | this): BooleanValueSource
    notLikeInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    notLikeInsensitive(value: string | this): BooleanValueSource
    startsWithIfValue(value: string | null | undefined): BooleanValueSource
    startsWith(value: string | this): BooleanValueSource
    notStartsWithIfValue(value: string | null | undefined): BooleanValueSource
    notStartsWith(value: string | this): BooleanValueSource
    endsWithIfValue(value: string | null | undefined): BooleanValueSource
    endsWith(value: string | this): BooleanValueSource
    notEndsWithIfValue(value: string | null | undefined): BooleanValueSource
    notEndsWith(value: string | this): BooleanValueSource
    startsWithInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    startsWithInsensitive(value: string | this): BooleanValueSource
    notStartsWithInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    notStartsWithInsensitive(value: string | this): BooleanValueSource
    endsWithInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    endsWithInsensitive(value: string | this): BooleanValueSource
    notEndsWithInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    notEndsWithInsensitive(value: string | this): BooleanValueSource
    containsIfValue(value: string | null | undefined): BooleanValueSource
    contains(value: string | this): BooleanValueSource
    notContainsIfValue(value: string | null | undefined): BooleanValueSource
    notContains(value: string | this): BooleanValueSource
    containsInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    containsInsensitive(value: string | this): BooleanValueSource
    notContainsInsensitiveIfValue(value: string | null | undefined): BooleanValueSource
    notContainsInsensitive(value: string | this): BooleanValueSource
    toLowerCase(): StringValueSource
    toUpperCase(): StringValueSource
    length(): NumberValueSource
    trim(): StringValueSource
    trimLeft(): StringValueSource
    trimRight(): StringValueSource
    reverse(): StringValueSource
    concatIfValue(value: string | null | undefined): StringValueSource
    concat(value: string | this): StringValueSource
    substrToEnd(start: number | NumberValueSource): StringValueSource
    substringToEnd(start: number | NumberValueSource): StringValueSource
    substr(start: number | NumberValueSource, count: number | NumberValueSource): StringValueSource
    substring(start: number | NumberValueSource, end: number | NumberValueSource): StringValueSource
    replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): StringValueSource
    replaceAll(findString: string | this, replaceWith: string | this): StringValueSource
}

/**
 * Represents an UUID
 */
 interface UuidValueSource extends ComparableValueSource<string> {
    asString(): StringValueSource
 }

/**
 * Represents a local date without time (using a Date object)
 */
interface LocalDateValueSource extends ComparableValueSource<Date> {
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
 * Represents a local time without date (using a Date object)
 */
interface LocalTimeValueSource extends ComparableValueSource<Date> {
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
 * Represents a local date with time (using a Date object)
 */
interface LocalDateTimeValueSource extends ComparableValueSource<Date> {
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
 * Represents a custom int
 */
interface CustomIntValueSource<T> extends ComparableValueSource<T> {
    abs(): this
    ceil(): this
    floor(): this
    round(): this
    sign(): NumberValueSource
    /**
     * This function establish a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: T | this): this
    /**
     * This function establish a maximun value for the current value, that means the smallest value must be returned
     */
    maxValue(value: T | this): this
    add(value: T | this): this
    substract(value: T | this): this
    multiply(value: T | this): this
    modulo(value: T | this): this
}

/**
 * Represents a custom double
 */
interface CustomDoubleValueSource<T> extends ComparableValueSource<T> {
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
    roundn(value: T | this): this
    /**
     * This function establish a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: T | this): this
    /**
     * This function establish a maximun value for the current value, that means the smallest value must be returned
     */
    maxValue(value: T | this): this
    add(value: T | this): this
    substract(value: T | this): this
    multiply(value: T | this): this
    divide(value: T | this): this
    modulo(value: T | this): this
    atan2(value: T | this): this
}

/**
 * Represents a custom UUID
 */
interface CustomUuidValueSource<T> extends ComparableValueSource<T> {
    asString(): StringValueSource
 }

/**
 * Represents a custom local date without time (using a Date object)
 */
interface CustomLocalDateValueSource<T> extends ComparableValueSource<T> {
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
 * Represents a custom local time without date (using a Date object)
 */
interface CustomLocalTimeValueSource<T> extends ComparableValueSource<T> {
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
 * Represents a custom local date with time (using a Date object)
 */
interface CustomLocalDateTimeValueSource<T> extends ComparableValueSource<T> {
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
interface AggregatedArrayValueSource<T> extends ValueSource<T> {
    useEmptyArrayForNoValue(): AggregatedArrayValueSource<T>
    asOptionalNonEmptyArray(): AggregatedArrayValueSource<T>
    asRequiredInOptionalObject(): AggregatedArrayValueSource<T>
    onlyWhenOrNull(when: boolean): AggregatedArrayValueSource<T>
    ignoreWhenAsNull(when: boolean): AggregatedArrayValueSource<T>
}

interface AggregatedArrayValueSourceProjectableAsNullable<T> extends AggregatedArrayValueSource<T> {
    /** Returns the optional values as null instead of optional undefined values */
    projectingOptionalValuesAsNullable(): AggregatedArrayValueSource<T>
}
```
