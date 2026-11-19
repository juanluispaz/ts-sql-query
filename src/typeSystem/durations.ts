import type { SqlDataType } from '../TypeAdapter.js'
import { EqualableType } from './equalable.js'
import type { TemporalDuration } from './temporal.js'

/*
 * An amount of time as Temporal has it: a duration (a Temporal.Duration), in years, months, weeks, days, hours ...
 * nanoseconds. PostgreSQL keeps it in an interval, Oracle in an interval of days to seconds or of years to months; the
 * other databases have no type for it, and keep it as its ISO 8601 text, the text of Temporal, as does a column whose
 * SQL data type is a text on any database. Two durations are compared only for equality: Temporal doesn't order them
 * without a date of reference (a month has no fixed number of days).
 */

/** The type in the database of a duration: an interval with every field (PostgreSQL's `interval`) */
export const durationSqlDataType: SqlDataType = { family: 'interval' }

/**
 * The family of a duration whose value is like a Temporal.Duration. A data type of the user extends it with its type
 * name, sent and read as one:
 * `class LeadTimeType extends DurationsType<LeadTime, 'LeadTime'> { static override readonly type = 'LeadTime' }`
 */
export abstract class DurationsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = durationSqlDataType
}

/** A duration, a Temporal.Duration */
export abstract class DurationType extends DurationsType<TemporalDuration, 'duration'> {
    static override readonly type = 'duration'
}
