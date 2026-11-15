import type { CustomTypeClass } from './base.js'
import { EqualableType } from './equalable.js'
import type { BooleanType, IfType } from './logical.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import type { logicalTypes } from '../utils/symbols.js'

/** A value of an enumeration of the user, of its type name */
export abstract class EnumType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE> {
    static override readonly customType = 'enum'
    declare [logicalTypes]: { boolean: BooleanType, if: IfType }
    declare [typeName]: `type:${TYPE_NAME}:enum:`
    declare [operandTypeName]: `type:${TYPE_NAME}:enum:`

    /** The data type of a value of an enumeration of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<EnumType<VALUE_TYPE, TYPE_NAME>> {
        abstract class Enum extends EnumType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return Enum
    }
}
