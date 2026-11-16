import type { CustomTypeClass } from './base.js'
import { UuidsType } from './uuids.js'

/** The class `CustomUuidType.of` made for each type name */
const customUuidClasses = new Map<string, object>()

/** A uuid of a type of the user, of its type name */
export abstract class CustomUuidType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends UuidsType<VALUE_TYPE, TYPE_NAME> {
    static override readonly customType = 'customUuid'

    /** The data type of a uuid of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomUuidType<VALUE_TYPE, TYPE_NAME>> {
        let result = customUuidClasses.get(typeName)
        if (!result) {
            abstract class CustomUuid extends CustomUuidType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomUuid
            customUuidClasses.set(typeName, result)
        }
        return result as unknown as CustomTypeClass<CustomUuidType<VALUE_TYPE, TYPE_NAME>>
    }
}
