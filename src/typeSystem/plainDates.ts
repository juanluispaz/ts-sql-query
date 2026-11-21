import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { localDateSqlDataType, localDateTimeSqlDataType, localTimeSqlDataType } from './localDates.js'
import type { TemporalDateUnit, TemporalDifferenceOptions, TemporalDisambiguationOptions, TemporalDuration, TemporalDurationLike, TemporalPlainDate, TemporalPlainDateFields, TemporalPlainDateTime, TemporalPlainTime, TemporalPlainTimeFields, TemporalOverflowOptions, TemporalRoundingOptions, TemporalTimeUnit } from './temporal.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { DataTypeOf, IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { __newSqlOperation2ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import { __newSqlOperationConstValueSource } from '../nodes/constants.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { isValueSource } from '../nodes/NodeStrategy.js'
import { DurationType } from './durations.js'
import { InstantType } from './instants.js'
import { ZonedDateTimeType, __zonedOfWallClock, type OfDatabaseWithZoneRules } from './zonedDateTimes.js'
import type { operandTypeName } from '../utils/symbols.js'
import { IntType } from './number.js'
import { StringType } from './strings.js'
import { BooleanConditionType, BooleanType } from './logical.js'
import { PlainMonthDayType, PlainYearMonthType } from './plainYearMonths.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'

/** The value plus or minus a duration, of the same data type */
function withDuration(valueSource: unknown, operation: '_addDuration' | '_subtractDuration', duration: unknown, options: unknown): any {
    const rejecting = isRejecting(options)
    return __operation1(valueSource as any, rejecting ? (operation === '_addDuration' ? '_addDurationRejecting' : '_subtractDurationRejecting') : operation, duration, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/** Whether the options of Temporal ask to reject a day the month hasn't (overflow 'reject'); an error for another option */
function isRejecting(options: unknown): boolean {
    const overflow = options === undefined || options === null ? undefined : (options as { overflow?: unknown }).overflow
    if (overflow !== undefined && overflow !== 'constrain' && overflow !== 'reject') {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: overflow, typeName: 'overflow' }, 'Invalid overflow option, it must be constrain or reject: ' + String(overflow))
    }
    return overflow === 'reject'
}

/** The value with the fields given, of the same data type */
function withFields(valueSource: unknown, fields: unknown, options: unknown): any {
    return __operation1(valueSource as any, isRejecting(options) ? '_withFieldsRejecting' : '_withFields', fields, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/** The value rounded, of the same data type */
function rounded(valueSource: unknown, options: unknown): any {
    return __operation1(valueSource as any, '_roundTemporal', options, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/**
 * The duration from the value to the other one (until), or from the other one to the value (since), with the options
 * of Temporal. A value given is a const of the data type of the value
 */
function difference(valueSource: unknown, operation: '_until' | '_since', other: unknown, options: unknown): any {
    const operand = isValueSource(other) ? other : __newSqlOperationConstValueSource(other, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)), 'required')
    return __newSqlOperation2ValueSource(operation, valueSource as any, operand, options, DurationType, getOptionalType2(valueSource as any, operand))
}

/** A part of a date or a time (its month, its microseconds, ...): an int */
function partOf(valueSource: unknown, operation: keyof SqlFunction0): any {
    return __operation0(valueSource as any, operation, IntType)
}

/*
 * The dates and times without a zone as Temporal has them: a date (plainDate, a Temporal.PlainDate), a time of the day
 * (plainTime, a Temporal.PlainTime), and both (plainDateTime, a Temporal.PlainDateTime). They are the same in the
 * database as the localDate, localTime and localDateTime, whose values are a Date; a value without zone is what a
 * Temporal value is, so it reaches the database and comes back as its digits, with all the digits of the fraction of a
 * second the database keeps, and no zone takes part.
 */

/**
 * The family of a date without a zone whose value is like a Temporal.PlainDate. A data type of the user extends it with
 * its type name, sent and read as one:
 * `class DueDayType extends PlainDatesType<DueDay, 'DueDay'> { static override readonly type = 'DueDay' }`
 */
export abstract class PlainDatesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateSqlDataType

    /** The year, as an int: Temporal's `year` */
    year(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    year(): any {
        return partOf(this, '_year')
    }
    /** The month, as an int from 1 (January) to 12 (December): Temporal's `month` */
    month(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    month(): any {
        return partOf(this, '_month')
    }
    /** The day of the month, as an int from 1 to 31: Temporal's `day` */
    day(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    day(): any {
        return partOf(this, '_day')
    }
    /** The day of the week, as an int from 1 (Monday) to 7 (Sunday), on every database: Temporal's `dayOfWeek` */
    dayOfWeek(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfWeek(): any {
        return partOf(this, '_dayOfWeek')
    }
    /** The day of the year, as an int from 1 to 366: Temporal's `dayOfYear` */
    dayOfYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfYear(): any {
        return partOf(this, '_dayOfYear')
    }
    /** The code of the month, `'M01'` to `'M12'`: Temporal's `monthCode` */
    monthCode(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    monthCode(): any {
        return __operation0(this as any, '_monthCode', StringType)
    }
    /** The days of the month of the date, from 28 to 31, as an int: Temporal's `daysInMonth` */
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
        return __operation0(this as any, '_inLeapYearOf', BooleanConditionType)
    }

    /** This date at 00:00, a plainDateTime: Temporal's `toPlainDateTime()` */
    toPlainDateTime(): ValueSource<SourceOf<this>, PlainDateTimeType, OptionalityOf<this>>
    /** This date at the time of the day given, a plainDateTime: Temporal's `toPlainDateTime(time)` */
    toPlainDateTime(time: TemporalPlainTime): ValueSource<SourceOf<this>, PlainDateTimeType, OptionalityOf<this>>
    /** This date at the time of the day of the plainTime given, a plainDateTime: Temporal's `toPlainDateTime(time)` */
    toPlainDateTime<VALUE extends IValueWithType<'type:plainTime:'>>(time: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PlainDateTimeType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    toPlainDateTime(time?: unknown): any {
        if (time === undefined) {
            return __operation0(this as any, '_toPlainDateTime', PlainDateTimeType)
        }
        return __operation1(this as any, '_toPlainDateTimeAt', time, PlainDateTimeType)
    }
    /** The month of the year of this date, a plainYearMonth: Temporal's `toPlainYearMonth()` */
    toPlainYearMonth(): ValueSource<SourceOf<this>, PlainYearMonthType, OptionalityOf<this>>
    toPlainYearMonth(): any {
        return __operation0(this as any, '_toPlainYearMonth', PlainYearMonthType)
    }
    /** The day of the month of this date, a plainMonthDay: Temporal's `toPlainMonthDay()` */
    toPlainMonthDay(): ValueSource<SourceOf<this>, PlainMonthDayType, OptionalityOf<this>>
    toPlainMonthDay(): any {
        return __operation0(this as any, '_toPlainMonthDay', PlainMonthDayType)
    }

    /**
     * The date plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days, and the whole days of the time (`PT36H` is one day). The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add(duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The date plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days, and the whole days of the time (`PT36H` is one day). The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(duration: unknown, options?: unknown): any {
        return withDuration(this, '_addDuration', duration, options)
    }
    /** The date minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added. With `{ overflow: 'reject' }` a day the month hasn't is rejected, as an error of the query */
    subtract(duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The date minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added. With `{ overflow: 'reject' }` a day the month hasn't is rejected, as an error of the query */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(duration: unknown, options?: unknown): any {
        return withDuration(this, '_subtractDuration', duration, options)
    }
    /**
     * The date with the fields given in place of its own, as Temporal's `with`: a field out of its range is taken to the nearest value it can have, and the day to the last one of the month when the month has fewer (`with({ day: 31 })` in February is the 29th or 28th). The fields are integers
     */
    with(fields: TemporalPlainDateFields, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    with(fields: unknown, options?: unknown): any {
        return withFields(this, fields, options)
    }

    /**
     * The duration from this date to the other one, as Temporal's `until`: in days and smaller units by
     * default; `largestUnit` asks for larger ones, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     * (`{ largestUnit: 'month' }` from Jan 31 to Mar 30 is P1M30D)
     */
    until(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalDateUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /**
     * The duration from this date to the other one, as Temporal's `until`: in days and smaller units by
     * default; `largestUnit` asks for larger ones, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     * (`{ largestUnit: 'month' }` from Jan 31 to Mar 30 is P1M30D)
     */
    until<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalDateUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    until(other: unknown, options?: unknown): any {
        return difference(this, '_until', other, options)
    }
    /**
     * The duration from the other date to this one, as Temporal's `since`: `until` from this one to the other, with
     * the rounding mode inverted (floor for ceil), negated
     */
    since(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalDateUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /**
     * The duration from the other date to this one, as Temporal's `since`: `until` from this one to the other, with
     * the rounding mode inverted (floor for ceil), negated
     */
    since<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalDateUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    since(other: unknown, options?: unknown): any {
        return difference(this, '_since', other, options)
    }
}

/**
 * The family of a time of the day without a zone whose value is like a Temporal.PlainTime. A data type of the user
 * extends it with its type name, sent and read as one:
 * `class ShiftStartType extends PlainTimesType<ShiftStart, 'ShiftStart'> { static override readonly type = 'ShiftStart' }`
 */
export abstract class PlainTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localTimeSqlDataType

    /** The hour, as an int from 0 to 23: Temporal's `hour` */
    hour(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    hour(): any {
        return partOf(this, '_hour')
    }
    /** The minute, as an int from 0 to 59: Temporal's `minute` */
    minute(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    minute(): any {
        return partOf(this, '_minute')
    }
    /** The second, as an int from 0 to 59, without its fraction: Temporal's `second` */
    second(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    second(): any {
        return partOf(this, '_second')
    }
    /** The millisecond of the second, as an int from 0 to 999: Temporal's `millisecond` */
    millisecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    millisecond(): any {
        return partOf(this, '_millisecond')
    }
    /**
     * The microsecond of the millisecond, as an int from 0 to 999: Temporal's `microsecond`. 0 where the database keeps
     * no microseconds
     */
    microsecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    microsecond(): any {
        return partOf(this, '_microsecond')
    }

    /**
     * The time plus the duration given, with the semantics of Temporal's `add`: only its time, going round at midnight (23:30 plus an hour is 00:30). The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add(duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The time plus the duration given, with the semantics of Temporal's `add`: only its time, going round at midnight (23:30 plus an hour is 00:30). The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(duration: unknown, options?: unknown): any {
        return withDuration(this, '_addDuration', duration, options)
    }
    /** The time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added. With `{ overflow: 'reject' }` a day the month hasn't is rejected, as an error of the query */
    subtract(duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added. With `{ overflow: 'reject' }` a day the month hasn't is rejected, as an error of the query */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(duration: unknown, options?: unknown): any {
        return withDuration(this, '_subtractDuration', duration, options)
    }
    /**
     * The time with the fields given in place of its own, as Temporal's `with`: a field out of its range is taken to the nearest value it can have (`with({ hour: 25 })` is 23). The fields are integers
     */
    with(fields: TemporalPlainTimeFields, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    with(fields: unknown, options?: unknown): any {
        return withFields(this, fields, options)
    }
    /**
     * The time rounded, as Temporal's `round`: to the unit given (`'minute'`), or with options, to multiples of
     * `roundingIncrement` of `smallestUnit` (`{ smallestUnit: 'minute', roundingIncrement: 15 }`) in the
     * `roundingMode` given (`'halfExpand'` by default: half up). A time goes round at midnight (23:59:59.5 to the second is 00:00:00)
     */
    round(options: TemporalTimeUnit | TemporalRoundingOptions<TemporalTimeUnit>): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(options: unknown): any {
        return rounded(this, options)
    }

    /**
     * The duration from this time to the other one, as Temporal's `until`: in hours and smaller units by
     * default; `largestUnit` asks for larger ones, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     * (from 10:00 to 08:30 is -PT1H30M)
     */
    until(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /**
     * The duration from this time to the other one, as Temporal's `until`: in hours and smaller units by
     * default; `largestUnit` asks for larger ones, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     * (from 10:00 to 08:30 is -PT1H30M)
     */
    until<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    until(other: unknown, options?: unknown): any {
        return difference(this, '_until', other, options)
    }
    /**
     * The duration from the other time to this one, as Temporal's `since`: `until` from this one to the other, with
     * the rounding mode inverted (floor for ceil), negated
     */
    since(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /**
     * The duration from the other time to this one, as Temporal's `since`: `until` from this one to the other, with
     * the rounding mode inverted (floor for ceil), negated
     */
    since<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    since(other: unknown, options?: unknown): any {
        return difference(this, '_since', other, options)
    }
}

/**
 * The family of a date and a time of the day without a zone whose value is like a Temporal.PlainDateTime. A data type
 * of the user extends it with its type name, sent and read as one:
 * `class MeterReadingType extends PlainDateTimesType<MeterReading, 'MeterReading'> { static override readonly type = 'MeterReading' }`
 */
export abstract class PlainDateTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateTimeSqlDataType

    /** The year, as an int: Temporal's `year` */
    year(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    year(): any {
        return partOf(this, '_year')
    }
    /** The month, as an int from 1 (January) to 12 (December): Temporal's `month` */
    month(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    month(): any {
        return partOf(this, '_month')
    }
    /** The day of the month, as an int from 1 to 31: Temporal's `day` */
    day(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    day(): any {
        return partOf(this, '_day')
    }
    /** The day of the week, as an int from 1 (Monday) to 7 (Sunday), on every database: Temporal's `dayOfWeek` */
    dayOfWeek(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfWeek(): any {
        return partOf(this, '_dayOfWeek')
    }
    /** The day of the year, as an int from 1 to 366: Temporal's `dayOfYear` */
    dayOfYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfYear(): any {
        return partOf(this, '_dayOfYear')
    }
    /** The code of the month, `'M01'` to `'M12'`: Temporal's `monthCode` */
    monthCode(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    monthCode(): any {
        return __operation0(this as any, '_monthCode', StringType)
    }
    /** The days of the month of the date, from 28 to 31, as an int: Temporal's `daysInMonth` */
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
        return __operation0(this as any, '_inLeapYearOf', BooleanConditionType)
    }

    /** The hour, as an int from 0 to 23: Temporal's `hour` */
    hour(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    hour(): any {
        return partOf(this, '_hour')
    }
    /** The minute, as an int from 0 to 59: Temporal's `minute` */
    minute(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    minute(): any {
        return partOf(this, '_minute')
    }
    /** The second, as an int from 0 to 59, without its fraction: Temporal's `second` */
    second(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    second(): any {
        return partOf(this, '_second')
    }
    /** The millisecond of the second, as an int from 0 to 999: Temporal's `millisecond` */
    millisecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    millisecond(): any {
        return partOf(this, '_millisecond')
    }
    /**
     * The microsecond of the millisecond, as an int from 0 to 999: Temporal's `microsecond`. 0 where the database keeps
     * no microseconds
     */
    microsecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    microsecond(): any {
        return partOf(this, '_microsecond')
    }

    /** The date of this date and time, a plainDate: Temporal's `toPlainDate()` */
    toPlainDate(): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    toPlainDate(): any {
        return __operation0(this as any, '_toPlainDate', PlainDateType)
    }
    /** The time of the day of this date and time, a plainTime: Temporal's `toPlainTime()` */
    toPlainTime(): ValueSource<SourceOf<this>, PlainTimeType, OptionalityOf<this>>
    toPlainTime(): any {
        return __operation0(this as any, '_toPlainTime', PlainTimeType)
    }
    /**
     * The instant of this date and time as a wall clock of the zone of the database, an instant: Temporal's
     * `toZonedDateTime(zone).toInstant()` with the zone of the database, which completes it
     */
    toInstant(): ValueSource<SourceOf<this>, InstantType, OptionalityOf<this>>
    toInstant(): any {
        return __operation0(this as any, '_toInstant', InstantType)
    }
    /**
     * This date and time as a wall clock of the zone given (an IANA name or an offset), a zonedDateTime: Temporal's
     * `toZonedDateTime(zone, { disambiguation })`. A wall clock that the zone repeats or skips takes the instant the
     * disambiguation says: `'compatible'` (the default) the earlier of a repeated one and the later of a skipped one;
     * `'reject'` makes the query fail
     */
    toZonedDateTime(this: OfDatabaseWithZoneRules, timeZone: string, options?: TemporalDisambiguationOptions): ValueSource<SourceOf<this>, ZonedDateTimeType, OptionalityOf<this>>
    /** This date and time as a wall clock of the zone of the string given, a zonedDateTime: Temporal's `toZonedDateTime` */
    toZonedDateTime<VALUE extends IValueWithType<'type:string:'>>(this: OfDatabaseWithZoneRules, timeZone: VALUE, options?: TemporalDisambiguationOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, ZonedDateTimeType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    toZonedDateTime(timeZone: unknown, options?: unknown): any {
        return __zonedOfWallClock(this, timeZone, options)
    }

    /**
     * The date and time plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days and the time. The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add(duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The date and time plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days and the time. The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(duration: unknown, options?: unknown): any {
        return withDuration(this, '_addDuration', duration, options)
    }
    /** The date and time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added. With `{ overflow: 'reject' }` a day the month hasn't is rejected, as an error of the query */
    subtract(duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The date and time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added. With `{ overflow: 'reject' }` a day the month hasn't is rejected, as an error of the query */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(duration: unknown, options?: unknown): any {
        return withDuration(this, '_subtractDuration', duration, options)
    }
    /**
     * The date and time with the fields given in place of its own, as Temporal's `with`: a field out of its range is taken to the nearest value it can have, and the day to the last one of the month when the month has fewer. The fields are integers
     */
    with(fields: TemporalPlainDateFields & TemporalPlainTimeFields, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    with(fields: unknown, options?: unknown): any {
        return withFields(this, fields, options)
    }
    /**
     * The date and time rounded, as Temporal's `round`: to the unit given (`'minute'`), or with options, to multiples of
     * `roundingIncrement` of `smallestUnit` (`{ smallestUnit: 'minute', roundingIncrement: 15 }`) in the
     * `roundingMode` given (`'halfExpand'` by default: half up). Rounded to a day it is the midnight before or after it
     */
    round(options: TemporalTimeUnit | 'day' | 'days' | TemporalRoundingOptions<TemporalTimeUnit | 'day' | 'days'>): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(options: unknown): any {
        return rounded(this, options)
    }

    /**
     * The duration from this date and time to the other one, as Temporal's `until`: in days and smaller units by
     * default; `largestUnit` asks for larger ones, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     * (`{ smallestUnit: 'hour', roundingMode: 'halfExpand' }` to the nearest hour)
     */
    until(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /**
     * The duration from this date and time to the other one, as Temporal's `until`: in days and smaller units by
     * default; `largestUnit` asks for larger ones, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     * (`{ smallestUnit: 'hour', roundingMode: 'halfExpand' }` to the nearest hour)
     */
    until<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    until(other: unknown, options?: unknown): any {
        return difference(this, '_until', other, options)
    }
    /**
     * The duration from the other date and time to this one, as Temporal's `since`: `until` from this one to the other, with
     * the rounding mode inverted (floor for ceil), negated
     */
    since(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /**
     * The duration from the other date and time to this one, as Temporal's `since`: `until` from this one to the other, with
     * the rounding mode inverted (floor for ceil), negated
     */
    since<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    since(other: unknown, options?: unknown): any {
        return difference(this, '_since', other, options)
    }
}

/** A date without a zone, a Temporal.PlainDate */
export abstract class PlainDateType extends PlainDatesType<TemporalPlainDate, 'plainDate'> {
    static override readonly type = 'plainDate'
}

/** A time of the day without a zone, a Temporal.PlainTime */
export abstract class PlainTimeType extends PlainTimesType<TemporalPlainTime, 'plainTime'> {
    static override readonly type = 'plainTime'
}

/** A date and a time of the day without a zone, a Temporal.PlainDateTime */
export abstract class PlainDateTimeType extends PlainDateTimesType<TemporalPlainDateTime, 'plainDateTime'> {
    static override readonly type = 'plainDateTime'
}
