import type { CustomType } from '../TypeAdapter.js'
import { __isLocalDate, __isLocalDateTime, __isLocalTime } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import { operandTypeName, typeName, runtimeTypes } from '../utils/symbols.js'
import { IntType } from './number.js'

/*
 * The dates and times without a zone: a date (localDate), a time of the day (localTime), and both (localDateTime).
 * Each part of the value is asked with its getter, which gives an int.
 */

/** A date without a zone */
export abstract class LocalDatesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** While its methods still live in ValueSourceImpl: the built-in data types they give */
    static readonly [runtimeTypes] = { int: IntType }
    /** Whether a type and a custom type are of a localDate or a customLocalDate */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isLocalDate(type, customType)
    }

    abstract getDate(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getDay(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getFullYear(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMonth(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
}

/** A time of the day without a zone */
export abstract class LocalTimesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** While its methods still live in ValueSourceImpl: the built-in data types they give */
    static readonly [runtimeTypes] = { int: IntType }
    /** Whether a type and a custom type are of a localTime or a customLocalTime */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isLocalTime(type, customType)
    }

    abstract getHours(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMinutes(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getSeconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
}

/** A date and a time of the day without a zone */
export abstract class LocalDateTimesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** While its methods still live in ValueSourceImpl: the built-in data types they give */
    static readonly [runtimeTypes] = { int: IntType }
    /** Whether a type and a custom type are of a localDateTime or a customLocalDateTime */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isLocalDateTime(type, customType)
    }

    abstract getDate(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getDay(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getFullYear(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMonth(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getHours(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMinutes(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getSeconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getTime(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
}

/** A date without a zone, a JavaScript Date */
export abstract class LocalDateType extends LocalDatesType<Date> {
    static override readonly type = 'localDate'
    static override readonly customType = undefined
    declare [typeName]: 'type:localDate:'
    declare [operandTypeName]: 'type:localDate:'
}

/** A time of the day without a zone, a JavaScript Date */
export abstract class LocalTimeType extends LocalTimesType<Date> {
    static override readonly type = 'localTime'
    static override readonly customType = undefined
    declare [typeName]: 'type:localTime:'
    declare [operandTypeName]: 'type:localTime:'
}

/** A date and a time of the day without a zone, a JavaScript Date */
export abstract class LocalDateTimeType extends LocalDateTimesType<Date> {
    static override readonly type = 'localDateTime'
    static override readonly customType = undefined
    declare [typeName]: 'type:localDateTime:'
    declare [operandTypeName]: 'type:localDateTime:'
}
