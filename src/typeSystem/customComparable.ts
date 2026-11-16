import type { CustomTypeClass } from './base.js'
import { ComparableType } from './comparable.js'

/** The class `CustomComparableType.of` made for each type name */
const customComparableClasses = new Map<string, object>()

/** A value of a type of the user that has an order, of its type name */
export abstract class CustomComparableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly customType = 'customComparable'

    /** The data type of a value of a type of the user that has an order, with its type name; the same class each time for the same type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomComparableType<VALUE_TYPE, TYPE_NAME>> {
        let result = customComparableClasses.get(typeName)
        if (!result) {
            abstract class CustomComparable extends CustomComparableType<VALUE_TYPE, TYPE_NAME> {
                static override readonly type = typeName
            }
            result = CustomComparable
            customComparableClasses.set(typeName, result)
        }
        return result as unknown as CustomTypeClass<CustomComparableType<VALUE_TYPE, TYPE_NAME>>
    }
}
