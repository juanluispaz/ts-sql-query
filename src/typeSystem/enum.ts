import type { CustomTypeClass } from './base.js'
import { EqualableType } from './equalable.js'

/** The class `EnumType.of` made for each type name */
const enumClasses = new Map<string, object>()

/**
 * A value of an enumeration of the user, of its type name: the library converts nothing and gives it no SQL data type.
 * A data type of the user extends it with its type name:
 * `class StatusType extends EnumType<Status, 'Status'> { static override readonly type = 'Status' }`
 */
export abstract class EnumType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly customType = 'enum'

    /** The data type of a value of an enumeration of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<EnumType<VALUE_TYPE, TYPE_NAME>> {
        let result = enumClasses.get(typeName)
        if (!result) {
            abstract class Enum extends EnumType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = Enum
            enumClasses.set(typeName, result)
        }
        return result as unknown as CustomTypeClass<EnumType<VALUE_TYPE, TYPE_NAME>>
    }
}
