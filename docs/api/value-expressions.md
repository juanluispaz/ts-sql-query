---
search:
  boost: 0.3
---
# Value expressions API

This page describes the API surface for all value expressions used in `ts-sql-query`. These expressions represent values from the database (such as strings, numbers, dates, booleans, etc.) and support fluent methods for comparisons, operations, transformations, and conditional expressions. The TypeScript methods map closely to SQL semantics while maintaining static typing and composability in code.

All values managed by the database are represented as a subclass of `ValueSource`, almost all methods listed here support the TypeScript value and the database value (as overload).

Methods ending in `IfValue` behave like their counterparts without `IfValue`, but only apply the logic if the provided value is not `undefined`, `null`, an empty string (unless `allowEmptyString` is enabled in the connection), or an empty array, otherwise it is ignored.”

Be aware, in the database, when null is part of an operation the result of the operation is null (It is not represented in the following definition but it is implemented)

All data manipulation operations are implemented as methods on the value itself, that means if you what to calculate the absolute, in sql is `abs(value)` but in `ts-sql-query` is represented as `value.abs()`.

```typescript
interface ValueSource<T, TYPE_NAME> {
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
```

```typescript
interface NullableValueSource<T, TYPE_NAME> extends ValueSource<T, TYPE_NAME> {
    isNull(): BooleanValueSource
    isNotNull(): BooleanValueSource
    valueWhenNull(value: T | this): this
    nullIfValue(value: T | this): this
    asOptional(): this
    asRequiredInOptionalObject(): this
    onlyWhenOrNull(when: boolean): this
    ignoreWhenAsNull(when: boolean): this
}
```

```typescript
interface EqualableValueSource<T, TYPE_NAME> extends NullableValueSource<T, TYPE_NAME> {
    equalsIfValue(value: T | null | undefined): BooleanValueSource
    equals(value: T | this): BooleanValueSource
    notEqualsIfValue(value: T | null | undefined): BooleanValueSource
    notEquals(value: T | this): BooleanValueSource
    isIfValue(value: T | null | undefined): BooleanValueSource
    /** 'is' is the same that equals, but returns true when both are null */
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
```

```typescript
interface ComparableValueSource<T, TYPE_NAME> extends EqualableValueSource<T, TYPE_NAME> {
    lessThanIfValue(value: T | null | undefined): BooleanValueSource
    lessThan(value: T | this): BooleanValueSource
    greaterThanIfValue(value: T | null | undefined): BooleanValueSource
    greaterThan(value: T | this): BooleanValueSource
    lessOrEqualIfValue(value: T | null | undefined): BooleanValueSource
    lessOrEqual(value: T | this): BooleanValueSource
    greaterOrEqualIfValue(value: T | null | undefined): BooleanValueSource
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
```

```typescript
/**
 * Represents an int or a double
 */
interface NumberValueSource extends ComparableValueSource<number, 'number'> {
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
    multiply(value: bigint | this): this
    modulo(value: bigint | this): this
}
```

```typescript
/**
 * Represents a string
 */
interface StringValueSource extends ComparableValueSource<string, 'string'> {
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
```

```typescript
/**
 * Represents an UUID
 */
 interface UuidValueSource extends ComparableValueSource<string, 'uuid'> {
    asString(): StringValueSource
 }
```

```typescript
/**
 * Represents a local date without time (using a Date object)
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
}
```

```typescript
/**
 * Represents a local time without date (using a Date object)
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
}
```

```typescript
/**
 * Represents a local date with time (using a Date object)
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
}
```

```typescript
/**
 * Represents a custom int
 */
interface CustomIntValueSource<T, TYPE_NAME> extends ComparableValueSource<T, TYPE_NAME> {
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
```

```typescript
/**
 * Represents a custom double
 */
interface CustomDoubleValueSource<T, TYPE_NAME> extends ComparableValueSource<T, TYPE_NAME> {
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
```

```typescript
/**
 * Represents a custom UUID
 */
interface CustomUuidValueSource<T, TYPE_NAME> extends ComparableValueSource<T, TYPE_NAME> {
    asString(): StringValueSource
 }
```

```typescript
/**
 * Represents a custom local date without time (using a Date object)
 */
interface CustomLocalDateValueSource<T, TYPE_NAME> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the year */
    getFullYear(): NumberValueSource
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource
}
```

```typescript
/**
 * Represents a custom local time without date (using a Date object)
 */
interface CustomLocalTimeValueSource<T, TYPE_NAME> extends ComparableValueSource<T, TYPE_NAME> {
    /** Gets the hours */
    getHours(): NumberValueSource
    /** Gets the minutes */
    getMinutes(): NumberValueSource
    /** Gets the seconds */
    getSeconds(): NumberValueSource
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource
}
```

```typescript
/**
 * Represents a custom local date with time (using a Date object)
 */
interface CustomLocalDateTimeValueSource<T, TYPE_NAME> extends ComparableValueSource<T, TYPE_NAME> {
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
```

```typescript
/**
 * Represents the result of an aggregate as object array
 */
interface AggregatedArrayValueSource<T> extends ValueSource<T, 'aggregated'> {
    useEmptyArrayForNoValue(): AggregatedArrayValueSource<T>
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
