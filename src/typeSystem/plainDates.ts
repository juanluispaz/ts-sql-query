import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { localDateSqlDataType, localDateTimeSqlDataType, localTimeSqlDataType } from './localDates.js'
import type { TemporalDuration, TemporalDurationLike, TemporalPlainDate, TemporalPlainDateFields, TemporalPlainDateTime, TemporalPlainTime, TemporalPlainTimeFields, TemporalRoundingOptions, TemporalTimeUnit } from './temporal.js'
import type { DataTypeOf, IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { __operation0, __operation1 } from '../nodes/operations.js'
import { IntType } from './number.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'

/** The value plus or minus a duration, of the same data type */
function withDuration(valueSource: unknown, operation: '_addDuration' | '_subtractDuration', duration: unknown): any {
    return __operation1(valueSource as any, operation, duration, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/** The value with the fields given, of the same data type */
function withFields(valueSource: unknown, fields: unknown): any {
    return __operation1(valueSource as any, '_withFields', fields, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/** The value rounded, of the same data type */
function rounded(valueSource: unknown, options: unknown): any {
    return __operation1(valueSource as any, '_roundTemporal', options, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
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

    /**
     * The date plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days, and the whole days of the time (`PT36H` is one day). The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add(duration: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The date plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days, and the whole days of the time (`PT36H` is one day). The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(duration: unknown): any {
        return withDuration(this, '_addDuration', duration)
    }
    /** The date minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added */
    subtract(duration: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The date minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(duration: unknown): any {
        return withDuration(this, '_subtractDuration', duration)
    }
    /**
     * The date with the fields given in place of its own, as Temporal's `with`: a field out of its range is taken to the nearest value it can have, and the day to the last one of the month when the month has fewer (`with({ day: 31 })` in February is the 29th or 28th). The fields are integers
     */
    with(fields: TemporalPlainDateFields): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    with(fields: unknown): any {
        return withFields(this, fields)
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
    add(duration: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The time plus the duration given, with the semantics of Temporal's `add`: only its time, going round at midnight (23:30 plus an hour is 00:30). The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(duration: unknown): any {
        return withDuration(this, '_addDuration', duration)
    }
    /** The time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added */
    subtract(duration: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(duration: unknown): any {
        return withDuration(this, '_subtractDuration', duration)
    }
    /**
     * The time with the fields given in place of its own, as Temporal's `with`: a field out of its range is taken to the nearest value it can have (`with({ hour: 25 })` is 23). The fields are integers
     */
    with(fields: TemporalPlainTimeFields): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    with(fields: unknown): any {
        return withFields(this, fields)
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
     * The date and time plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days and the time. The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add(duration: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The date and time plus the duration given, with the semantics of Temporal's `add`: the years and months first, keeping the day in the month (Jan 31 plus a month is Feb 29), then the days and the time. The duration is a
     * Temporal.Duration, its fields (`{ days: 3 }`), or a value of the type duration
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(duration: unknown): any {
        return withDuration(this, '_addDuration', duration)
    }
    /** The date and time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added */
    subtract(duration: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The date and time minus the duration given, with the semantics of Temporal's `subtract`: the duration negated, added */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(duration: unknown): any {
        return withDuration(this, '_subtractDuration', duration)
    }
    /**
     * The date and time with the fields given in place of its own, as Temporal's `with`: a field out of its range is taken to the nearest value it can have, and the day to the last one of the month when the month has fewer. The fields are integers
     */
    with(fields: TemporalPlainDateFields & TemporalPlainTimeFields): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    with(fields: unknown): any {
        return withFields(this, fields)
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
