import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { localDateSqlDataType, localDateTimeSqlDataType, localTimeSqlDataType } from './localDates.js'
import type { TemporalPlainDate, TemporalPlainDateTime, TemporalPlainTime } from './temporal.js'
import type { IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { __operation0, __operation1 } from '../nodes/operations.js'
import { IntType } from './number.js'

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
