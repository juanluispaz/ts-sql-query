---
search:
  boost: 0.3
---
# Value expressions API

This page describes the API surface for all value expressions used in `ts-sql-query`. These expressions represent values from the database (such as strings, numbers, dates, booleans, etc.) and support fluent methods for comparisons, operations, transformations, and conditional expressions. The TypeScript methods map closely to SQL semantics while maintaining static typing and composability in code.

To learn how values are used in a query, see [Basic query structure](../queries/basic-query-structure.md); for the types of the values, [Data types](../configuration/data-types.md); and for the conditions that depend on a value, [Dynamic queries](../queries/dynamic-queries.md).

All values managed by the database are represented as a subclass of `ValueSource`, almost all methods listed here support the TypeScript value and the database value (as overload).

A value of a [type of yours](../advanced/data-types/own-data-types.md#the-families) has the methods of the family its class extends (the families and what each one adds are in the [Data types API](data-types.md)): `EqualableValueSource` for `EqualableType` and `EnumType`, `ComparableValueSource` for `ComparableType`, and, below, `AdditiveValueSource` and the other numbers, `UuidsValueSource` and the dates. It works only with values of its own type.

Methods ending in `IfValue` behave like their counterparts without `IfValue`, but only apply the logic if the provided value is not `undefined`, `null`, an empty string (unless `allowEmptyString` is enabled in the connection), or an empty array. Otherwise, the condition is ignored. See [What counts as no value](../queries/dynamic-queries.md#what-counts-as-no-value).

In the database, when null is part of an operation, the result of the operation is null. The definitions below don't show the optionality of each result, but the types of the library do: the result is optional when any operand is optional, except where a comment says something else.

All data manipulation operations are methods on the value itself. For example, the absolute value in SQL is `abs(value)`, and in `ts-sql-query` it is `value.abs()`.

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
/**
 * Represents a bigint
 */
interface BigintValueSource extends ComparableValueSource<bigint, 'bigint'> {
    abs(): this
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
    multiply(value: bigint | this): this
    modulo(value: bigint | this): this
}
```

```typescript
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
```

```typescript
/**
 * Represents an UUID
 */
interface UuidValueSource extends ComparableValueSource<string, 'uuid'> {
    asString(): StringValueSource
    /** The text operators: they apply to the text of the uuid, as on asString() */
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    equalsInsensitive(value: string | StringValueSource): BooleanValueSource
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notEqualsInsensitive(value: string | StringValueSource): BooleanValueSource
    likeIfValue(value: string | null | undefined): IfValueSource
    like(value: string | StringValueSource): BooleanValueSource
    notLikeIfValue(value: string | null | undefined): IfValueSource
    notLike(value: string | StringValueSource): BooleanValueSource
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource
    likeInsensitive(value: string | StringValueSource): BooleanValueSource
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notLikeInsensitive(value: string | StringValueSource): BooleanValueSource
    startsWithIfValue(value: string | null | undefined): IfValueSource
    startsWith(value: string | StringValueSource): BooleanValueSource
    notStartsWithIfValue(value: string | null | undefined): IfValueSource
    notStartsWith(value: string | StringValueSource): BooleanValueSource
    endsWithIfValue(value: string | null | undefined): IfValueSource
    endsWith(value: string | StringValueSource): BooleanValueSource
    notEndsWithIfValue(value: string | null | undefined): IfValueSource
    notEndsWith(value: string | StringValueSource): BooleanValueSource
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    startsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notStartsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    endsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notEndsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    containsIfValue(value: string | null | undefined): IfValueSource
    contains(value: string | StringValueSource): BooleanValueSource
    notContainsIfValue(value: string | null | undefined): IfValueSource
    notContains(value: string | StringValueSource): BooleanValueSource
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    containsInsensitive(value: string | StringValueSource): BooleanValueSource
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notContainsInsensitive(value: string | StringValueSource): BooleanValueSource
}
```

```typescript
/** A unit of a time, in the singular or the plural */
type TimeUnit = 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond' | 'hours' | 'minutes' | 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds'
/** How a value is rounded, as Temporal names it */
type DateUnit = 'year' | 'month' | 'week' | 'day' | 'years' | 'months' | 'weeks' | 'days'
/** The options of until and since: the largest unit of the duration ('auto' by default), and its rounding */
interface DifferenceOptions<UNIT> { largestUnit?: UNIT | 'auto', smallestUnit?: UNIT, roundingIncrement?: number, roundingMode?: RoundingMode }
type RoundingMode = 'ceil' | 'floor' | 'expand' | 'trunc' | 'halfCeil' | 'halfFloor' | 'halfExpand' | 'halfTrunc' | 'halfEven'
```

```typescript
/**
 * Represents a date without time and without zone (using a Temporal.PlainDate); see Dates and times
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
    /** The date plus a duration, as Temporal's add: the months keeping the day in the month, then the days and the whole days of the time */
    add(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): PlainDateValueSource
    /** The date minus a duration, as Temporal's subtract */
    subtract(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): PlainDateValueSource
    /** With the fields given in place of its own, as Temporal's with: each taken to its range, the day to the last one of the month */
    with(fields: { year?: number, month?: number, monthCode?: string, day?: number }, options?: { overflow?: 'constrain' | 'reject' }): PlainDateValueSource
    /** The duration from this date to the other one, as Temporal's until: in days by default (hours for a time) */
    until(other: Temporal.PlainDate | PlainDateValueSource, options?: DifferenceOptions<DateUnit>): DurationValueSource
    /** The duration from the other date to this one, as Temporal's since: until with the rounding mode negated, negated */
    since(other: Temporal.PlainDate | PlainDateValueSource, options?: DifferenceOptions<DateUnit>): DurationValueSource
    /** The same day with a Date, a localDate */
    toLocalDate(): LocalDateValueSource
}
```

```typescript
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
    /** The time plus a duration, as Temporal's add: only its time, going round at midnight */
    add(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): PlainTimeValueSource
    /** The time minus a duration, as Temporal's subtract */
    subtract(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): PlainTimeValueSource
    /** With the fields given in place of its own, as Temporal's with: each taken to its range */
    with(fields: { hour?: number, minute?: number, second?: number, millisecond?: number, microsecond?: number, nanosecond?: number }, options?: { overflow?: 'constrain' | 'reject' }): PlainTimeValueSource
    /** Rounded, as Temporal's round: to a unit, or to multiples of roundingIncrement of smallestUnit in a roundingMode (halfExpand by default) */
    round(options: TimeUnit | { smallestUnit: TimeUnit, roundingIncrement?: number, roundingMode?: RoundingMode }): PlainTimeValueSource
    /** The duration from this time to the other one, as Temporal's until: in days by default (hours for a time) */
    until(other: Temporal.PlainTime | PlainTimeValueSource, options?: DifferenceOptions<TimeUnit>): DurationValueSource
    /** The duration from the other time to this one, as Temporal's since: until with the rounding mode negated, negated */
    since(other: Temporal.PlainTime | PlainTimeValueSource, options?: DifferenceOptions<TimeUnit>): DurationValueSource
    /** The same time of the day with a Date, a localTime */
    toLocalTime(): LocalTimeValueSource
}
```

```typescript
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
    /** The date and time plus a duration, as Temporal's add: the months keeping the day in the month, then the days and the time */
    add(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): PlainDateTimeValueSource
    /** The date and time minus a duration, as Temporal's subtract */
    subtract(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): PlainDateTimeValueSource
    /** With the fields given in place of its own, as Temporal's with: each taken to its range, the day to the last one of the month */
    with(fields: { year?: number, month?: number, monthCode?: string, day?: number, hour?: number, minute?: number, second?: number, millisecond?: number, microsecond?: number, nanosecond?: number }, options?: { overflow?: 'constrain' | 'reject' }): PlainDateTimeValueSource
    /** Rounded, as Temporal's round: to a unit, or to multiples of roundingIncrement of smallestUnit in a roundingMode (halfExpand by default) */
    round(options: TimeUnit | 'day' | 'days' | { smallestUnit: TimeUnit | 'day' | 'days', roundingIncrement?: number, roundingMode?: RoundingMode }): PlainDateTimeValueSource
    /** The instant of this date and time as a wall clock of the zone of the database, as Temporal's toZonedDateTime(zone).toInstant() */
    toInstant(): InstantValueSource
    /** The wall clock in the zone given, as Temporal's toZonedDateTime with its disambiguation; only Oracle has zones */
    toZonedDateTime(timeZone: string | StringValueSource, options?: { disambiguation?: 'compatible' | 'earlier' | 'later' | 'reject' }): ZonedDateTimeValueSource
    /** The duration from this date and time to the other one, as Temporal's until: in days by default (hours for a time) */
    until(other: Temporal.PlainDateTime | PlainDateTimeValueSource, options?: DifferenceOptions<DateUnit | TimeUnit>): DurationValueSource
    /** The duration from the other date and time to this one, as Temporal's since: until with the rounding mode negated, negated */
    since(other: Temporal.PlainDateTime | PlainDateTimeValueSource, options?: DifferenceOptions<DateUnit | TimeUnit>): DurationValueSource
    /** The same date and time with a Date, a localDateTime */
    toLocalDateTime(): LocalDateTimeValueSource
}
```

```typescript
/**
 * Represents a duration (using a Temporal.Duration), only compared for equality; see Dates and times
 */
interface DurationValueSource extends EqualableValueSource<Temporal.Duration, 'duration'> {
    /** A field of the duration as it is kept, with its sign, as Temporal's years ... nanoseconds (milliseconds, microseconds and nanoseconds from 0 to 999) */
    years(): NumberValueSource
    months(): NumberValueSource
    weeks(): NumberValueSource
    days(): NumberValueSource
    hours(): NumberValueSource
    minutes(): NumberValueSource
    seconds(): NumberValueSource
    milliseconds(): NumberValueSource
    microseconds(): NumberValueSource
    nanoseconds(): NumberValueSource
    /** -1, 0 or 1, as Temporal's sign */
    sign(): NumberValueSource
    /** The duration with the opposite sign, as Temporal's negated */
    negated(): DurationValueSource
    /** The duration without its sign, as Temporal's abs */
    abs(): DurationValueSource
    /**
     * The duration in a unit, as a double with its fraction, as Temporal's total: of days or time without a date of
     * reference (a day is 24 hours; a duration with years, months or weeks fails the query), any unit with one (a date,
     * or the date of a date and time), counted from it
     */
    total(unit: 'day' | 'days' | TimeUnit | { unit: 'day' | 'days' | TimeUnit }): NumberValueSource
    total(options: { unit: DateUnit | TimeUnit, relativeTo: Temporal.PlainDate | Temporal.PlainDateTime | PlainDateValueSource | PlainDateTimeValueSource }): NumberValueSource
    /**
     * The duration plus or minus another one, as Temporal's add and subtract: a day is 24 hours, the sum balanced up to
     * the largest field of the two; a duration with years, months or weeks fails the query
     */
    add(other: Temporal.Duration | Temporal.DurationLike | DurationValueSource): DurationValueSource
    subtract(other: Temporal.Duration | Temporal.DurationLike | DurationValueSource): DurationValueSource
}
```

```typescript
/**
 * Represents an exact moment (using a Temporal.Instant), kept in any column of a date and a time: one with zone holds
 * its instant, one without zone its wall clock in the zone of the database. Ordered by its moment; see Dates and times
 */
interface InstantValueSource extends ComparableValueSource<Temporal.Instant, 'instant'> {
    /** The milliseconds since 1970-01-01T00:00Z, rounded down, as Temporal's epochMilliseconds */
    epochMilliseconds(): NumberValueSource
    /** The nanoseconds since 1970-01-01T00:00Z, as Temporal's epochNanoseconds */
    epochNanoseconds(): BigintValueSource
    /** Its date and time, date or time of the day in the zone of the database, as Temporal's toZonedDateTimeISO(zone).toPlainDateTime() */
    toPlainDateTime(): PlainDateTimeValueSource
    toPlainDate(): PlainDateValueSource
    toPlainTime(): PlainTimeValueSource
    /** The instant plus or minus a duration of hours and smaller units only, as Temporal's add and subtract */
    add(duration: Temporal.Duration | { hours?: number, minutes?: number, seconds?: number, milliseconds?: number, microseconds?: number, nanoseconds?: number }): InstantValueSource
    subtract(duration: Temporal.Duration | { hours?: number, minutes?: number, seconds?: number, milliseconds?: number, microseconds?: number, nanoseconds?: number }): InstantValueSource
    /** The instant plus or minus a duration of the query: the query fails when it has days, weeks, months or years */
    add(duration: DurationValueSource): InstantValueSource
    subtract(duration: DurationValueSource): InstantValueSource
    /** The instant rounded, as Temporal's round: an increment of the unit that divides a day */
    round(options: TimeUnit | { smallestUnit: TimeUnit, roundingIncrement?: number, roundingMode?: RoundingMode }): InstantValueSource
    /** The duration to or from the other instant, as Temporal's until and since: in seconds by default, up to hours */
    until(other: Temporal.Instant | InstantValueSource, options?: DifferenceOptions<TimeUnit>): DurationValueSource
    since(other: Temporal.Instant | InstantValueSource, options?: DifferenceOptions<TimeUnit>): DurationValueSource
    /** The instant in the zone given (an IANA name or an offset), as Temporal's toZonedDateTimeISO; only Oracle has zones */
    toZonedDateTimeISO(timeZone: string | StringValueSource): ZonedDateTimeValueSource
    /** The same instant with a Date, a localDateTime */
    toLocalDateTime(): LocalDateTimeValueSource
}

/**
 * Represents an exact moment in a time zone (using a Temporal.ZonedDateTime). Only Oracle keeps a zone with each value
 * (TIMESTAMP WITH TIME ZONE); on the other databases a query with one fails when it is built. Ordered by its instant;
 * see Dates and times
 */
interface ZonedDateTimeValueSource extends ComparableValueSource<Temporal.ZonedDateTime, 'zonedDateTime'> {
    toInstant(): InstantValueSource
    /** Its date and time, date or time of the day in its zone */
    toPlainDateTime(): PlainDateTimeValueSource
    toPlainDate(): PlainDateValueSource
    toPlainTime(): PlainTimeValueSource
    /** The name of its zone, and its offset at its instant, as Temporal's timeZoneId, offset and offsetNanoseconds */
    timeZoneId(): StringValueSource
    offset(): StringValueSource
    offsetNanoseconds(): NumberValueSource
    epochMilliseconds(): NumberValueSource
    epochNanoseconds(): BigintValueSource
    /** Its parts in its zone, as Temporal's */
    year(): NumberValueSource
    month(): NumberValueSource
    day(): NumberValueSource
    dayOfWeek(): NumberValueSource
    dayOfYear(): NumberValueSource
    hour(): NumberValueSource
    minute(): NumberValueSource
    second(): NumberValueSource
    millisecond(): NumberValueSource
    microsecond(): NumberValueSource
    /** The same instant in another zone, as Temporal's withTimeZone */
    withTimeZone(timeZone: string | StringValueSource): ZonedDateTimeValueSource
    /**
     * Plus or minus a duration, as Temporal's add and subtract: its years to days on the wall clock in its zone (the day
     * kept in the month, or rejected), taken back to its zone ('compatible'), then its time on the instant
     */
    add(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): ZonedDateTimeValueSource
    subtract(duration: Temporal.Duration | Temporal.DurationLike | DurationValueSource, options?: { overflow?: 'constrain' | 'reject' }): ZonedDateTimeValueSource
    /** With other fields of its date and time in its zone, keeping its offset when the zone still has it, as Temporal's with */
    with(fields: { year?: number, month?: number, monthCode?: string, day?: number, hour?: number, minute?: number, second?: number, millisecond?: number, microsecond?: number, nanosecond?: number, offset?: string }, options?: { overflow?: 'constrain' | 'reject', disambiguation?: 'compatible' | 'earlier' | 'later' | 'reject', offset?: 'use' | 'prefer' | 'ignore' | 'reject' }): ZonedDateTimeValueSource
    /** At the time of the day given, or at the start of its day, as Temporal's withPlainTime */
    withPlainTime(time?: Temporal.PlainTime | PlainTimeValueSource): ZonedDateTimeValueSource
    /** The start of its day in its zone, and the hours of its day there, as Temporal's startOfDay and hoursInDay */
    startOfDay(): ZonedDateTimeValueSource
    hoursInDay(): NumberValueSource
    /** Rounded, as Temporal's round: to the start of its day or the next one, or its wall clock to a unit of the time */
    round(options: 'day' | 'days' | TimeUnit | { smallestUnit: 'day' | 'days' | TimeUnit, roundingIncrement?: number, roundingMode?: RoundingMode }): ZonedDateTimeValueSource
    /**
     * The duration to or from the other one, as Temporal's until and since: in hours by default (their instants); in days
     * or larger units the days of the calendar in their zone, with the function of the library tsq_zoned_until
     */
    until(other: Temporal.ZonedDateTime | ZonedDateTimeValueSource, options?: DifferenceOptions<DateUnit | TimeUnit>): DurationValueSource
    since(other: Temporal.ZonedDateTime | ZonedDateTimeValueSource, options?: DifferenceOptions<DateUnit | TimeUnit>): DurationValueSource
    /** Its instant with a Date, a localDateTime */
    toLocalDateTime(): LocalDateTimeValueSource
}
```

```typescript
/**
 * Represents a local date without time (using a Date object). The getters give its parts in UTC, as the
 * getUTC… methods of the Date read
 */
interface LocalDateValueSource extends ComparableValueSource<Date, 'localDate'> {
    /** Gets the year */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource
    /** The same day as a Temporal value, a plainDate */
    toPlainDate(): PlainDateValueSource
}
```

```typescript
/**
 * Represents a local time without date (using a Date object). The getters give its parts in UTC, as the
 * getUTC… methods of the Date read
 */
interface LocalTimeValueSource extends ComparableValueSource<Date, 'localTime'> {
    /** Gets the hours */
    getHours(): NumberValueSource
    /** Gets the minutes */
    getMinutes(): NumberValueSource
    /** Gets the seconds */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource
    /** The same time of the day as a Temporal value, a plainTime */
    toPlainTime(): PlainTimeValueSource
}
```

```typescript
/**
 * Represents a local date with time (using a Date object). The getters give its parts in UTC, as the
 * getUTC… methods of the Date read
 */
interface LocalDateTimeValueSource extends ComparableValueSource<Date, 'localDateTime'> {
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
    /** Its instant as a Temporal value (as toTemporalInstant of the Date) */
    toInstant(): InstantValueSource
    /** The date and time, date or time of the day of its instant in the zone of the database, as toInstant().toPlainDateTime() */
    toPlainDateTime(): PlainDateTimeValueSource
    toPlainDate(): PlainDateValueSource
    toPlainTime(): PlainTimeValueSource
}
```

```typescript
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
```

```typescript
/**
 * Represents a number of a type of yours that extends `MultipliableType`: it is also multiplied
 */
interface MultipliableValueSource<T, TYPE_NAME extends string> extends AdditiveValueSource<T, TYPE_NAME> {
    multiply(value: T | this): this
}
```

```typescript
/**
 * Represents an integer of a type of yours that extends `IntegersType`, sent to and received from the database as an
 * int, or as a bigint when its SQL data type doesn't fit in a number
 */
interface IntegersValueSource<T, TYPE_NAME extends string> extends MultipliableValueSource<T, TYPE_NAME> {
}
```

```typescript
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
```

```typescript
/**
 * Represents an exact decimal number kept as a `ScaledBigInt`, a bigint with its scale in its type, of a type that
 * extends `ScaledBigIntsType` (`scaledBigIntType(2)`, or a type of yours of the family `scaledBigIntsType(2)`), sent to
 * and received from the database as its text, so it keeps every digit. It has no multiply nor divide: the result
 * would have another scale. The functions whose result can't be exact return a double
 */
interface ScaledBigIntsValueSource<T, TYPE_NAME extends string> extends AdditiveValueSource<T, TYPE_NAME> {
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
```

```typescript
/**
 * Represents a number of a type of yours that extends `DivisibleType`: it is also divided
 */
interface DivisibleValueSource<T, TYPE_NAME extends string> extends MultipliableValueSource<T, TYPE_NAME> {
    divide(value: T | this): this
}
```

```typescript
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
```

```typescript
/**
 * Represents a decimal number whose value is its text, a string, sent to and received from the database as text, so
 * it keeps every digit. The functions whose result can't be exact return a double.
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
```

```typescript
/**
 * Represents a decimal number whose value is a dnum (https://github.com/bpierre/dnum), the integer of its digits and
 * the number of its decimals (`type Dnum = readonly [value: bigint, decimals: number]`), sent to and received from the
 * database as its text, so it keeps every digit. The functions whose result can't be exact return a double.
 */
interface DnumDecimalValueSource extends ComparableValueSource<Dnum, 'dnumDecimal'> {
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
    minValue(value: Dnum | this): this
    /**
     * This function establishes a maximum value for the current value, that means the smallest value must be returned
     */
    maxValue(value: Dnum | this): this
    add(value: Dnum | this): this
    subtract(value: Dnum | this): this
    multiply(value: Dnum | this): this
    modulo(value: Dnum | this): this
    atan2(value: number | NumberValueSource): NumberValueSource
}
```

```typescript
/**
 * Represents a UUID of a type of yours that extends `UuidsType`
 */
interface UuidsValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    asString(): StringValueSource
    /** The text operators: they apply to the text of the uuid, as on asString() */
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    equalsInsensitive(value: string | StringValueSource): BooleanValueSource
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notEqualsInsensitive(value: string | StringValueSource): BooleanValueSource
    likeIfValue(value: string | null | undefined): IfValueSource
    like(value: string | StringValueSource): BooleanValueSource
    notLikeIfValue(value: string | null | undefined): IfValueSource
    notLike(value: string | StringValueSource): BooleanValueSource
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource
    likeInsensitive(value: string | StringValueSource): BooleanValueSource
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notLikeInsensitive(value: string | StringValueSource): BooleanValueSource
    startsWithIfValue(value: string | null | undefined): IfValueSource
    startsWith(value: string | StringValueSource): BooleanValueSource
    notStartsWithIfValue(value: string | null | undefined): IfValueSource
    notStartsWith(value: string | StringValueSource): BooleanValueSource
    endsWithIfValue(value: string | null | undefined): IfValueSource
    endsWith(value: string | StringValueSource): BooleanValueSource
    notEndsWithIfValue(value: string | null | undefined): IfValueSource
    notEndsWith(value: string | StringValueSource): BooleanValueSource
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    startsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notStartsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    endsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notEndsWithInsensitive(value: string | StringValueSource): BooleanValueSource
    containsIfValue(value: string | null | undefined): IfValueSource
    contains(value: string | StringValueSource): BooleanValueSource
    notContainsIfValue(value: string | null | undefined): IfValueSource
    notContains(value: string | StringValueSource): BooleanValueSource
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    containsInsensitive(value: string | StringValueSource): BooleanValueSource
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource
    notContainsInsensitive(value: string | StringValueSource): BooleanValueSource
}
```

```typescript
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
    /** The same day as a Temporal value, a plainDate */
    toPlainDate(): PlainDateValueSource
}
```

```typescript
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
    /** The same time of the day as a Temporal value, a plainTime */
    toPlainTime(): PlainTimeValueSource
}
```

```typescript
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
    /** Its instant as a Temporal value (as toTemporalInstant of the Date) */
    toInstant(): InstantValueSource
    /** The date and time, date or time of the day of its instant in the zone of the database, as toInstant().toPlainDateTime() */
    toPlainDateTime(): PlainDateTimeValueSource
    toPlainDate(): PlainDateValueSource
    toPlainTime(): PlainTimeValueSource
}
```

```typescript
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
```

```typescript
interface AggregatedArrayValueSourceProjectableAsNullable<T> extends AggregatedArrayValueSource<T> {
    /** Returns the optional values as null instead of optional undefined values */
    projectingOptionalValuesAsNullable(): AggregatedArrayValueSource<T>
}
```
