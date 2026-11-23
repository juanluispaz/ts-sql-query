import type { DataTypeClass } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { NullableType } from './nullable.js'
import type { TypeClass } from './base.js'

// The classes of the data types known by name at run time. It imports no class: a base asks it, when one of its methods
// is called, for a data type that extends it (the boolean of a condition its comparisons give, the int of `sign`), so a
// class of the user that extends a base needs nothing more. registerDataTypes.ts fills it with the data types of the
// library, the same way the user registers its own ones (registerDataType); a name can be registered only once.

/** The class of each data type, by its type name: the built-in ones and the ones the user registers */
const dataTypes: { [name: string]: DataTypeClass | undefined } = Object.create(null)

/** The class of each data type only the run time knows, by a name of its own that is not a type name */
const internalDataTypes: { [name in InternalDataTypeName]?: DataTypeClass | undefined } = Object.create(null)

/** The data types only the run time knows: `condition`, the boolean of a condition */
type InternalDataTypeName = 'condition'

/**
 * Registers a data type of yours by the type name of its class (its `static type`), so a column, a constant, a fragment
 * or an argument can be given that name instead of the class; declare it in `DataTypes` too, so TypeScript knows it.
 * Registering the same class again does nothing; another class with a type name already registered (one of the
 * library, like `int`, too) is an error, as a class without a type name of its own.
 */
export function registerDataType<TYPE extends NullableType<any>>(dataType: TypeClass<TYPE>): void
export function registerDataType(dataType: DataTypeClass): void {
    const value: unknown = dataType
    if (typeof value !== 'function' || !Object.hasOwn(value, 'type') || typeof dataType.type !== 'string' || !dataType.type) {
        const className = typeof value === 'function' ? value.name : String(value)
        throw new TsSqlProcessingError({ reason: 'DATA_TYPE_WITHOUT_TYPE_NAME', className }, 'The data type ' + className + ' has no type name of its own (its static type) to register it by')
    }
    __registerDataType(dataType.type, dataType)
}

/** Registers the class of a data type by its type name; another class already registered with that name is an error */
export function __registerDataType(name: string, dataType: DataTypeClass): void {
    const registered = dataTypes[name]
    if (registered === dataType) {
        return
    }
    if (registered) {
        throw new TsSqlProcessingError({ reason: 'DATA_TYPE_ALREADY_REGISTERED', typeName: name }, 'Another data type is already registered with the type name ' + name)
    }
    dataTypes[name] = dataType
}

/**
 * The data types known by a name of a pattern, as the scaled bigints of every scale (`'ScaledBigInt<2>'`), given by the
 * module that registers the data types of the library: the class of the name, or undefined when it isn't one of them
 */
let dataTypeOfPatternName: ((name: string) => DataTypeClass | undefined) | undefined

/** Says how to find the data type of a name of a pattern (see dataTypeOfPatternName); only registerDataTypes calls it */
export function __registerDataTypeOfPatternName(resolver: (name: string) => DataTypeClass | undefined): void {
    dataTypeOfPatternName = resolver
}

/** The class of the data type registered with that type name; a name nobody registered is an error */
export function __registeredDataType(name: string): DataTypeClass {
    const result = dataTypes[name] ?? dataTypeOfPatternName?.(name)
    if (!result) {
        throw new TsSqlProcessingError({ reason: 'UNKNOWN_DATA_TYPE', typeName: name }, 'Unknown data type: ' + name + '; a data type of yours is given by its class, or by its type name once registered with registerDataType')
    }
    return result
}

/** Registers the class of a data type only the run time knows */
export function __registerInternalDataType(name: InternalDataTypeName, dataType: DataTypeClass): void {
    if (internalDataTypes[name]) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'illegal state' }, 'The internal data type ' + name + ' is already registered')
    }
    internalDataTypes[name] = dataType
}

/** The class of a data type only the run time knows */
export function __internalDataType(name: InternalDataTypeName): DataTypeClass {
    const result = internalDataTypes[name]
    if (!result) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unknown internal data type: ' + name)
    }
    return result
}
