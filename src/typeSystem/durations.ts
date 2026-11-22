import type { SqlDataType } from '../TypeAdapter.js'
import { EqualableType } from './equalable.js'
import type { TemporalDayOrTimeUnit, TemporalDuration, TemporalDurationLike, TemporalPlainDate, TemporalPlainDateTime, TemporalRelativeTotalOptions, TemporalTotalOptions } from './temporal.js'
import type { DataTypeOf, IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import { __newSqlOperation2ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import { DoubleType, IntType } from './number.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { durationTotalOf } from '../utils/durationTotal.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { isValueSource } from '../nodes/NodeStrategy.js'
import { durationFieldNames, __hasFieldOfTheQuery, __newDurationOfFieldsValueSource, type DurationFieldName, type DurationFieldsGiven } from '../nodes/durationOfFields.js'

/** A field of a duration: an int */
function fieldOf(valueSource: unknown, field: string): any {
    return __operation1(valueSource as any, '_durationField', field, IntType)
}

/** The duration negated or its absolute value: a duration of the same data type */
function sameDuration(valueSource: unknown, operation: '_durationNegated' | '_durationAbs'): any {
    return __operation0(valueSource as any, operation, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/** The duration plus or minus another one: a duration of the same data type */
function sumOf(valueSource: unknown, operation: '_durationAdd' | '_durationSubtract', other: unknown): any {
    return __operation1(valueSource as any, operation, other, __computedClassOf(valueSource as object, __typeClassOf(valueSource as any)))
}

/** The fields a duration of the time alone has, the only ones Temporal adds to an instant */
export const timeDurationFieldNames: readonly DurationFieldName[] = ['hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds']
/** The fields of a duration a month of a year adds */
export const yearMonthDurationFieldNames: readonly DurationFieldName[] = ['years', 'months']

/**
 * The duration given to an operation that adds it: the value given, or, for fields with a value of the query (an int,
 * like a column), a duration of those fields (see durationOfFields). Its numbers are checked as Temporal checks them
 * (integers of one sign), and its fields are among the ones given (allowed)
 */
export function __durationArgument(duration: unknown, allowed: readonly DurationFieldName[]): unknown {
    if (duration === null || typeof duration !== 'object' || isValueSource(duration) || !__hasFieldOfTheQuery(duration as DurationFieldsGiven)) {
        return duration
    }
    const fields = duration as DurationFieldsGiven
    let sign = 0
    for (let i = 0, length = durationFieldNames.length; i < length; i++) {
        const name = durationFieldNames[i]!
        const field = fields[name]
        if (field === undefined) {
            continue
        }
        if (!allowed.includes(name)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: name, typeName: 'duration' }, 'Invalid field of the duration to add or subtract: ' + name)
        }
        if (isValueSource(field)) {
            continue
        }
        if (typeof field !== 'number' || !Number.isInteger(field)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: field, typeName: 'duration' }, 'Invalid ' + name + ' of the duration to add or subtract, it must be an integer: ' + String(field))
        }
        if (field !== 0) {
            const fieldSign = field < 0 ? -1 : 1
            if (sign !== 0 && sign !== fieldSign) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: field, typeName: 'duration' }, 'Invalid ' + name + ' of the duration to add or subtract, the fields must have one sign: ' + String(field))
            }
            sign = fieldSign
        }
    }
    return __newDurationOfFieldsValueSource(fields, DurationType)
}

/** The duration in a unit, as Temporal's `total`: a double */
function totalOf(valueSource: unknown, options: unknown): any {
    const total = durationTotalOf(options)
    if (!total) {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'duration' }, 'Invalid options of total: ' + (typeof options === 'string' ? options : JSON.stringify(options)))
    }
    return __newSqlOperation2ValueSource('_durationTotal', valueSource as any, total.relativeTo, total.unit, DoubleType, getOptionalType2(valueSource as any, total.relativeTo))
}

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

    /** The years, as an int with the sign of the duration: Temporal's `years` of the duration as it is kept */
    years(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    years(): any {
        return fieldOf(this, 'years')
    }
    /** The months, as an int with the sign of the duration: Temporal's `months` of the duration as it is kept */
    months(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    months(): any {
        return fieldOf(this, 'months')
    }
    /** The weeks, as an int with the sign of the duration: Temporal's `weeks` of the duration as it is kept */
    weeks(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    weeks(): any {
        return fieldOf(this, 'weeks')
    }
    /** The days, as an int with the sign of the duration: Temporal's `days` of the duration as it is kept */
    days(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    days(): any {
        return fieldOf(this, 'days')
    }
    /** The hours, as an int with the sign of the duration: Temporal's `hours` of the duration as it is kept */
    hours(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    hours(): any {
        return fieldOf(this, 'hours')
    }
    /** The minutes, as an int with the sign of the duration: Temporal's `minutes` of the duration as it is kept */
    minutes(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    minutes(): any {
        return fieldOf(this, 'minutes')
    }
    /** The seconds, without their fraction, as an int with the sign of the duration: Temporal's `seconds` of the duration as it is kept */
    seconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    seconds(): any {
        return fieldOf(this, 'seconds')
    }
    /** The milliseconds of the fraction of a second, from 0 to 999, as an int with the sign of the duration: Temporal's `milliseconds` of the duration as it is kept */
    milliseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    milliseconds(): any {
        return fieldOf(this, 'milliseconds')
    }
    /** The microseconds of the millisecond, from 0 to 999, as an int with the sign of the duration: Temporal's `microseconds` of the duration as it is kept */
    microseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    microseconds(): any {
        return fieldOf(this, 'microseconds')
    }
    /** The nanoseconds of the microsecond, from 0 to 999, as an int with the sign of the duration: Temporal's `nanoseconds` of the duration as it is kept */
    nanoseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    nanoseconds(): any {
        return fieldOf(this, 'nanoseconds')
    }
    /** The sign of the duration, as an int: -1, 0 or 1, Temporal's `sign` */
    sign(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    sign(): any {
        return __operation0(this as any, '_durationSign', IntType)
    }
    /** The duration with the opposite sign, Temporal's `negated()` */
    negated(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    negated(): any {
        return sameDuration(this, '_durationNegated')
    }
    /** The duration without its sign, Temporal's `abs()` */
    abs(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    abs(): any {
        return sameDuration(this, '_durationAbs')
    }
    /**
     * The duration in the unit given (of days or of the time; a day is 24 hours), as a double with the fraction of the
     * unit: Temporal's `total` without a date of reference (`PT36H` is 1.5 days). A duration with years, months or
     * weeks fails the query: they need a date of reference
     */
    total(unit: TemporalDayOrTimeUnit | TemporalTotalOptions): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The duration in the unit given, as a double with the fraction of the unit, counted from the date of reference
     * (`relativeTo`; of a date and time, its date): Temporal's `total` with `relativeTo`. The duration is added to the
     * date, and a month or a year counts the days of the calendar there (`P1M2D` from Jan 31, 2024 is 1.069 months)
     */
    total(options: TemporalRelativeTotalOptions<TemporalPlainDate | TemporalPlainDateTime>): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The duration in the unit given, as a double with the fraction of the unit, counted from the date of reference
     * (`relativeTo`, a plainDate or the date of a plainDateTime): Temporal's `total` with `relativeTo`. The duration is
     * added to the date, and a month or a year counts the days of the calendar there
     */
    total<RELATIVE_TO extends IValueWithType<'type:plainDate:'> | IValueWithType<'type:plainDateTime:'>>(options: TemporalRelativeTotalOptions<RELATIVE_TO>): ValueSource<SourceOf<this> | SourceOf<RELATIVE_TO>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<RELATIVE_TO>>>
    total(options: unknown): any {
        return totalOf(this, options)
    }
    /**
     * The duration plus the one given, as Temporal's `add`: a day is 24 hours, and the sum is balanced up to the largest
     * field of the two (`PT90M` plus `PT30M` is `PT120M`, `P1D` plus `PT25H` is `P2DT1H`). A duration with years, months
     * or weeks fails the query, as Temporal throws. The duration is a Temporal.Duration or its fields (`{ hours: 2 }`)
     */
    add(other: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The duration plus the one given, as Temporal's `add`: a day is 24 hours, and the sum is balanced up to the largest
     * field of the two. A duration with years, months or weeks fails the query, as Temporal throws
     */
    add<VALUE extends IValueWithType<'type:duration:'>>(other: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(other: unknown): any {
        return sumOf(this, '_durationAdd', other)
    }
    /**
     * The duration minus the one given, as Temporal's `subtract`: the other one negated, added. A duration with years,
     * months or weeks fails the query, as Temporal throws. The duration is a Temporal.Duration or its fields
     */
    subtract(other: TemporalDuration | TemporalDurationLike): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The duration minus the one given, as Temporal's `subtract`: the other one negated, added */
    subtract<VALUE extends IValueWithType<'type:duration:'>>(other: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(other: unknown): any {
        return sumOf(this, '_durationSubtract', other)
    }
}

/** A duration, a Temporal.Duration */
export abstract class DurationType extends DurationsType<TemporalDuration, 'duration'> {
    static override readonly type = 'duration'
}
