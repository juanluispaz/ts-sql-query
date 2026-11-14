import { ComparableType } from './comparable.js'
import type { TypeClass } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/** The numbers of JavaScript, int and double, which work together: an operand of one can be the other */
export abstract class NumberType extends ComparableType<number> {
    declare [operandTypeName]: `type:${string}:number:`
}

/** An integer number, a JavaScript number */
export abstract class IntType extends NumberType {
    static override readonly __type = 'int'
    static override readonly __customType = undefined
    declare [typeName]: 'type:int:number:'
}

/** A floating point number, a JavaScript number */
export abstract class DoubleType extends NumberType {
    static override readonly __type = 'double'
    static override readonly __customType = undefined
    declare [typeName]: 'type:double:number:'
}

/** An integer number of a type of the user, of its type name */
export abstract class CustomIntType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE> {
    static override readonly __customType = 'customInt'
    declare [typeName]: `type:${TYPE_NAME}:customInt:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customInt:`

    /** The data type of an integer number of a type of the user, with its type name */
    static withTypeName<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): TypeClass<CustomIntType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomInt extends CustomIntType<VALUE_TYPE, TYPE_NAME> {
            static override readonly __type = typeName
        }
        return CustomInt
    }
}
