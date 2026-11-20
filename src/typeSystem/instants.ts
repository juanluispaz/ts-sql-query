import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { TemporalInstant } from './temporal.js'

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
}

/** An exact moment, a Temporal.Instant */
export abstract class InstantType extends InstantsType<TemporalInstant, 'instant'> {
    static override readonly type = 'instant'
}
