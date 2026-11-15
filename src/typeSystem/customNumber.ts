import type { CustomTypeClass } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import type { intType } from '../utils/symbols.js'
import { IntegersType, RealsType } from './numeric.js'
import type { IntType } from './number.js'

/** An integer number of a type of the user, of its type name */
export abstract class CustomIntType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends IntegersType<VALUE_TYPE> {
    static override readonly customType = 'customInt'
    declare [intType]: IntType
    declare [typeName]: `type:${TYPE_NAME}:customInt:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customInt:`

    /** The data type of an integer number of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomIntType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomInt extends CustomIntType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomInt
    }
}

/** An integer number of 64 bits of a type of the user, of its type name */
export abstract class CustomBigintType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends IntegersType<VALUE_TYPE> {
    static override readonly customType = 'customBigint'
    declare [intType]: IntType
    declare [typeName]: `type:${TYPE_NAME}:customBigint:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customBigint:`

    /** The data type of an integer number of 64 bits of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomBigintType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomBigint extends CustomBigintType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomBigint
    }
}

/** A floating point number of a type of the user, of its type name */
export abstract class CustomDoubleType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends RealsType<VALUE_TYPE> {
    static override readonly customType = 'customDouble'
    declare [intType]: IntType
    declare [typeName]: `type:${TYPE_NAME}:customDouble:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customDouble:`

    /** The data type of a floating point number of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomDoubleType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomDouble extends CustomDoubleType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomDouble
    }
}
