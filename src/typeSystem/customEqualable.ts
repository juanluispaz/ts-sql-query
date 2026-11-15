import type { CustomTypeClass } from './base.js'
import { EqualableType } from './equalable.js'
import type { BooleanType, IfType } from './logical.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import type { logicalTypes } from '../utils/symbols.js'

/** A value of a type of the user that can only be compared for equality, of its type name */
export abstract class CustomEqualableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE> {
    static override readonly customType = 'custom'
    declare [logicalTypes]: { boolean: BooleanType, if: IfType }
    declare [typeName]: `type:${TYPE_NAME}:custom:`
    declare [operandTypeName]: `type:${TYPE_NAME}:custom:`

    /** The data type of a value of a type of the user that can only be compared for equality, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomEqualableType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomEqualable extends CustomEqualableType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomEqualable
    }
}
