import type { CustomType, DataTypeClass } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __sameTypeClassOf } from '../nodes/dataTypeClassOf.js'
import type { __ValueSourcePrivate } from './valueSource.js'
import { __registeredCustomDataTypeFamily, __registeredDataType } from './dataTypeRegistry.js'

// The class of the data type a value source is created from, by the names the library knows a data type by at run time:
// the type, and the custom type of a custom data type, as the registry has them (dataTypeRegistry.ts).

/** The class a method that takes a data type gets: the class itself, or the class of a built-in data type by its name */
export function __dataTypeClassFrom(type: string | DataTypeClass): DataTypeClass {
    return typeof type === 'string' ? __dataTypeClassOf(type, undefined) : type
}

/**
 * The class of the data type of a value source as a select projects it, for a value source that is a projected column
 * (a column of a `with` or of a compound select, a select used as a value): its class (the text of a uuid is still the
 * uuid), but the boolean of a condition is projected as a boolean value
 */
export function __projectedTypeClassOf(valueSource: __ValueSourcePrivate): DataTypeClass {
    const typeClass = __sameTypeClassOf(valueSource)
    return typeClass === __registeredDataType('condition') ? __registeredDataType('boolean') : typeClass
}

/** The class of the data type of a type and a custom type */
export function __dataTypeClassOf(type: string, customType: CustomType | undefined): DataTypeClass {
    if (customType === undefined) {
        return __registeredDataType(type)
    }
    const family = __registeredCustomDataTypeFamily(customType)
    if (!family) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unknown data type: ' + type + ' of ' + customType)
    }
    return family.of(type)
}
