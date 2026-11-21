import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { __temporal, type TemporalDateUnit, type TemporalDifferenceOptions, type TemporalDisambiguation, type TemporalDuration, type TemporalDurationLike, type TemporalOffsetOption, type TemporalOverflowOptions, type TemporalPlainDateFields, type TemporalPlainTime, type TemporalPlainTimeFields, type TemporalRoundingOptions, type TemporalTimeUnit, type TemporalZonedDateTime } from './temporal.js'
import type { DataTypeOf, IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import type { HasSource } from '../utils/ITableOrView.js'
import type { NDBWithType } from '../utils/sourceName.js'
import { __newSqlOperation2ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import { __newSqlOperationConstValueSource } from '../nodes/constants.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { isValueSource } from '../nodes/NodeStrategy.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { operandTypeName } from '../utils/symbols.js'
import { compatibleInterpretation, isZonedDisambiguation, preferringOffsetInterpretation, zonedWithInterpretationOf } from '../utils/zonedOptions.js'
import { plainTemporalDifferenceOf } from '../utils/plainTemporalDifference.js'
import { plainTemporalRoundingOf } from '../utils/plainTemporalRounding.js'
import { instantDifferenceOptionsOf } from '../utils/instantOptions.js'

import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { DoubleType, IntType } from './number.js'
import { DurationType } from './durations.js'
import { BigintType } from './bigint.js'
import { StringType } from './strings.js'
import { InstantType } from './instants.js'
import { PlainDateTimeType, PlainDateType, PlainTimeType } from './plainDates.js'

/*
 * An exact moment in a time zone as Temporal has it: a zoned date and time (a Temporal.ZonedDateTime), an instant with
 * the zone it is seen in, an IANA name like `Europe/Madrid` or an offset like `+05:30`, which gives it its date and
 * time there. A database keeps it only where a column keeps a zone with each value: Oracle's `TIMESTAMP WITH TIME
 * ZONE`. Two are ordered by their instant, as Temporal's `ZonedDateTime.compare`.
 */

/** The type in the database of a zoned date and time: a date and a time with the zone of each value (Oracle's `TIMESTAMP WITH TIME ZONE`) */
/**
 * A value source of a database that computes with the rules of the time zones (Oracle, PostgreSQL): what needs them
 * (taking a value to a zone, the arithmetic of a zoned date and time) is offered only there. MariaDB, MySQL, SQLite and SQL
 * Server keep a zoned date and time as its text, which gives its parts and its instant without them
 */
export type OfDatabaseWithZoneRules = HasSource<NDBWithType<'oracle' | 'postgreSql' | 'noopDB'>>

export const zonedDateTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'timestamp', timeZone: 'kept' }

/** The date and time of the zoned date and time in its zone: a plainDateTime */
function plainDateTimeOf(valueSource: unknown): any {
    return __operation0(valueSource as any, '_zonedToPlainDateTime', PlainDateTimeType)
}

/** The data type of the value source, to give it to a value computed from it */
function sameClassOf(valueSource: unknown): any {
    return __computedClassOf(valueSource as object, __typeClassOf(valueSource as any))
}

/**
 * The zoned date and time where a wall clock computed from it, to take it back to its zone with wallClockIn, refers to
 * it: the database computes the value once and names it
 */
function referenceOf(zoned: unknown): any {
    return __operation0(zoned as any, '_zonedOperandReference', sameClassOf(zoned))
}

/**
 * A wall clock (a plainDateTime value source computed from the reference of the zoned date and time, see referenceOf)
 * in the zone of the zoned date and time, as Temporal interprets it
 */
function wallClockIn(wallClock: unknown, zoned: unknown, interpretation: unknown): any {
    return __newSqlOperation2ValueSource('_zonedOfWallClockIn', wallClock as any, zoned, interpretation, sameClassOf(zoned), getOptionalType2(wallClock as any, zoned as any))
}

/** The zoned date and time plus or minus a duration, as Temporal's `add` and `subtract` */
function withDuration(valueSource: unknown, operation: '_zonedAddDuration' | '_zonedSubtractDuration', duration: unknown, options: unknown): any {
    const overflow = options === undefined || options === null ? undefined : (options as { overflow?: unknown }).overflow
    if (overflow !== undefined && overflow !== 'constrain' && overflow !== 'reject') {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: overflow, typeName: 'overflow' }, 'Invalid overflow option, it must be constrain or reject: ' + String(overflow))
    }
    const rejecting = overflow === 'reject' ? (operation === '_zonedAddDuration' ? '_zonedAddDurationRejecting' : '_zonedSubtractDurationRejecting') : operation
    return __operation1(valueSource as any, rejecting, duration, sameClassOf(valueSource))
}

/**
 * The duration from the zoned date and time to the other one (until), or from the other one to it (since), with the
 * options of Temporal: in hours and smaller units (the default) the difference of their instants; in days or larger
 * units the days of the calendar in their zone. A value given is a const of the data type of the value
 */
function difference(valueSource: unknown, operation: '_until' | '_since', other: unknown, options: unknown): any {
    const settings = plainTemporalDifferenceOf(options, 'timestamp', false, 'hour')
    if (!settings) {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'zonedDateTime' }, 'Invalid options of ' + operation.slice(1) + ' of a zoned date and time: ' + JSON.stringify(options))
    }
    const operand = isValueSource(other) ? other : __newSqlOperationConstValueSource(other, sameClassOf(valueSource), 'required')
    const optionalType = getOptionalType2(valueSource as any, operand)
    const largestUnit = settings.largestUnit
    if (largestUnit === 'year' || largestUnit === 'month' || largestUnit === 'week' || largestUnit === 'day') {
        return __newSqlOperation2ValueSource(operation === '_until' ? '_zonedUntil' : '_zonedSince', valueSource as any, operand, options, DurationType, optionalType)
    }
    return __newSqlOperation2ValueSource(operation, inUtcOf(valueSource), inUtcOf(operand), instantDifferenceOptionsOf(options, 'hour'), DurationType, optionalType)
}

/** The wall clock in UTC of the instant of the zoned date and time, a plainDateTime: where the time is computed */
function inUtcOf(valueSource: unknown): any {
    return __operation0(valueSource as any, '_zonedInUtc', PlainDateTimeType)
}

/** The zone given checked as Temporal checks it, when it is a value: an IANA name or an offset; a value source as it is */
function checkedTimeZone(timeZone: unknown): unknown {
    if (isValueSource(timeZone)) {
        return timeZone
    }
    try {
        // Temporal rejects an unknown zone, or what isn't a string, as it does creating a zoned date and time
        new (__temporal('zonedDateTime').ZonedDateTime)(0n, timeZone as string)
        return timeZone
    } catch (error) {
        if (error instanceof TsSqlProcessingError) {
            throw error
        }
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: timeZone, typeName: 'zonedDateTime' }, 'Invalid time zone: ' + String(timeZone), error)
    }
}

/** The instant of the value source in the zone given, of the class given (see InstantsType.toZonedDateTimeISO) */
export function __zonedOfInstant(instant: unknown, timeZone: unknown, typeClass: DataTypeClass): any {
    return __operation1(instant as any, '_instantToZoned', checkedTimeZone(timeZone), typeClass)
}

/** The wall clock of the value source in the zone given, with its disambiguation (see PlainDateTimesType.toZonedDateTime) */
export function __zonedOfWallClock(wallClock: unknown, timeZone: unknown, options: unknown): any {
    const disambiguation = (options as { disambiguation?: unknown } | undefined)?.disambiguation ?? 'compatible'
    if (options !== undefined && (options === null || typeof options !== 'object') || !isZonedDisambiguation(disambiguation)) {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'zonedDateTime' }, 'Invalid options of toZonedDateTime: ' + JSON.stringify(options))
    }
    const zone = checkedTimeZone(timeZone)
    return __newSqlOperation2ValueSource('_plainDateTimeToZoned', wallClock as any, zone, disambiguation, ZonedDateTimeType, getOptionalType2(wallClock as any, zone))
}

/**
 * The family of an exact moment in a time zone whose value is like a Temporal.ZonedDateTime. A data type of the user
 * extends it with its type name, sent and read as one:
 * `class MeetingStartType extends ZonedDateTimesType<MeetingStart, 'MeetingStart'> { static override readonly type = 'MeetingStart' }`
 */
export abstract class ZonedDateTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = zonedDateTimeSqlDataType

    /** The instant of the zoned date and time: Temporal's `toInstant` */
    toInstant(): ValueSource<SourceOf<this>, InstantType, OptionalityOf<this>>
    toInstant(): any {
        return __operation0(this as any, '_zonedToInstant', InstantType)
    }
    /** The date and time in its zone, a plainDateTime: Temporal's `toPlainDateTime` */
    toPlainDateTime(): ValueSource<SourceOf<this>, PlainDateTimeType, OptionalityOf<this>>
    toPlainDateTime(): any {
        return plainDateTimeOf(this)
    }
    /** The date in its zone, a plainDate: Temporal's `toPlainDate` */
    toPlainDate(): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    toPlainDate(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainDate', PlainDateType)
    }
    /** The time of the day in its zone, a plainTime: Temporal's `toPlainTime` */
    toPlainTime(): ValueSource<SourceOf<this>, PlainTimeType, OptionalityOf<this>>
    toPlainTime(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainTime', PlainTimeType)
    }
    /** The name of its zone, as a string: Temporal's `timeZoneId` (`'Europe/Madrid'`, or an offset like `'+05:30'`) */
    timeZoneId(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    timeZoneId(): any {
        return __operation0(this as any, '_zonedTimeZoneId', StringType)
    }
    /** The offset from UTC of its zone at its instant, as a string: Temporal's `offset` (`'+01:00'`) */
    offset(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    offset(): any {
        return __operation0(this as any, '_zonedOffset', StringType)
    }
    /** The offset from UTC of its zone at its instant, in nanoseconds, as an int: Temporal's `offsetNanoseconds` */
    offsetNanoseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    offsetNanoseconds(): any {
        return __operation0(this as any, '_zonedOffsetNanoseconds', IntType)
    }
    /** The milliseconds since 1970-01-01T00:00Z of its instant, as an int, rounded down: Temporal's `epochMilliseconds` */
    epochMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    epochMilliseconds(): any {
        return __operation0(this.toInstant(), '_epochMilliseconds', IntType)
    }
    /** The nanoseconds since 1970-01-01T00:00Z of its instant, as a bigint: Temporal's `epochNanoseconds` */
    epochNanoseconds(): ValueSource<SourceOf<this>, BigintType, OptionalityOf<this>>
    epochNanoseconds(): any {
        return __operation0(this.toInstant(), '_epochNanoseconds', BigintType)
    }
    /** The year in its zone, as an int: Temporal's `year` */
    year(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    year(): any {
        return __operation0(plainDateTimeOf(this), '_year', IntType)
    }
    /** The month in its zone, from 1 to 12, as an int: Temporal's `month` */
    month(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    month(): any {
        return __operation0(plainDateTimeOf(this), '_month', IntType)
    }
    /** The day of the month in its zone, as an int: Temporal's `day` */
    day(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    day(): any {
        return __operation0(plainDateTimeOf(this), '_day', IntType)
    }
    /** The day of the week in its zone, from 1 (Monday) to 7 (Sunday), as an int: Temporal's `dayOfWeek` */
    dayOfWeek(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfWeek(): any {
        return __operation0(plainDateTimeOf(this), '_dayOfWeek', IntType)
    }
    /** The day of the year in its zone, from 1, as an int: Temporal's `dayOfYear` */
    dayOfYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfYear(): any {
        return __operation0(plainDateTimeOf(this), '_dayOfYear', IntType)
    }
    /** The hour in its zone, as an int: Temporal's `hour` */
    hour(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    hour(): any {
        return __operation0(plainDateTimeOf(this), '_hour', IntType)
    }
    /** The minute in its zone, as an int: Temporal's `minute` */
    minute(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    minute(): any {
        return __operation0(plainDateTimeOf(this), '_minute', IntType)
    }
    /** The second in its zone, as an int: Temporal's `second` */
    second(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    second(): any {
        return __operation0(plainDateTimeOf(this), '_second', IntType)
    }
    /** The millisecond of the second, as an int: Temporal's `millisecond` */
    millisecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    millisecond(): any {
        return __operation0(plainDateTimeOf(this), '_millisecond', IntType)
    }
    /** The microsecond of the millisecond, from 0 to 999, as an int: Temporal's `microsecond` */
    microsecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    microsecond(): any {
        return __operation0(plainDateTimeOf(this), '_microsecond', IntType)
    }
    /** The same instant in the zone given (an IANA name or an offset), of the same data type: Temporal's `withTimeZone` */
    withTimeZone(this: OfDatabaseWithZoneRules, timeZone: string): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The same instant in the zone of the string given (an IANA name or an offset), of the same data type: Temporal's `withTimeZone` */
    withTimeZone<VALUE extends IValueWithType<'type:string:'>>(this: OfDatabaseWithZoneRules, timeZone: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    withTimeZone(timeZone: unknown): any {
        return __zonedOfInstant(this.toInstant(), timeZone, __computedClassOf(this as object, __typeClassOf(this as any)))
    }

    /**
     * The zoned date and time plus the duration given, as Temporal's `add`: its years, months, weeks and days are added
     * to the date in its zone (the day kept in the month, or rejected with `overflow: 'reject'`, which makes the query
     * fail), and the wall clock reached is taken back to its zone (moved forward when the zone skips it, the earlier one
     * when it repeats it); then its hours and smaller units are added to that instant. The duration is a
     * Temporal.Duration or its fields (`{ days: 1, hours: 2 }`)
     */
    add(this: OfDatabaseWithZoneRules, duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The zoned date and time plus the duration given, as Temporal's `add`, a duration value source */
    add<VALUE extends IValueWithType<'type:duration:'>>(this: OfDatabaseWithZoneRules, duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(duration: unknown, options?: unknown): any {
        return withDuration(this, '_zonedAddDuration', duration, options)
    }
    /** The zoned date and time minus the duration given, as Temporal's `subtract`: `add` of the duration negated */
    subtract(this: OfDatabaseWithZoneRules, duration: TemporalDuration | TemporalDurationLike, options?: TemporalOverflowOptions): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The zoned date and time minus the duration given, as Temporal's `subtract`, a duration value source */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(this: OfDatabaseWithZoneRules, duration: VALUE, options?: TemporalOverflowOptions): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(duration: unknown, options?: unknown): any {
        return withDuration(this, '_zonedSubtractDuration', duration, options)
    }
    /**
     * The zoned date and time with the fields given in place of its own, as Temporal's `with`: the fields of its date
     * and time in its zone (the day taken to the last one of the month, or rejected with `overflow: 'reject'`), and the
     * wall clock taken back to its zone keeping its offset when the zone still has it (`offset: 'prefer'`, the default;
     * the field `offset` gives another one), otherwise disambiguated (`disambiguation`); `offset: 'use'` takes the
     * offset as it is, `'ignore'` disambiguates always, and `'reject'` makes the query fail when the zone hasn't it
     */
    with(this: OfDatabaseWithZoneRules, fields: TemporalPlainDateFields & TemporalPlainTimeFields & { readonly offset?: string | undefined }, options?: TemporalOverflowOptions & { readonly disambiguation?: TemporalDisambiguation | undefined, readonly offset?: TemporalOffsetOption | undefined }): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    with(fields: unknown, options?: unknown): any {
        const offsetField = fields !== null && typeof fields === 'object' ? (fields as { offset?: unknown }).offset : undefined
        const interpretation = zonedWithInterpretationOf(options, offsetField)
        if (!interpretation) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: offsetField === undefined ? options : fields, typeName: 'zonedDateTime' }, 'Invalid fields or options of with of a zoned date and time: ' + JSON.stringify(fields) + ', ' + JSON.stringify(options))
        }
        let onlyOffset = offsetField !== undefined
        for (const name in fields as object) {
            if (name !== 'offset' && (fields as Record<string, unknown>)[name] !== undefined) {
                onlyOffset = false
            }
        }
        const wall = onlyOffset ? plainDateTimeOf(referenceOf(this)) : plainDateTimeOf(referenceOf(this)).with(fields, options === undefined || options === null ? undefined : { overflow: (options as { overflow?: unknown }).overflow })
        return wallClockIn(wall, this, interpretation)
    }
    /**
     * The zoned date and time at the time of the day given, or at the start of its day without one, as Temporal's
     * `withPlainTime`: the wall clock taken back to its zone as `'compatible'` disambiguates it
     */
    withPlainTime(this: OfDatabaseWithZoneRules, time?: TemporalPlainTime): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The zoned date and time at the time of the day of the plainTime given, as Temporal's `withPlainTime` */
    withPlainTime<VALUE extends IValueWithType<'type:plainTime:'>>(this: OfDatabaseWithZoneRules, time: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    withPlainTime(time?: unknown): any {
        if (time === undefined) {
            // Offered on the databases that compute with the rules of the zones, as this method (see OfDatabaseWithZoneRules)
            return (this as unknown as { startOfDay(): unknown }).startOfDay()
        }
        return wallClockIn(referenceOf(this).toPlainDate().toPlainDateTime(time), this, compatibleInterpretation)
    }
    /**
     * The start of its day in its zone, as Temporal's `startOfDay`: its midnight, or the first instant of the day when
     * the zone skips midnight
     */
    startOfDay(this: OfDatabaseWithZoneRules): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    startOfDay(): any {
        return wallClockIn(referenceOf(this).toPlainDate().toPlainDateTime(), this, compatibleInterpretation)
    }
    /** The hours of its day in its zone, as a double: Temporal's `hoursInDay` (23 or 25 where the zone changes its offset) */
    hoursInDay(this: OfDatabaseWithZoneRules): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    hoursInDay(): any {
        return __operation0(this as any, '_zonedHoursInDay', DoubleType)
    }
    /**
     * The zoned date and time rounded, as Temporal's `round`: to the start of its day or of the next one (`'day'`, the
     * nearer one by the length of the day in its zone), or its wall clock rounded to the unit given (`'minute'`), or with
     * options, to multiples of `roundingIncrement` of `smallestUnit` in the `roundingMode` given (`'halfExpand'` by
     * default), taken back to its zone keeping its offset when the zone still has it
     */
    round(this: OfDatabaseWithZoneRules, options: TemporalTimeUnit | 'day' | 'days' | TemporalRoundingOptions<TemporalTimeUnit | 'day' | 'days'>): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(options: unknown): any {
        const rounding = plainTemporalRoundingOf(options, 'timestamp')
        if (!rounding) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'zonedDateTime' }, 'Invalid options to round a zoned date and time: ' + JSON.stringify(options))
        }
        if (rounding.step === 86_400_000_000_000n) {
            return __operation1(this as any, '_zonedRoundToDay', rounding.mode, sameClassOf(this))
        }
        return wallClockIn(plainDateTimeOf(referenceOf(this)).round(options), this, preferringOffsetInterpretation)
    }
    /**
     * The duration from this zoned date and time to the other one, as Temporal's `until`: in hours and smaller units
     * by default, the difference of their instants; with a `largestUnit` of days or larger, the days of the calendar in
     * their zone (both must be in the same zone, or the query fails), each with its length there; `smallestUnit`,
     * `roundingIncrement` and `roundingMode` round it
     */
    until(this: OfDatabaseWithZoneRules, other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /** The duration from this zoned date and time to the other one, as Temporal's `until` */
    until<VALUE extends IValueWithType<this[typeof operandTypeName]>>(this: OfDatabaseWithZoneRules, other: VALUE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    until(other: unknown, options?: unknown): any {
        return difference(this, '_until', other, options)
    }
    /** The duration from the other zoned date and time to this one, as Temporal's `since`: `until` with the rounding mode inverted, negated */
    since(this: OfDatabaseWithZoneRules, other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /** The duration from the other zoned date and time to this one, as Temporal's `since` */
    since<VALUE extends IValueWithType<this[typeof operandTypeName]>>(this: OfDatabaseWithZoneRules, other: VALUE, options?: TemporalDifferenceOptions<TemporalDateUnit | TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    since(other: unknown, options?: unknown): any {
        return difference(this, '_since', other, options)
    }
}

/** An exact moment in a time zone, a Temporal.ZonedDateTime */
export abstract class ZonedDateTimeType extends ZonedDateTimesType<TemporalZonedDateTime, 'zonedDateTime'> {
    static override readonly type = 'zonedDateTime'
}
