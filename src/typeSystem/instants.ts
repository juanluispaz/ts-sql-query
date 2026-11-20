import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { TemporalInstant } from './temporal.js'
import type { OptionalityOf, SourceOf, ValueSource } from './base.js'
import { __operation0 } from '../nodes/operations.js'
import { IntType } from './number.js'
import { BigintType } from './bigint.js'
import { PlainDateTimeType, PlainDateType, PlainTimeType } from './plainDates.js'

/** The date and time of the instant in the zone of the database: a plainDateTime */
function plainDateTimeOf(valueSource: unknown): any {
    return __operation0(valueSource as any, '_instantToPlainDateTime', PlainDateTimeType)
}

/*
 * An exact moment as Temporal has it: an instant (a Temporal.Instant), the same everywhere, with nanoseconds. It is kept
 * in any column of a date and a time: one with zone (PostgreSQL's `timestamptz`, Oracle's `TIMESTAMP WITH TIME ZONE`,
 * SQL Server's `datetimeoffset`) holds its instant; one without zone, the wall clock of the instant in the zone of the
 * database. It reaches the database and comes back with all the digits of the fraction of a second the database keeps.
 * Two instants are ordered by their moment, as Temporal's `Instant.compare`.
 */

/** The type in the database of an instant: a date and a time that hold one normalized instant (PostgreSQL's `timestamptz`) */
export const instantSqlDataType: SqlDataType = { family: 'datetime', fields: 'timestamp', timeZone: 'instant' }

/**
 * The family of an exact moment whose value is like a Temporal.Instant. A data type of the user extends it with its type
 * name, sent and read as one:
 * `class PaymentInstantType extends InstantsType<PaymentInstant, 'PaymentInstant'> { static override readonly type = 'PaymentInstant' }`
 */
export abstract class InstantsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = instantSqlDataType

    /** The milliseconds since 1970-01-01T00:00Z, as an int, rounded down: Temporal's `epochMilliseconds` */
    epochMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    epochMilliseconds(): any {
        return __operation0(this as any, '_epochMilliseconds', IntType)
    }
    /** The nanoseconds since 1970-01-01T00:00Z, as a bigint: Temporal's `epochNanoseconds` */
    epochNanoseconds(): ValueSource<SourceOf<this>, BigintType, OptionalityOf<this>>
    epochNanoseconds(): any {
        return __operation0(this as any, '_epochNanoseconds', BigintType)
    }
    /**
     * The date and time of the instant in the zone of the database, a plainDateTime: Temporal's
     * `toZonedDateTimeISO(zone).toPlainDateTime()` with the zone of the database
     */
    toPlainDateTime(): ValueSource<SourceOf<this>, PlainDateTimeType, OptionalityOf<this>>
    toPlainDateTime(): any {
        return plainDateTimeOf(this)
    }
    /** The date of the instant in the zone of the database, a plainDate: `toZonedDateTimeISO(zone).toPlainDate()` */
    toPlainDate(): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    toPlainDate(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainDate', PlainDateType)
    }
    /** The time of the day of the instant in the zone of the database, a plainTime: `toZonedDateTimeISO(zone).toPlainTime()` */
    toPlainTime(): ValueSource<SourceOf<this>, PlainTimeType, OptionalityOf<this>>
    toPlainTime(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainTime', PlainTimeType)
    }
}

/** An exact moment, a Temporal.Instant */
export abstract class InstantType extends InstantsType<TemporalInstant, 'instant'> {
    static override readonly type = 'instant'
}
