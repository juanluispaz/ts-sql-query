import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { OptionalityOf, SourceOf, ValueSource, DataTypeOfClass } from './base.js'
import { __operation0 } from '../nodes/operations.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { IntType } from './number.js'
import { type AnyType } from './base.js'
import { localDateSqlDataType, localDateTimeSqlDataType, localTimeSqlDataType } from './dateTimeSqlDataTypes.js'
import { PlainDateTimeType, PlainDateType, PlainTimeType } from './plainDates.js'
import { InstantType } from './instants.js'
import { __wallClockClassOf } from '../nodes/adaptedTypeClass.js'

/*
 * The dates and times without a zone: a date (localDate), a time of the day (localTime), and both (localDateTime).
 * Each part of the value is asked with its getter, which gives an int.
 */

/** A part of a date or a time (its day, its hours, ...): an int */
function datePartOf(valueSource: AnyType, operation: keyof SqlFunction0): any {
    return __operation0(valueSource, operation, IntType)
}


/** The date and time of a localDateTime, a plainDateTime: of its instant, in the zone of the database */
function plainDateTimeOf(valueSource: unknown): any {
    return __operation0(valueSource as any, '_instantToPlainDateTime', __wallClockClassOf(valueSource as object, PlainDateTimeType))
}

/**
 * The family of a date without a zone. A data type of the user extends it with its type name, sent and read as one:
 * `class ReleaseDayType extends LocalDatesType<ReleaseDay, 'ReleaseDay'> { static override readonly type = 'ReleaseDay' }`
 */
export abstract class LocalDatesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<LocalDatesType<VALUE_TYPE, TYPE_NAME>>
    static override readonly sqlDataType: SqlDataType | undefined = localDateSqlDataType

    /** The day of the month, as an int from 1 to 31: what `getUTCDate()` of the Date read gives */
    getDate(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getDate(): any {
        return datePartOf(this, '_day')
    }
    /**
     * The day of the week, as an int from 0 (Sunday) to 6 (Saturday), like `getUTCDay()` of the Date read, on every
     * database
     */
    getDay(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getDay(): any {
        return datePartOf(this, '_dayOfWeekFromSunday')
    }
    /** The year, as an int: what `getUTCFullYear()` of the Date read gives */
    getFullYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getFullYear(): any {
        return datePartOf(this, '_year')
    }
    /**
     * The month, as an int from 0 (January) to 11 (December), like `getUTCMonth()` of the Date read; the SQL
     * subtracts 1 from the month of the database
     */
    getMonth(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getMonth(): any {
        return datePartOf(this, '_monthFromZero')
    }

    /**
     * The date as a plainDate: the day of the UTC getters of the Date read, what the same column gives declared as a
     * plainDate
     */
    toPlainDate(): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    toPlainDate(): any {
        return __operation0(this as any, '_toTemporalValue', PlainDateType)
    }
}

/**
 * The family of a time of the day without a zone. A data type of the user extends it with its type name, sent and
 * read as one:
 * `class OpeningTimeType extends LocalTimesType<OpeningTime, 'OpeningTime'> { static override readonly type = 'OpeningTime' }`
 */
export abstract class LocalTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<LocalTimesType<VALUE_TYPE, TYPE_NAME>>
    static override readonly sqlDataType: SqlDataType | undefined = localTimeSqlDataType

    /** The hours, as an int from 0 to 23: what `getUTCHours()` of the Date read gives */
    getHours(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getHours(): any {
        return datePartOf(this, '_hour')
    }
    /**
     * The milliseconds of the second, as an int from 0 to 999; the digits below a millisecond are dropped: what
     * `getUTCMilliseconds()` of the Date read gives
     */
    getMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getMilliseconds(): any {
        return datePartOf(this, '_millisecond')
    }
    /** The minutes, as an int from 0 to 59: what `getUTCMinutes()` of the Date read gives */
    getMinutes(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getMinutes(): any {
        return datePartOf(this, '_minute')
    }
    /**
     * The seconds, as an int from 0 to 59, without the fraction of a second: what `getUTCSeconds()` of the Date
     * read gives
     */
    getSeconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getSeconds(): any {
        return datePartOf(this, '_second')
    }

    /**
     * The time of the day as a plainTime, with all the digits the database keeps: what the same column gives declared
     * as a plainTime
     */
    toPlainTime(): ValueSource<SourceOf<this>, PlainTimeType, OptionalityOf<this>>
    toPlainTime(): any {
        return __operation0(this as any, '_toTemporalValue', PlainTimeType)
    }
}

/**
 * The family of a date and a time of the day without a zone. A data type of the user extends it with its type name,
 * sent and read as one:
 * `class AuditStampType extends LocalDateTimesType<AuditStamp, 'AuditStamp'> { static override readonly type = 'AuditStamp' }`
 */
export abstract class LocalDateTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<LocalDateTimesType<VALUE_TYPE, TYPE_NAME>>
    static override readonly sqlDataType: SqlDataType | undefined = localDateTimeSqlDataType

    /** The day of the month, as an int from 1 to 31: what `getUTCDate()` of the Date read gives */
    getDate(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getDate(): any {
        return datePartOf(this, '_day')
    }
    /**
     * The day of the week, as an int from 0 (Sunday) to 6 (Saturday), like `getUTCDay()` of the Date read, on every
     * database
     */
    getDay(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getDay(): any {
        return datePartOf(this, '_dayOfWeekFromSunday')
    }
    /** The year, as an int: what `getUTCFullYear()` of the Date read gives */
    getFullYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getFullYear(): any {
        return datePartOf(this, '_year')
    }
    /**
     * The month, as an int from 0 (January) to 11 (December), like `getUTCMonth()` of the Date read; the SQL
     * subtracts 1 from the month of the database
     */
    getMonth(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getMonth(): any {
        return datePartOf(this, '_monthFromZero')
    }
    /** The hours, as an int from 0 to 23: what `getUTCHours()` of the Date read gives */
    getHours(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getHours(): any {
        return datePartOf(this, '_hour')
    }
    /**
     * The milliseconds of the second, as an int from 0 to 999; the digits below a millisecond are dropped: what
     * `getUTCMilliseconds()` of the Date read gives
     */
    getMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getMilliseconds(): any {
        return datePartOf(this, '_millisecond')
    }
    /** The minutes, as an int from 0 to 59: what `getUTCMinutes()` of the Date read gives */
    getMinutes(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getMinutes(): any {
        return datePartOf(this, '_minute')
    }
    /**
     * The seconds, as an int from 0 to 59, without the fraction of a second: what `getUTCSeconds()` of the Date
     * read gives
     */
    getSeconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getSeconds(): any {
        return datePartOf(this, '_second')
    }
    /**
     * The milliseconds since 1970-01-01 00:00, as an int, counting the date and the time as UTC: what `getTime()` of
     * the Date read gives. The digits below a millisecond are dropped
     */
    getTime(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    getTime(): any {
        return datePartOf(this, '_epochMilliseconds')
    }

    /**
     * The instant of the Date read, an instant, with all the digits the database keeps: JavaScript's
     * `toTemporalInstant()`, what the same column gives declared as an instant
     */
    toInstant(): ValueSource<SourceOf<this>, InstantType, OptionalityOf<this>>
    toInstant(): any {
        return __operation0(this as any, '_toInstant', __wallClockClassOf(this, InstantType))
    }
    /**
     * The date and time as a plainDateTime, with all the digits the database keeps: the UTC getters of the Date read,
     * in a database in UTC; what the same column gives declared as a plainDateTime, as `toInstant().toPlainDateTime()`
     */
    toPlainDateTime(): ValueSource<SourceOf<this>, PlainDateTimeType, OptionalityOf<this>>
    toPlainDateTime(): any {
        return plainDateTimeOf(this)
    }
    /** The date as a plainDate, as `toPlainDateTime().toPlainDate()` */
    toPlainDate(): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    toPlainDate(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainDate', PlainDateType)
    }
    /** The time of the day as a plainTime, as `toPlainDateTime().toPlainTime()` */
    toPlainTime(): ValueSource<SourceOf<this>, PlainTimeType, OptionalityOf<this>>
    toPlainTime(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainTime', PlainTimeType)
    }
}

/** A date without a zone, a JavaScript Date */
export abstract class LocalDateType extends LocalDatesType<Date, 'localDate'> {
    /** A data type has no `of`: it is made by a family (see EqualableType.of) */
    declare static readonly of: never
    static override readonly type = 'localDate'
}

/** A time of the day without a zone, a JavaScript Date */
export abstract class LocalTimeType extends LocalTimesType<Date, 'localTime'> {
    /** A data type has no `of`: it is made by a family (see EqualableType.of) */
    declare static readonly of: never
    static override readonly type = 'localTime'
}

/** A date and a time of the day without a zone, a JavaScript Date */
export abstract class LocalDateTimeType extends LocalDateTimesType<Date, 'localDateTime'> {
    /** A data type has no `of`: it is made by a family (see EqualableType.of) */
    declare static readonly of: never
    static override readonly type = 'localDateTime'
}
