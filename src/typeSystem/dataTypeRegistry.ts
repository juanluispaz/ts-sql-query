import type { CustomType, DataTypeClass } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

// The classes of the data types the library knows by name at run time. It imports no class: a base asks it, when one of
// its methods is called, for a data type that extends it (the boolean of a condition its comparisons give, the int of
// `sign`), so a class of the user that extends a base needs nothing more. registerDataTypes.ts fills it with the data
// types of the library, the same way as any other one; a name can be registered only once.

/** A family of custom data types: its `of` gives the class of each type name */
export interface CustomDataTypeFamily {
    of(typeName: string): DataTypeClass
}

/** The class of each data type, by its name: the built-in ones, and `condition`, the boolean of a condition */
const dataTypes: { [name: string]: DataTypeClass | undefined } = Object.create(null)
/** The family of each custom type */
const customDataTypeFamilies: { [customType: string]: CustomDataTypeFamily | undefined } = Object.create(null)

/** Registers the class of a data type by its name; a name already registered is an error */
export function __registerDataType(name: string, dataType: DataTypeClass): void {
    if (dataTypes[name]) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'illegal state' }, 'The data type ' + name + ' is already registered')
    }
    dataTypes[name] = dataType
}

/** Registers a family of custom data types by its custom type; a custom type already registered is an error */
export function __registerCustomDataTypeFamily(customType: CustomType, family: CustomDataTypeFamily): void {
    if (customDataTypeFamilies[customType]) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'illegal state' }, 'The custom data type family ' + customType + ' is already registered')
    }
    customDataTypeFamilies[customType] = family
}

/** The class of the data type registered with that name */
export function __registeredDataType(name: string): DataTypeClass {
    const result = dataTypes[name]
    if (!result) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unknown data type: ' + name)
    }
    return result
}

/** The family of custom data types registered with that custom type, if any */
export function __registeredCustomDataTypeFamily(customType: CustomType): CustomDataTypeFamily | undefined {
    return customDataTypeFamilies[customType]
}
