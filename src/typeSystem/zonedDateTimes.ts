import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { __temporal, type TemporalZonedDateTime } from './temporal.js'
import type { DataTypeOf, IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import { __newSqlOperation2ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { isValueSource } from '../nodes/NodeStrategy.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { IntType } from './number.js'
import { BigintType } from './bigint.js'
import { StringType } from './strings.js'
import { InstantType } from './instants.js'
import { PlainDateTimeType, PlainDateType, PlainTimeType } from './plainDates.js'

/*
 * An exact moment in a time zone as Temporal has it: a zoned date and time (a Temporal.ZonedDateTime), an instant with
 * the zone it is seen in, an IANA name like `Europe/Madrid` or an offset like `+05:30`, which gives it its date and
 * time there. A database keeps it only where a column keeps a zone with each value: Oracle's `TIMESTAMP WITH TIME
 * ZONE`. Two are ordered by their instant, as Temporal's `ZonedDateTime.compare`.
 */

/** The type in the database of a zoned date and time: a date and a time with the zone of each value (Oracle's `TIMESTAMP WITH TIME ZONE`) */
export const zonedDateTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'timestamp', timeZone: 'kept' }

/** The date and time of the zoned date and time in its zone: a plainDateTime */
function plainDateTimeOf(valueSource: unknown): any {
    return __operation0(valueSource as any, '_zonedToPlainDateTime', PlainDateTimeType)
}

/** The zone given checked as Temporal checks it, when it is a value: an IANA name or an offset; a value source as it is */
function checkedTimeZone(timeZone: unknown): unknown {
    if (isValueSource(timeZone)) {
        return timeZone
    }
    try {
        // Temporal rejects an unknown zone, or what isn't a string, as it does creating a zoned date and time
        new (__temporal('zonedDateTime').ZonedDateTime)(0n, timeZone as string)
        return timeZone
    } catch (error) {
        if (error instanceof TsSqlProcessingError) {
            throw error
        }
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: timeZone, typeName: 'zonedDateTime' }, 'Invalid time zone: ' + String(timeZone), error)
    }
}

/** The instant of the value source in the zone given, of the class given (see InstantsType.toZonedDateTimeISO) */
export function __zonedOfInstant(instant: unknown, timeZone: unknown, typeClass: DataTypeClass): any {
    return __operation1(instant as any, '_instantToZoned', checkedTimeZone(timeZone), typeClass)
}

/** The wall clock of the value source in the zone given, with its disambiguation (see PlainDateTimesType.toZonedDateTime) */
export function __zonedOfWallClock(wallClock: unknown, timeZone: unknown, options: unknown): any {
    const disambiguation = (options as { disambiguation?: unknown } | undefined)?.disambiguation ?? 'compatible'
    if (options !== undefined && (options === null || typeof options !== 'object') || (disambiguation !== 'compatible' && disambiguation !== 'earlier' && disambiguation !== 'later' && disambiguation !== 'reject')) {
        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'zonedDateTime' }, 'Invalid options of toZonedDateTime: ' + JSON.stringify(options))
    }
    const zone = checkedTimeZone(timeZone)
    return __newSqlOperation2ValueSource('_plainDateTimeToZoned', wallClock as any, zone, disambiguation, ZonedDateTimeType, getOptionalType2(wallClock as any, zone))
}

/**
 * The family of an exact moment in a time zone whose value is like a Temporal.ZonedDateTime. A data type of the user
 * extends it with its type name, sent and read as one:
 * `class MeetingStartType extends ZonedDateTimesType<MeetingStart, 'MeetingStart'> { static override readonly type = 'MeetingStart' }`
 */
export abstract class ZonedDateTimesType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = zonedDateTimeSqlDataType

    /** The instant of the zoned date and time: Temporal's `toInstant` */
    toInstant(): ValueSource<SourceOf<this>, InstantType, OptionalityOf<this>>
    toInstant(): any {
        return __operation0(this as any, '_zonedToInstant', InstantType)
    }
    /** The date and time in its zone, a plainDateTime: Temporal's `toPlainDateTime` */
    toPlainDateTime(): ValueSource<SourceOf<this>, PlainDateTimeType, OptionalityOf<this>>
    toPlainDateTime(): any {
        return plainDateTimeOf(this)
    }
    /** The date in its zone, a plainDate: Temporal's `toPlainDate` */
    toPlainDate(): ValueSource<SourceOf<this>, PlainDateType, OptionalityOf<this>>
    toPlainDate(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainDate', PlainDateType)
    }
    /** The time of the day in its zone, a plainTime: Temporal's `toPlainTime` */
    toPlainTime(): ValueSource<SourceOf<this>, PlainTimeType, OptionalityOf<this>>
    toPlainTime(): any {
        return __operation0(plainDateTimeOf(this), '_toPlainTime', PlainTimeType)
    }
    /** The name of its zone, as a string: Temporal's `timeZoneId` (`'Europe/Madrid'`, or an offset like `'+05:30'`) */
    timeZoneId(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    timeZoneId(): any {
        return __operation0(this as any, '_zonedTimeZoneId', StringType)
    }
    /** The offset from UTC of its zone at its instant, as a string: Temporal's `offset` (`'+01:00'`) */
    offset(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    offset(): any {
        return __operation0(this as any, '_zonedOffset', StringType)
    }
    /** The offset from UTC of its zone at its instant, in nanoseconds, as an int: Temporal's `offsetNanoseconds` */
    offsetNanoseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    offsetNanoseconds(): any {
        return __operation0(this as any, '_zonedOffsetNanoseconds', IntType)
    }
    /** The milliseconds since 1970-01-01T00:00Z of its instant, as an int, rounded down: Temporal's `epochMilliseconds` */
    epochMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    epochMilliseconds(): any {
        return __operation0(this.toInstant(), '_epochMilliseconds', IntType)
    }
    /** The nanoseconds since 1970-01-01T00:00Z of its instant, as a bigint: Temporal's `epochNanoseconds` */
    epochNanoseconds(): ValueSource<SourceOf<this>, BigintType, OptionalityOf<this>>
    epochNanoseconds(): any {
        return __operation0(this.toInstant(), '_epochNanoseconds', BigintType)
    }
    /** The year in its zone, as an int: Temporal's `year` */
    year(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    year(): any {
        return __operation0(plainDateTimeOf(this), '_year', IntType)
    }
    /** The month in its zone, from 1 to 12, as an int: Temporal's `month` */
    month(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    month(): any {
        return __operation0(plainDateTimeOf(this), '_month', IntType)
    }
    /** The day of the month in its zone, as an int: Temporal's `day` */
    day(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    day(): any {
        return __operation0(plainDateTimeOf(this), '_day', IntType)
    }
    /** The day of the week in its zone, from 1 (Monday) to 7 (Sunday), as an int: Temporal's `dayOfWeek` */
    dayOfWeek(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfWeek(): any {
        return __operation0(plainDateTimeOf(this), '_dayOfWeek', IntType)
    }
    /** The day of the year in its zone, from 1, as an int: Temporal's `dayOfYear` */
    dayOfYear(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    dayOfYear(): any {
        return __operation0(plainDateTimeOf(this), '_dayOfYear', IntType)
    }
    /** The hour in its zone, as an int: Temporal's `hour` */
    hour(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    hour(): any {
        return __operation0(plainDateTimeOf(this), '_hour', IntType)
    }
    /** The minute in its zone, as an int: Temporal's `minute` */
    minute(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    minute(): any {
        return __operation0(plainDateTimeOf(this), '_minute', IntType)
    }
    /** The second in its zone, as an int: Temporal's `second` */
    second(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    second(): any {
        return __operation0(plainDateTimeOf(this), '_second', IntType)
    }
    /** The millisecond of the second, as an int: Temporal's `millisecond` */
    millisecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    millisecond(): any {
        return __operation0(plainDateTimeOf(this), '_millisecond', IntType)
    }
    /** The microsecond of the millisecond, from 0 to 999, as an int: Temporal's `microsecond` */
    microsecond(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    microsecond(): any {
        return __operation0(plainDateTimeOf(this), '_microsecond', IntType)
    }
    /** The same instant in the zone given (an IANA name or an offset), of the same data type: Temporal's `withTimeZone` */
    withTimeZone(timeZone: string): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The same instant in the zone of the string given (an IANA name or an offset), of the same data type: Temporal's `withTimeZone` */
    withTimeZone<VALUE extends IValueWithType<'type:string:'>>(timeZone: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    withTimeZone(timeZone: unknown): any {
        return __zonedOfInstant(this.toInstant(), timeZone, __computedClassOf(this as object, __typeClassOf(this as any)))
    }
}

/** An exact moment in a time zone, a Temporal.ZonedDateTime */
export abstract class ZonedDateTimeType extends ZonedDateTimesType<TemporalZonedDateTime, 'zonedDateTime'> {
    static override readonly type = 'zonedDateTime'
}
