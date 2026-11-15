import type { CustomTypeClass } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { UuidsType } from './uuids.js'

/** A uuid of a type of the user, of its type name */
export abstract class CustomUuidType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends UuidsType<VALUE_TYPE> {
    static override readonly customType = 'customUuid'
    declare [typeName]: `type:${TYPE_NAME}:customUuid:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customUuid:`

    /** The data type of a uuid of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomUuidType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomUuid extends CustomUuidType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomUuid
    }
}
