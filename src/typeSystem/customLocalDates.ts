import type { CustomTypeClass } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { LocalDatesType, LocalDateTimesType, LocalTimesType } from './localDates.js'

/** A date without a zone of a type of the user, of its type name */
export abstract class CustomLocalDateType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalDatesType<VALUE_TYPE> {
    static override readonly customType = 'customLocalDate'
    declare [typeName]: `type:${TYPE_NAME}:customLocalDate:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customLocalDate:`

    /** The data type of a date without a zone of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomLocalDateType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomLocalDate extends CustomLocalDateType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomLocalDate
    }
}

/** A time of the day without a zone of a type of the user, of its type name */
export abstract class CustomLocalTimeType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalTimesType<VALUE_TYPE> {
    static override readonly customType = 'customLocalTime'
    declare [typeName]: `type:${TYPE_NAME}:customLocalTime:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customLocalTime:`

    /** The data type of a time of the day without a zone of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomLocalTimeType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomLocalTime extends CustomLocalTimeType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomLocalTime
    }
}

/** A date and a time of the day without a zone of a type of the user, of its type name */
export abstract class CustomLocalDateTimeType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalDateTimesType<VALUE_TYPE> {
    static override readonly customType = 'customLocalDateTime'
    declare [typeName]: `type:${TYPE_NAME}:customLocalDateTime:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customLocalDateTime:`

    /** The data type of a date and a time of the day without a zone of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomLocalDateTimeType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomLocalDateTime extends CustomLocalDateTimeType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomLocalDateTime
    }
}
