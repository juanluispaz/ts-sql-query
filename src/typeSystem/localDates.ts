import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import { __operation0 } from '../nodes/operations.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { IntType } from './number.js'
import { type AnyType } from './base.js'

/*
 * The dates and times without a zone: a date (localDate), a time of the day (localTime), and both (localDateTime).
 * Each part of the value is asked with its getter, which gives an int.
 */

/** A part of a date or a time (its day, its hours, ...): an int */
function datePartOf(valueSource: AnyType, operation: keyof SqlFunction0): any {
    return __operation0(valueSource, operation, IntType)
}

/** The types in the database of a localDate, a localTime and a localDateTime */
export const localDateSqlDataType: SqlDataType = { family: 'datetime', fields: 'date' }
export const localTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'time' }
export const localDateTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'timestamp' }

/**
 * The family of a date without a zone. A data type of the user extends it with its type name, sent and read as one:
 * `class ReleaseDayType extends LocalDatesType<ReleaseDay, 'ReleaseDay'> { static override readonly type = 'ReleaseDay' }`
 */
export abstract class LocalDatesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateSqlDataType

    getDate(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getDate(): any {
        return datePartOf(this, '_getDate')
    }
    getDay(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getDay(): any {
        return datePartOf(this, '_getDay')
    }
    getFullYear(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getFullYear(): any {
        return datePartOf(this, '_getFullYear')
    }
    getMonth(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getMonth(): any {
        return datePartOf(this, '_getMonth')
    }
}

/**
 * The family of a time of the day without a zone. A data type of the user extends it with its type name, sent and
 * read as one:
 * `class OpeningTimeType extends LocalTimesType<OpeningTime, 'OpeningTime'> { static override readonly type = 'OpeningTime' }`
 */
export abstract class LocalTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localTimeSqlDataType

    getHours(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getHours(): any {
        return datePartOf(this, '_getHours')
    }
    getMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getMilliseconds(): any {
        return datePartOf(this, '_getMilliseconds')
    }
    getMinutes(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getMinutes(): any {
        return datePartOf(this, '_getMinutes')
    }
    getSeconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getSeconds(): any {
        return datePartOf(this, '_getSeconds')
    }
}

/**
 * The family of a date and a time of the day without a zone. A data type of the user extends it with its type name,
 * sent and read as one:
 * `class AuditStampType extends LocalDateTimesType<AuditStamp, 'AuditStamp'> { static override readonly type = 'AuditStamp' }`
 */
export abstract class LocalDateTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateTimeSqlDataType

    getDate(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getDate(): any {
        return datePartOf(this, '_getDate')
    }
    getDay(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getDay(): any {
        return datePartOf(this, '_getDay')
    }
    getFullYear(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getFullYear(): any {
        return datePartOf(this, '_getFullYear')
    }
    getMonth(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getMonth(): any {
        return datePartOf(this, '_getMonth')
    }
    getHours(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getHours(): any {
        return datePartOf(this, '_getHours')
    }
    getMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getMilliseconds(): any {
        return datePartOf(this, '_getMilliseconds')
    }
    getMinutes(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getMinutes(): any {
        return datePartOf(this, '_getMinutes')
    }
    getSeconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getSeconds(): any {
        return datePartOf(this, '_getSeconds')
    }
    getTime(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    getTime(): any {
        return datePartOf(this, '_getTime')
    }
}

/** A date without a zone, a JavaScript Date */
export abstract class LocalDateType extends LocalDatesType<Date, 'localDate'> {
    static override readonly type = 'localDate'
}

/** A time of the day without a zone, a JavaScript Date */
export abstract class LocalTimeType extends LocalTimesType<Date, 'localTime'> {
    static override readonly type = 'localTime'
}

/** A date and a time of the day without a zone, a JavaScript Date */
export abstract class LocalDateTimeType extends LocalDateTimesType<Date, 'localDateTime'> {
    static override readonly type = 'localDateTime'
}
