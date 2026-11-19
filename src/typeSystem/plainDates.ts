import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { localDateSqlDataType, localDateTimeSqlDataType, localTimeSqlDataType } from './localDates.js'
import type { TemporalPlainDate, TemporalPlainDateTime, TemporalPlainTime } from './temporal.js'

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
}

/**
 * The family of a time of the day without a zone whose value is like a Temporal.PlainTime. A data type of the user
 * extends it with its type name, sent and read as one:
 * `class ShiftStartType extends PlainTimesType<ShiftStart, 'ShiftStart'> { static override readonly type = 'ShiftStart' }`
 */
export abstract class PlainTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localTimeSqlDataType
}

/**
 * The family of a date and a time of the day without a zone whose value is like a Temporal.PlainDateTime. A data type
 * of the user extends it with its type name, sent and read as one:
 * `class MeterReadingType extends PlainDateTimesType<MeterReading, 'MeterReading'> { static override readonly type = 'MeterReading' }`
 */
export abstract class PlainDateTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateTimeSqlDataType
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
