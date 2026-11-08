---
search:
  boost: 0.3
---
# Value expressions API

This page describes the API surface for all value expressions used in `ts-sql-query`. These expressions represent values from the database (such as strings, numbers, dates, booleans, etc.) and support fluent methods for comparisons, operations, transformations, and conditional expressions. The TypeScript methods map closely to SQL semantics while maintaining static typing and composability in code.

All values managed by the database are represented as a subclass of `ValueSource`, almost all methods listed here support the TypeScript value and the database value (as overload).

Methods ending in `IfValue` behave like their counterparts without `IfValue`, but only apply the logic if the provided value is not `undefined`, `null`, an empty string (unless `allowEmptyString` is enabled in the connection), or an empty array. Otherwise, the condition is ignored. See [What counts as no value](../queries/dynamic-queries.md#what-counts-as-no-value).

In the database, when null is part of an operation, the result of the operation is null. The definitions below don't show the optionality of each result, but the types of the library do: the result is optional when any operand is optional, except where a comment says something else.

All data manipulation operations are methods on the value itself. For example, the absolute value in SQL is `abs(value)`, and in `ts-sql-query` it is `value.abs()`.

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
/**
 * Represents a custom UUID
 */
interface CustomUuidValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
    asString(): StringValueSource
}
```

```typescript
/**
 * Represents a custom local date without time (using a Date object)
 */
interface CustomLocalDateValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
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
interface CustomLocalTimeValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
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
interface CustomLocalDateTimeValueSource<T, TYPE_NAME extends string> extends ComparableValueSource<T, TYPE_NAME> {
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
