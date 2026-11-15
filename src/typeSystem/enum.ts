import type { CustomTypeClass } from './base.js'
import { EqualableType } from './equalable.js'
import { operandTypeName, typeName, logicalTypes } from '../utils/symbols.js'
import { BooleanConditionType, BooleanType } from './logical.js'

/** The class `EnumType.of` made for each type name */
const enumClasses = new Map<string, CustomTypeClass<EnumType<any, any>>>()

/** A value of an enumeration of the user, of its type name */
export abstract class EnumType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE> {
    /** The boolean and the condition the comparisons give (the classes of the bases can't import them) */
    static readonly [logicalTypes] = { boolean: BooleanType, condition: BooleanConditionType }
    static override readonly customType = 'enum'
    declare [typeName]: `type:${TYPE_NAME}:enum:`
    declare [operandTypeName]: `type:${TYPE_NAME}:enum:`

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
        return result as CustomTypeClass<EnumType<VALUE_TYPE, TYPE_NAME>>
    }
}
