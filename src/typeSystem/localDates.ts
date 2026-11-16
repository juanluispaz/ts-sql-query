import type { CustomType, SqlDataType } from '../TypeAdapter.js'
import { __isLocalDate, __isLocalDateTime, __isLocalTime } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { __operation0 } from '../nodes/operations.js'
import type { DataTypeValueSource } from '../nodes/NodeStrategy.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { IntType } from './number.js'

/*
 * The dates and times without a zone: a date (localDate), a time of the day (localTime), and both (localDateTime).
 * Each part of the value is asked with its getter, which gives an int.
 */

/** A part of a date or a time (its day, its hours, ...): an int */
function datePartOf(valueSource: DataTypeValueSource, operation: keyof SqlFunction0): any {
    return __operation0(valueSource, operation, IntType)
}

/** A date without a zone */
/** The types in the database of a localDate, a localTime and a localDateTime */
export const localDateSqlDataType: SqlDataType = { family: 'datetime', fields: 'date' }
export const localTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'time' }
export const localDateTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'timestamp' }

export abstract class LocalDatesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a localDate or a customLocalDate */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isLocalDate(type, customType)
    }

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

/** A time of the day without a zone */
export abstract class LocalTimesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a localTime or a customLocalTime */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isLocalTime(type, customType)
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
}

/** A date and a time of the day without a zone */
export abstract class LocalDateTimesType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a localDateTime or a customLocalDateTime */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isLocalDateTime(type, customType)
    }

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
export abstract class LocalDateType extends LocalDatesType<Date> {
    static override readonly type = 'localDate'
    static override readonly customType = undefined
    static override readonly sqlDataType: SqlDataType = localDateSqlDataType
    declare [typeName]: 'type:localDate:'
    declare [operandTypeName]: 'type:localDate:'
}

/** A time of the day without a zone, a JavaScript Date */
export abstract class LocalTimeType extends LocalTimesType<Date> {
    static override readonly type = 'localTime'
    static override readonly customType = undefined
    static override readonly sqlDataType: SqlDataType = localTimeSqlDataType
    declare [typeName]: 'type:localTime:'
    declare [operandTypeName]: 'type:localTime:'
}

/** A date and a time of the day without a zone, a JavaScript Date */
export abstract class LocalDateTimeType extends LocalDateTimesType<Date> {
    static override readonly type = 'localDateTime'
    static override readonly customType = undefined
    static override readonly sqlDataType: SqlDataType = localDateTimeSqlDataType
    declare [typeName]: 'type:localDateTime:'
    declare [operandTypeName]: 'type:localDateTime:'
}
