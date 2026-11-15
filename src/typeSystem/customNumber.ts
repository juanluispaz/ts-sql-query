import type { SqlDataType } from '../TypeAdapter.js'
import { intSqlDataType, doubleSqlDataType } from './number.js'
import { bigintSqlDataType } from './bigint.js'
import type { CustomTypeClass } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { IntegersType, RealsType } from './numeric.js'

/** The class `CustomIntType.of` made for each type name */
const customIntClasses = new Map<string, CustomTypeClass<CustomIntType<any, any>>>()

/** The class `CustomBigintType.of` made for each type name */
const customBigintClasses = new Map<string, CustomTypeClass<CustomBigintType<any, any>>>()

/** The class `CustomDoubleType.of` made for each type name */
const customDoubleClasses = new Map<string, CustomTypeClass<CustomDoubleType<any, any>>>()

/** An integer number of a type of the user, of its type name */
export abstract class CustomIntType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends IntegersType<VALUE_TYPE> {
    static override readonly customType = 'customInt'
    static override readonly sqlDataType: SqlDataType = intSqlDataType
    declare [typeName]: `type:${TYPE_NAME}:customInt:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customInt:`

    /** The data type of an integer number of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomIntType<VALUE_TYPE, TYPE_NAME>> {
        let result = customIntClasses.get(typeName)
        if (!result) {
            abstract class CustomInt extends CustomIntType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomInt
            customIntClasses.set(typeName, result)
        }
        return result as CustomTypeClass<CustomIntType<VALUE_TYPE, TYPE_NAME>>
    }
}

/** An integer number of 64 bits of a type of the user, of its type name */
export abstract class CustomBigintType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends IntegersType<VALUE_TYPE> {
    static override readonly customType = 'customBigint'
    static override readonly sqlDataType: SqlDataType = bigintSqlDataType
    declare [typeName]: `type:${TYPE_NAME}:customBigint:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customBigint:`

    /** The data type of an integer number of 64 bits of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomBigintType<VALUE_TYPE, TYPE_NAME>> {
        let result = customBigintClasses.get(typeName)
        if (!result) {
            abstract class CustomBigint extends CustomBigintType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomBigint
            customBigintClasses.set(typeName, result)
        }
        return result as CustomTypeClass<CustomBigintType<VALUE_TYPE, TYPE_NAME>>
    }
}

/** A floating point number of a type of the user, of its type name */
export abstract class CustomDoubleType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends RealsType<VALUE_TYPE> {
    static override readonly customType = 'customDouble'
    static override readonly sqlDataType: SqlDataType = doubleSqlDataType
    declare [typeName]: `type:${TYPE_NAME}:customDouble:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customDouble:`

    /** The data type of a floating point number of a type of the user, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomDoubleType<VALUE_TYPE, TYPE_NAME>> {
        let result = customDoubleClasses.get(typeName)
        if (!result) {
            abstract class CustomDouble extends CustomDoubleType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomDouble
            customDoubleClasses.set(typeName, result)
        }
        return result as CustomTypeClass<CustomDoubleType<VALUE_TYPE, TYPE_NAME>>
    }
}
