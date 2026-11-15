import type { CustomTypeClass } from './base.js'
import { EqualableType } from './equalable.js'
import { operandTypeName, typeName, logicalTypes } from '../utils/symbols.js'
import { BooleanConditionType, BooleanType } from './logical.js'

/** The class `CustomEqualableType.of` made for each type name */
const customEqualableClasses = new Map<string, CustomTypeClass<CustomEqualableType<any, any>>>()

/** A value of a type of the user that can only be compared for equality, of its type name */
export abstract class CustomEqualableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE> {
    /** The boolean and the condition the comparisons give (the classes of the bases can't import them) */
    static readonly [logicalTypes] = { boolean: BooleanType, condition: BooleanConditionType }
    static override readonly customType = 'custom'
    declare [typeName]: `type:${TYPE_NAME}:custom:`
    declare [operandTypeName]: `type:${TYPE_NAME}:custom:`

    /** The data type of a value of a type of the user that can only be compared for equality, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomEqualableType<VALUE_TYPE, TYPE_NAME>> {
        let result = customEqualableClasses.get(typeName)
        if (!result) {
            abstract class CustomEqualable extends CustomEqualableType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomEqualable
            customEqualableClasses.set(typeName, result)
        }
        return result as CustomTypeClass<CustomEqualableType<VALUE_TYPE, TYPE_NAME>>
    }
}
