import type { CustomTypeClass } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { DecimalsType } from './decimals.js'

/** The class `CustomDecimalType.of` made for each type name */
const customDecimalClasses = new Map<string, CustomTypeClass<CustomDecimalType<any, any>>>()

/** An exact decimal number of a type of the user, of its type name */
export abstract class CustomDecimalType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends DecimalsType<VALUE_TYPE> {
    static override readonly customType = 'customDecimal'
    declare [typeName]: `type:${TYPE_NAME}:customDecimal:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customDecimal:`

    /** The data type of an exact decimal number of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomDecimalType<VALUE_TYPE, TYPE_NAME>> {
        let result = customDecimalClasses.get(typeName)
        if (!result) {
            abstract class CustomDecimal extends CustomDecimalType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomDecimal
            customDecimalClasses.set(typeName, result)
        }
        return result as CustomTypeClass<CustomDecimalType<VALUE_TYPE, TYPE_NAME>>
    }
}
