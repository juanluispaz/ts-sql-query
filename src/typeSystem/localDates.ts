import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, TypeClass, ValueSource } from './base.js'
import type { IntType } from './numbers.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/*
 * The dates and times without a zone: a date (localDate), a time of the day (localTime), and both (localDateTime).
 * Each part of the value is asked with its getter, which gives an int.
 */

/** A date without a zone */
export abstract class LocalDatesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    abstract getDate(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getDay(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getFullYear(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMonth(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
}

/** A time of the day without a zone */
export abstract class LocalTimesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    abstract getHours(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMilliseconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getMinutes(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract getSeconds(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
}

/** A date and a time of the day without a zone */
export abstract class LocalDateTimesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
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
    static override readonly __type = 'localDate'
    static override readonly __customType = undefined
    declare [typeName]: 'type:localDate:'
    declare [operandTypeName]: 'type:localDate:'
}

/** A time of the day without a zone, a JavaScript Date */
export abstract class LocalTimeType extends LocalTimesType<Date> {
    static override readonly __type = 'localTime'
    static override readonly __customType = undefined
    declare [typeName]: 'type:localTime:'
    declare [operandTypeName]: 'type:localTime:'
}

/** A date and a time of the day without a zone, a JavaScript Date */
export abstract class LocalDateTimeType extends LocalDateTimesType<Date> {
    static override readonly __type = 'localDateTime'
    static override readonly __customType = undefined
    declare [typeName]: 'type:localDateTime:'
    declare [operandTypeName]: 'type:localDateTime:'
}

/** A date without a zone of a type of the user, of its type name */
export abstract class CustomLocalDateType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalDatesType<VALUE_TYPE> {
    static override readonly __customType = 'customLocalDate'
    declare [typeName]: `type:${TYPE_NAME}:customLocalDate:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customLocalDate:`

    /** The data type of a date without a zone of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): TypeClass<CustomLocalDateType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomLocalDate extends CustomLocalDateType<VALUE_TYPE, TYPE_NAME> {
            static override readonly __type = typeName
        }
        return CustomLocalDate
    }
}

/** A time of the day without a zone of a type of the user, of its type name */
export abstract class CustomLocalTimeType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalTimesType<VALUE_TYPE> {
    static override readonly __customType = 'customLocalTime'
    declare [typeName]: `type:${TYPE_NAME}:customLocalTime:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customLocalTime:`

    /** The data type of a time of the day without a zone of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): TypeClass<CustomLocalTimeType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomLocalTime extends CustomLocalTimeType<VALUE_TYPE, TYPE_NAME> {
            static override readonly __type = typeName
        }
        return CustomLocalTime
    }
}

/** A date and a time of the day without a zone of a type of the user, of its type name */
export abstract class CustomLocalDateTimeType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalDateTimesType<VALUE_TYPE> {
    static override readonly __customType = 'customLocalDateTime'
    declare [typeName]: `type:${TYPE_NAME}:customLocalDateTime:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customLocalDateTime:`

    /** The data type of a date and a time of the day without a zone of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): TypeClass<CustomLocalDateTimeType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomLocalDateTime extends CustomLocalDateTimeType<VALUE_TYPE, TYPE_NAME> {
            static override readonly __type = typeName
        }
        return CustomLocalDateTime
    }
}
