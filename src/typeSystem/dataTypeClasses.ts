import type { DataTypeClass } from '../TypeAdapter.js'
import { arithmeticOperandClass, valueOperandClass } from '../utils/symbols.js'
import { __sameTypeClassOf } from '../nodes/dataTypeClassOf.js'
import { __internalDataType, __registeredDataType } from './dataTypeRegistry.js'
import { __unadaptedClassOf } from '../nodes/adaptedTypeClass.js'
import { type NodeValueSource } from '../nodes/NodeStrategy.js'

// The class of the data type a value source is created from (a built-in one by its name, as the registry has it,
// dataTypeRegistry.ts), and the class a value given to one of its operations is sent with.

/** The class a method that takes a data type gets: the class itself, or the class of a built-in data type by its name */
export function __dataTypeClassFrom(type: string | DataTypeClass): DataTypeClass {
    return typeof type === 'string' ? __registeredDataType(type) : type
}

/**
 * The class of the data type of a value source as a select projects it, for a value source that is a projected column
 * (a column of a `with` or of a compound select, a select used as a value): its class (the text of a uuid is still the
 * uuid), but the boolean of a condition is projected as a boolean value
 */
export function __projectedTypeClassOf(valueSource: NodeValueSource): DataTypeClass {
    const typeClass = __sameTypeClassOf(valueSource)
    return typeClass === __internalDataType('condition') ? __registeredDataType('boolean') : typeClass
}

/** The data type class with the operand class hooks (statics of the class, see symbols.ts) */
interface OperandClassHooks {
    [valueOperandClass]?: (value: unknown) => DataTypeClass | undefined
    [arithmeticOperandClass]?: (value: unknown) => DataTypeClass | undefined
}

/**
 * The class a value of the data type given to an operation (`equals`, `in`, `between`, `valueWhenNull`, ...) is sent
 * with: the class given, with its type adapter (a value compared with a column takes the SQL data type of the column),
 * unless the data type says another one for that value (a fraction compared with an int is a double)
 */
export function __valueOperandClassOf(typeClass: DataTypeClass, value: unknown): DataTypeClass {
    const hooks = __unadaptedClassOf(typeClass) as unknown as OperandClassHooks
    return hooks[valueOperandClass]?.(value) ?? typeClass
}

/**
 * The class a value given to an arithmetic operation (`add`, `minValue`, `power`, the decimals of `roundn`, ...) is
 * sent with: the class given, with its type adapter, unless the data type says another one for that value (a number of
 * JavaScript given to an exact decimal is an int or a double)
 */
export function __arithmeticOperandClassOf(typeClass: DataTypeClass, value: unknown): DataTypeClass {
    const hooks = __unadaptedClassOf(typeClass) as unknown as OperandClassHooks
    return hooks[arithmeticOperandClass]?.(value) ?? typeClass
}
