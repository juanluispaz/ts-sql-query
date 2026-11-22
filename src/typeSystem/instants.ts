import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { __temporal, type TemporalDifferenceOptions, type TemporalDuration, type TemporalInstant, type TemporalRoundingOptions, type TemporalTimeDurationLike, type TemporalTimeUnit, type IntOfQuery, type TemporalTimeDurationLikeOfQuery } from './temporal.js'
import type { DataTypeOf, IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality, CombinedOptionalityOfUnion, OptionalType } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import { __newSqlOperation2ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import { __newSqlOperationConstValueSource } from '../nodes/constants.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { isValueSource } from '../nodes/NodeStrategy.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { operandTypeName } from '../utils/symbols.js'
import { instantDifferenceOptionsOf } from '../utils/instantOptions.js'
import { DurationType, __durationArgument, timeDurationFieldNames } from './durations.js'
import { IntType } from './number.js'
import { BigintType } from './bigint.js'
import { PlainDateTimeType, PlainDateType, PlainTimeType } from './plainDates.js'
import { ZonedDateTimeType, __zonedOfInstant, type OfDatabaseWithZoneRules } from './zonedDateTimes.js'

/** The date and time of the instant in the zone of the database: a plainDateTime */
function plainDateTimeOf(valueSource: unknown): any {
    return __operation0(valueSource as any, '_instantToPlainDateTime', PlainDateTimeType)
}

/** The wall clock of the instant in UTC, a plainDateTime: where Temporal computes the arithmetic of an instant */
function inUtcOf(valueSource: unknown): any {
    return __operation0(valueSource as any, '_instantInUtc', PlainDateTimeType)
}

/**
 * The instant plus or minus a duration of the time alone, of the same data type. A value with days or more is rejected
 * here, as Temporal rejects it; a value source with them makes the query fail
 */
function withDuration(valueSource: unknown, operation: '_instantAddDuration' | '_instantSubtractDuration', duration: unknown): any {
    const fields = duration as { years?: unknown, months?: unknown, weeks?: unknown, days?: unknown } | null
    if (fields !== null && typeof fields === 'object' && !isValueSource(fields) && ((fields.years ?? 0) !== 0 || (fields.months ?? 0) !== 0 || (fields.weeks ?? 0) !== 0 || (fields.days ?? 0) !== 0)) {
        // As Temporal: an instant has no calendar nor zone to give a day its length
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: duration, typeName: 'duration' }, 'An instant only adds or subtracts hours and smaller units, as in Temporal: ' + String(duration))
    }
    return __operation1(inUtcOf(valueSource), operation, __durationArgument(duration, timeDurationFieldNames), __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/**
 * The duration from the instant to the other one (until), or from the other one to the instant (since), with the
 * options of Temporal: the difference of their wall clocks in UTC, with units of the time alone. A value given is a
 * const of the data type of the instant
 */
function difference(valueSource: unknown, operation: '_until' | '_since', other: unknown, options: unknown): any {
    const normalized = instantDifferenceOptionsOf(options)
    if (!normalized) {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'instant' }, 'Invalid options of ' + operation.slice(1) + ' of an instant: ' + JSON.stringify(options))
    }
    const operand = isValueSource(other) ? other : __newSqlOperationConstValueSource(other, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)), 'required')
    return __newSqlOperation2ValueSource(operation, inUtcOf(valueSource), inUtcOf(operand), normalized, DurationType, getOptionalType2(valueSource as any, operand))
}

/**
 * The instant of an integer of milliseconds (or nanoseconds) since 1970-01-01T00:00Z, as Temporal's
 * `Instant.fromEpochMilliseconds` (or `fromEpochNanoseconds`): of a value source, computed by the database; of a number
 * (or a bigint), the Temporal.Instant, sent as a value. Temporal rejects a number that isn't an integer or is out of its
 * range
 */
export function __instantFromEpoch(value: unknown, operation: '_instantFromEpochMilliseconds' | '_instantFromEpochNanoseconds'): any {
    if (isValueSource(value)) {
        return __operation0(value as any, operation, InstantType)
    }
    let instant: TemporalInstant
    try {
        const temporal = __temporal('instant')
        instant = operation === '_instantFromEpochMilliseconds' ? temporal.Instant.fromEpochMilliseconds(value as number) : temporal.Instant.fromEpochNanoseconds(value as bigint)
    } catch (error) {
        if (error instanceof TsSqlProcessingError) {
            throw error
        }
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: 'instant' }, 'Invalid ' + (operation === '_instantFromEpochMilliseconds' ? 'milliseconds' : 'nanoseconds') + ' since the epoch of an instant: ' + String(value), error)
    }
    return __newSqlOperationConstValueSource(instant, InstantType, 'required')
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

    /**
     * The instant in the zone given (an IANA name or an offset), a zonedDateTime, with its date and time there:
     * Temporal's `toZonedDateTimeISO`
     */
    toZonedDateTimeISO(this: OfDatabaseWithZoneRules, timeZone: string): ValueSource<SourceOf<this>, ZonedDateTimeType, OptionalityOf<this>>
    /** The instant in the zone of the string given, a zonedDateTime: Temporal's `toZonedDateTimeISO` */
    toZonedDateTimeISO<VALUE extends IValueWithType<'type:string:'>>(this: OfDatabaseWithZoneRules, timeZone: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, ZonedDateTimeType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    toZonedDateTimeISO(timeZone: unknown): any {
        return __zonedOfInstant(this, timeZone, ZonedDateTimeType)
    }
    /**
     * The instant plus the duration given, as Temporal's `add`: of hours and smaller units only (a day has no fixed
     * length without a zone). The duration is a Temporal.Duration or its fields (`{ hours: 2 }`)
     */
    add(duration: TemporalDuration | TemporalTimeDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The instant plus the duration given, as Temporal's `add`: of hours and smaller units only (a day has no fixed
     * length without a zone). The duration is a value source: the query fails when it has days, weeks, months or years
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /** The value plus the duration of the fields given, as Temporal's `add`, where a field is an integer or an int of the query, like a column (`{ hours: tShift.hours }`): the database knows its value. The query fails, as Temporal throws, when the fields have different signs */
    add<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(duration: TemporalTimeDurationLikeOfQuery<IntOfQuery<SOURCE2, OPTIONAL_TYPE2>>): ValueSource<SourceOf<this> | SOURCE2, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    add(duration: unknown): any {
        return withDuration(this, '_instantAddDuration', duration)
    }
    /** The instant minus the duration given, as Temporal's `subtract`: of hours and smaller units only */
    subtract(duration: TemporalDuration | TemporalTimeDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The instant minus the duration given, as Temporal's `subtract`: of hours and smaller units only. The duration is
     * a value source: the query fails when it has days, weeks, months or years
     */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(duration: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /** The value minus the duration of the fields given, as Temporal's `subtract`, where a field is an integer or an int of the query, like a column (`{ hours: tShift.hours }`). The query fails, as Temporal throws, when the fields have different signs */
    subtract<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(duration: TemporalTimeDurationLikeOfQuery<IntOfQuery<SOURCE2, OPTIONAL_TYPE2>>): ValueSource<SourceOf<this> | SOURCE2, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    subtract(duration: unknown): any {
        return withDuration(this, '_instantSubtractDuration', duration)
    }
    /**
     * The instant rounded, as Temporal's `round`: to the unit given (`'minute'`), or with options, to multiples of
     * `roundingIncrement` of `smallestUnit`, which must divide a day (`{ smallestUnit: 'minute', roundingIncrement: 90 }`),
     * in the `roundingMode` given (`'halfExpand'` by default: half up)
     */
    round(options: TemporalTimeUnit | TemporalRoundingOptions<TemporalTimeUnit>): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(options: unknown): any {
        return __operation1(inUtcOf(this), '_roundInstant', options, __computedClassOf(this as object, __typeClassOf(this as any)))
    }
    /**
     * The duration from this instant to the other one, as Temporal's `until`: in seconds and smaller units by default;
     * `largestUnit` asks for minutes or hours, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     */
    until(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /**
     * The duration from this instant to the other one, as Temporal's `until`: in seconds and smaller units by default;
     * `largestUnit` asks for minutes or hours, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it
     */
    until<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    until(other: unknown, options?: unknown): any {
        return difference(this, '_until', other, options)
    }
    /** The duration from the other instant to this one, as Temporal's `since`: `until` with the rounding mode inverted, negated */
    since(other: VALUE_TYPE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this>, DurationType, OptionalityOf<this>>
    /** The duration from the other instant to this one, as Temporal's `since`: `until` with the rounding mode inverted, negated */
    since<VALUE extends IValueWithType<this[typeof operandTypeName]>>(other: VALUE, options?: TemporalDifferenceOptions<TemporalTimeUnit>): ValueSource<SourceOf<this> | SourceOf<VALUE>, DurationType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    since(other: unknown, options?: unknown): any {
        return difference(this, '_since', other, options)
    }
}

/** An exact moment, a Temporal.Instant */
export abstract class InstantType extends InstantsType<TemporalInstant, 'instant'> {
    static override readonly type = 'instant'
}
