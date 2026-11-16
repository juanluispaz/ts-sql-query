import type { DataTypeClass } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

// The classes of the data types the library knows by name at run time. It imports no class: a base asks it, when one of
// its methods is called, for a data type that extends it (the boolean of a condition its comparisons give, the int of
// `sign`), so a class of the user that extends a base needs nothing more. registerDataTypes.ts fills it with the data
// types of the library, the same way as any other one; a name can be registered only once.

/** The class of each data type, by its name: the built-in ones, and `condition`, the boolean of a condition */
const dataTypes: { [name: string]: DataTypeClass | undefined } = Object.create(null)

/** Registers the class of a data type by its name; a name already registered is an error */
export function __registerDataType(name: string, dataType: DataTypeClass): void {
    if (dataTypes[name]) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'illegal state' }, 'The data type ' + name + ' is already registered')
    }
    dataTypes[name] = dataType
}

/** The class of the data type registered with that name */
export function __registeredDataType(name: string): DataTypeClass {
    const result = dataTypes[name]
    if (!result) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unknown data type: ' + name)
    }
    return result
}
