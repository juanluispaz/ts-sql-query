import type { CustomTypeClass } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { ComparableType } from './comparable.js'

/** A value of a type of the user that has an order, of its type name */
export abstract class CustomComparableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE> {
    static override readonly customType = 'customComparable'
    declare [typeName]: `type:${TYPE_NAME}:customComparable:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customComparable:`

    /** The data type of a value of a type of the user that has an order, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomComparableType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomComparable extends CustomComparableType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomComparable
    }
}
