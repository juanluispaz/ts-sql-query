import type { CustomTypeClass } from './base.js'
import { LocalDatesType, LocalDateTimesType, LocalTimesType } from './localDates.js'

/** The class `CustomLocalDateType.of` made for each type name */
const customLocalDateClasses = new Map<string, object>()

/** The class `CustomLocalTimeType.of` made for each type name */
const customLocalTimeClasses = new Map<string, object>()

/** The class `CustomLocalDateTimeType.of` made for each type name */
const customLocalDateTimeClasses = new Map<string, object>()

/** A date without a zone of a type of the user, of its type name */
export abstract class CustomLocalDateType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalDatesType<VALUE_TYPE, TYPE_NAME> {
    static override readonly customType = 'customLocalDate'

    /** The data type of a date without a zone of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomLocalDateType<VALUE_TYPE, TYPE_NAME>> {
        let result = customLocalDateClasses.get(typeName)
        if (!result) {
            abstract class CustomLocalDate extends CustomLocalDateType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomLocalDate
            customLocalDateClasses.set(typeName, result)
        }
        return result as unknown as CustomTypeClass<CustomLocalDateType<VALUE_TYPE, TYPE_NAME>>
    }
}

/** A time of the day without a zone of a type of the user, of its type name */
export abstract class CustomLocalTimeType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalTimesType<VALUE_TYPE, TYPE_NAME> {
    static override readonly customType = 'customLocalTime'

    /** The data type of a time of the day without a zone of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomLocalTimeType<VALUE_TYPE, TYPE_NAME>> {
        let result = customLocalTimeClasses.get(typeName)
        if (!result) {
            abstract class CustomLocalTime extends CustomLocalTimeType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomLocalTime
            customLocalTimeClasses.set(typeName, result)
        }
        return result as unknown as CustomTypeClass<CustomLocalTimeType<VALUE_TYPE, TYPE_NAME>>
    }
}

/** A date and a time of the day without a zone of a type of the user, of its type name */
export abstract class CustomLocalDateTimeType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends LocalDateTimesType<VALUE_TYPE, TYPE_NAME> {
    static override readonly customType = 'customLocalDateTime'

    /** The data type of a date and a time of the day without a zone of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomLocalDateTimeType<VALUE_TYPE, TYPE_NAME>> {
        let result = customLocalDateTimeClasses.get(typeName)
        if (!result) {
            abstract class CustomLocalDateTime extends CustomLocalDateTimeType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomLocalDateTime
            customLocalDateTimeClasses.set(typeName, result)
        }
        return result as unknown as CustomTypeClass<CustomLocalDateTimeType<VALUE_TYPE, TYPE_NAME>>
    }
}
