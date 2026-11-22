import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { EqualableType } from './equalable.js'
import { localDateSqlDataType } from './dateTimeSqlDataTypes.js'
import type { TemporalDifferenceOptions, TemporalDuration, TemporalOverflowOptions, TemporalPlainMonthDay, TemporalPlainMonthDayFields, TemporalPlainYearMonth, TemporalPlainYearMonthFields, TemporalYearMonthDurationLike, TemporalYearMonthUnit, IntOfQuery, TemporalYearMonthDurationLikeOfQuery, TemporalPlainMonthDayFieldsOfQuery, TemporalPlainYearMonthFieldsOfQuery } from './temporal.js'
import type { DataTypeOf, IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality, CombinedOptionalityOfUnion, OptionalType } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { __newSqlOperation2ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import { __newSqlOperationConstValueSource } from '../nodes/constants.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { isValueSource } from '../nodes/NodeStrategy.js'
import { __dateOfCalendarValue } from '../nodes/dateOfCalendarValue.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { plainTemporalFieldsOf } from '../utils/plainTemporalFields.js'
import type { operandTypeName } from '../utils/symbols.js'
import { DurationType, __durationArgument, yearMonthDurationFieldNames } from './durations.js'
import { PlainDateType, __withFieldsArgument } from './plainDates.js'
import { IntType } from './number.js'
import { StringType } from './strings.js'
import { BooleanConditionType, BooleanType } from './logical.js'

/*
 * A month of a year (plainYearMonth, a Temporal.PlainYearMonth) and a day of a month (plainMonthDay, a
 * Temporal.PlainMonthDay), as Temporal has them. No database has a type for them: each is kept in a date, the one of its
 * reference, as Temporal keeps it inside (the 1st of the month for a month of a year, the year 1972, a leap year, for a
 * day of a month), so the database compares, orders and computes with its own dates.
 */

/** The class of the result of an operation on the value that gives a value of its data type */
function sameClassOf(valueSource: unknown): any {
    return __computedClassOf(valueSource as object, __typeClassOf(valueSource as any))
}

/** Whether the options of Temporal ask to reject a field out of its range (overflow 'reject'); an error for another option */
function isRejecting(options: unknown): boolean {
    const overflow = options === undefined || options === null ? undefined : (options as { overflow?: unknown }).overflow
    if (overflow !== undefined && overflow !== 'constrain' && overflow !== 'reject') {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: overflow, typeName: 'overflow' }, 'Invalid overflow option, it must be constrain or reject: ' + String(overflow))
    }
    return overflow === 'reject'
}

/** An error for a value given to an operation that Temporal rejects */
function invalid(typeName: string, value: unknown, message: string): TsSqlProcessingError {
    return new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName }, message + ': ' + JSON.stringify(value))
}

/**
 * The month of the year plus or minus a duration of years and months (a Temporal.Duration or its fields): the date of
 * its reference day plus the months, which a month always has. Temporal rejects a duration with smaller units
 */
function yearMonthWithDuration(valueSource: unknown, operation: '_addDuration' | '_subtractDuration', duration: unknown, options: unknown): any {
    isRejecting(options)
    duration = __durationArgument(duration, yearMonthDurationFieldNames)
    const fields = duration as Record<string, unknown> | null
    if (isValueSource(duration)) {
        // A duration of the query: the query fails when it has smaller units, as Temporal throws
        return __operation1(valueSource as any, operation, duration, sameClassOf(valueSource))
    }
    if (fields === null || typeof fields !== 'object' || ['weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds'].some(name => fields[name] !== undefined && fields[name] !== 0)) {
        throw invalid('duration', duration, 'A month of a year adds a duration of years and months, given as a Temporal.Duration or its fields')
    }
    return __operation1(valueSource as any, operation, duration, sameClassOf(valueSource))
}

/** The duration from the value to the other one (until), or from the other one to the value (since), with the options of Temporal */
function difference(valueSource: unknown, operation: '_until' | '_since', other: unknown, options: unknown): any {
    const operand = isValueSource(other) ? other : __newSqlOperationConstValueSource(other, sameClassOf(valueSource), 'required')
    return __newSqlOperation2ValueSource(operation, valueSource as any, operand, options, DurationType, getOptionalType2(valueSource as any, operand))
}

/** A part of the date of the value: an int */
function partOf(valueSource: unknown, operation: keyof SqlFunction0): any {
    return __operation0(__dateOfCalendarValue(valueSource as any), operation, IntType)
}

/**
 * The family of a month of a year whose value is like a Temporal.PlainYearMonth, compared and ordered as Temporal
 * compares them. A data type of the user extends it with its type name, sent and read as one:
 * `class BillingMonthType extends PlainYearMonthsType<BillingMonth, 'BillingMonth'> { static override readonly type = 'BillingMonth' }`
 */
export abstract class PlainYearMonthsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateSqlDataType

    /** The year, as an int: Temporal's `year` */
    year(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    year(): any {
        return partOf(this, '_year')
    }
    /** The month, from 1 (January) to 12, as an int: Temporal's `month` */
    month(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    month(): any {
        return partOf(this, '_month')
    }
    /** The code of the month, `'M01'` to `'M12'`: Temporal's `monthCode` */
    monthCode(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    monthCode(): any {
        return __operation0(__dateOfCalendarValue(this), '_monthCode', StringType)
    }
    /** The days of the month, from 28 to 31, as an int: Temporal's `daysInMonth` */
    daysInMonth(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    daysInMonth(): any {
        return partOf(this, '_daysInMonthOf')
    }
    /** The days of the year, 365 or 366, as an int: Temporal's `daysInYear` */
    daysInYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    daysInYear(): any {
        return partOf(this, '_daysInYearOf')
    }
    /** The months of the year, 12, as an int: Temporal's `monthsInYear` */
    monthsInYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    monthsInYear(): any {
        return partOf(this, '_monthsInYearOf')
    }
    /** Whether the year is a leap year, with a February 29: Temporal's `inLeapYear` */
    inLeapYear(): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    inLeapYear(): any {
        return __operation0(__dateOfCalendarValue(this), '_inLeapYearOf', BooleanConditionType)
    }

    /** The month of the year plus the duration of years and months given, as Temporal's `add` (a Temporal.Duration or its fields) */
    add(duration: TemporalDuration | TemporalYearMonthDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The month of the year plus the duration of the query given, as Temporal's `add`: its years and months; the query
     * fails when it has weeks, days or a time, as Temporal throws
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /** The value plus the duration of the fields given, as Temporal's `add`, where a field is an integer or an int of the query, like a column (`{ months: tPlan.months }`): the database knows its value. The query fails, as Temporal throws, when the fields have different signs */
    add<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(duration: TemporalYearMonthDurationLikeOfQuery<IntOfQuery<SOURCE2, OPTIONAL_TYPE2>>, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SOURCE2, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    add(duration: unknown, options?: unknown): any {
        return yearMonthWithDuration(this, '_addDuration', duration, options)
    }
    /** The month of the year minus the duration of years and months given, as Temporal's `subtract` */
    subtract(duration: TemporalDuration | TemporalYearMonthDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The month of the year minus the duration of the query given, as Temporal's `subtract`: its years and months; the
     * query fails when it has weeks, days or a time, as Temporal throws
     */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /** The value minus the duration of the fields given, as Temporal's `subtract`, where a field is an integer or an int of the query, like a column (`{ months: tPlan.months }`). The query fails, as Temporal throws, when the fields have different signs */
    subtract<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(duration: TemporalYearMonthDurationLikeOfQuery<IntOfQuery<SOURCE2, OPTIONAL_TYPE2>>, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SOURCE2, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    subtract(duration: unknown, options?: unknown): any {
        return yearMonthWithDuration(this, '_subtractDuration', duration, options)
    }
    /**
     * The month of the year with the year or the month given in place of its own, as Temporal's `with`: a month out of
     * its range is taken to the nearest one (13 is December), or rejected with `{ overflow: 'reject' }`
     */
    with(fields: TemporalPlainYearMonthFields, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The month of the year with the year or the month given in place of its own, as Temporal's `with`, where a field is an
     * integer or an int of the query, like a column: the database takes the month to 12, or makes the query fail where
     * Temporal throws (a month below 1; with `{ overflow: 'reject' }`, above 12)
     */
    with<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(fields: TemporalPlainYearMonthFieldsOfQuery<IntOfQuery<SOURCE2, OPTIONAL_TYPE2>>, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SOURCE2, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    with(fields: unknown, options?: unknown): any {
        const reject = isRejecting(options)
        const given = plainTemporalFieldsOf(fields, 'date', reject)
        if (!given || given.day !== undefined || (given.year === undefined && given.month === undefined)) {
            throw invalid(__typeClassOf(this as any).type, fields, 'Invalid fields of a month of a year')
        }
        return __operation1(this as any, reject ? '_yearMonthWithRejecting' : '_yearMonthWith', __withFieldsArgument(fields, sameClassOf(this)), sameClassOf(this))
    }
    /**
     * The duration from this month of the year to the other one, as Temporal's `until`: in years and months by default;
     * `largestUnit: 'month'` gives only months, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     */
    until(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalYearMonthUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /** The duration from this month of the year to the other one, as Temporal's `until` */
    until<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalYearMonthUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    until(other: unknown, options?: unknown): any {
        return difference(this, '_until', other, options)
    }
    /** The duration from the other month of the year to this one, as Temporal's `since`: `until` with the mode inverted, negated */
    since(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalYearMonthUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /** The duration from the other month of the year to this one, as Temporal's `since` */
    since<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalYearMonthUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    since(other: unknown, options?: unknown): any {
        return difference(this, '_since', other, options)
    }
    /** The date of the day given in this month, a plainDate: Temporal's `toPlainDate({ day })`, the day taken to the last one of the month */
    toPlainDate(fields: { readonly day: number }): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    /**
     * The date of the day of the query given in this month, a plainDate: Temporal's `toPlainDate({ day })` with an int of
     * the query, like a column: the day taken to the last one of the month, and the query failing for a day below 1, as
     * Temporal throws
     */
    toPlainDate<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(fields: { readonly day: IntOfQuery<SOURCE2, OPTIONAL_TYPE2> }): ValueSource<SourceOf<this> | SOURCE2, PlainDateType, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    toPlainDate(fields: unknown): any {
        const day = (fields as { day?: unknown } | null)?.day
        if (isValueSource(day)) {
            return __operation1(this as any, '_withFields', __withFieldsArgument({ day }, PlainDateType), PlainDateType)
        }
        if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) {
            throw invalid('plainDate', fields, 'The day of toPlainDate must be a positive integer')
        }
        return __operation1(this as any, '_withFields', { day }, PlainDateType)
    }
}

/**
 * The family of a day of a month whose value is like a Temporal.PlainMonthDay, compared only for equality, as Temporal
 * has no order of them. A data type of the user extends it with its type name, sent and read as one:
 * `class AnniversaryType extends PlainMonthDaysType<Anniversary, 'Anniversary'> { static override readonly type = 'Anniversary' }`
 */
export abstract class PlainMonthDaysType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateSqlDataType

    /** The code of the month, `'M01'` to `'M12'`: Temporal's `monthCode` (a Temporal.PlainMonthDay has no `month`) */
    monthCode(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    monthCode(): any {
        return __operation0(__dateOfCalendarValue(this), '_monthCode', StringType)
    }
    /** The day of the month, from 1 to 31, as an int: Temporal's `day` */
    day(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    day(): any {
        return partOf(this, '_day')
    }
    /**
     * The day of the month with the fields given in place of its own, as Temporal's `with`: the month (or its code) and
     * the day, the day taken to the last one of the month (in the year given, or in a leap year), or rejected with
     * `{ overflow: 'reject' }`
     */
    with(fields: TemporalPlainMonthDayFields & { readonly year?: number | undefined }, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The day of the month with the fields given in place of its own, as Temporal's `with`, where a field is an integer or
     * an int of the query, like a column: the database takes it to its range, or makes the query fail where Temporal
     * throws (a month or a day below 1; with `{ overflow: 'reject' }`, out of its range)
     */
    with<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(fields: TemporalPlainMonthDayFieldsOfQuery<IntOfQuery<SOURCE2, OPTIONAL_TYPE2>> & { readonly year?: number | IntOfQuery<SOURCE2, OPTIONAL_TYPE2> | undefined }, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SOURCE2, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    with(fields: unknown, options?: unknown): any {
        const reject = isRejecting(options)
        const given = plainTemporalFieldsOf(fields, 'date', reject)
        if (!given) {
            throw invalid(__typeClassOf(this as any).type, fields, 'Invalid fields of a day of a month')
        }
        const argument = __withFieldsArgument(fields, sameClassOf(this))
        if (given.year === undefined) {
            // The date in the reference year, a leap year, with the fields
            return __operation1(this as any, reject ? '_monthDayWithRejecting' : '_monthDayWith', argument, sameClassOf(this))
        }
        // The date in the year given, with the fields, taken to the reference
        const date = __operation1(this as any, reject ? '_withFieldsRejecting' : '_withFields', argument, PlainDateType)
        return __operation0(date, '_toPlainMonthDay', sameClassOf(this))
    }
    /** The date of this day of the month in the year given, a plainDate: Temporal's `toPlainDate({ year })` (February 29 is the 28th in a year without it) */
    toPlainDate(fields: { readonly year: number }): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    /**
     * The date of this day of the month in the year of the query given, a plainDate: Temporal's `toPlainDate({ year })`
     * with an int of the query, like a column (February 29 is the 28th in a year without it)
     */
    toPlainDate<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(fields: { readonly year: IntOfQuery<SOURCE2, OPTIONAL_TYPE2> }): ValueSource<SourceOf<this> | SOURCE2, PlainDateType, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    toPlainDate(fields: unknown): any {
        const year = (fields as { year?: unknown } | null)?.year
        if (isValueSource(year)) {
            return __operation1(this as any, '_withFields', __withFieldsArgument({ year }, PlainDateType), PlainDateType)
        }
        if (typeof year !== 'number' || !Number.isInteger(year)) {
            throw invalid('plainDate', fields, 'The year of toPlainDate must be an integer')
        }
        return __operation1(this as any, '_withFields', { year }, PlainDateType)
    }
}

/** A month of a year, a Temporal.PlainYearMonth */
export abstract class PlainYearMonthType extends PlainYearMonthsType<TemporalPlainYearMonth, 'plainYearMonth'> {
    static override readonly type = 'plainYearMonth'
}

/** A day of a month, a Temporal.PlainMonthDay */
export abstract class PlainMonthDayType extends PlainMonthDaysType<TemporalPlainMonthDay, 'plainMonthDay'> {
    static override readonly type = 'plainMonthDay'
}
