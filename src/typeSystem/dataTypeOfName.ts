import { TsSqlProcessingError } from '../TsSqlError.js'
import { ofStatics, typesOfName } from '../utils/symbols.js'

/*
 * The data types `of` makes: a class that extends the family `of` is called on, with the type name given and the
 * statics the family gives for its options (EnumType: the values; ScaledBigIntsType: the SQL data type of its scale).
 * It is made once for each type name on each family, kept on the family itself, so a type of a specific use written in
 * several places is one data type; another call with the same type name and other options is an error, as is a call on
 * a data type (a class with a type name of its own, like IntType or a class of the user), which is no family.
 */

/** The statics a family gives the class `of` makes for the options given, by their names */
export type OfStatics = { readonly [name: string]: unknown }

/** A family as `of` sees it: a class that may say the statics of its options and keeps the classes made on it */
interface OfFamily {
    readonly name: string
    readonly type: string
    [ofStatics](options: readonly unknown[]): OfStatics | undefined
    [typesOfName]?: { [typeName: string]: Function | undefined }
}

/** The class of the data type of that type name on that family, made the first time */
export function __dataTypeOfName(family: OfFamily, typeName: unknown, options: readonly unknown[]): Function {
    if (Object.hasOwn(family, 'type')) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'of', value: family.type }, 'of makes a data type of a family; ' + family.type + ' is already a data type')
    }
    if (typeof typeName !== 'string' || !typeName) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'typeName', value: typeName }, 'Invalid type name of a data type of ' + family.name + ': ' + String(typeName))
    }
    const statics = family[ofStatics](options)
    let types = Object.hasOwn(family, typesOfName) ? family[typesOfName] : undefined
    if (!types) {
        types = Object.create(null) as { [typeName: string]: Function | undefined }
        Object.defineProperty(family, typesOfName, { value: types })
    }
    const made = types[typeName]
    if (made) {
        if (!sameStatics(made, statics)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'typeName', value: typeName }, 'Another data type of ' + family.name + ' was made with the type name ' + typeName + ' and other options')
        }
        return made
    }
    const base = family as unknown as abstract new () => object
    const type: string = typeName
    abstract class DataTypeOfName extends base {
        static readonly type: string = type
    }
    if (statics) {
        for (const name in statics) {
            Object.defineProperty(DataTypeOfName, name, { value: statics[name], enumerable: true })
        }
    }
    types[typeName] = DataTypeOfName
    return DataTypeOfName
}

/** Whether the class made has the statics given: the same values, or arrays and objects of the same values */
function sameStatics(made: Function, statics: OfStatics | undefined): boolean {
    if (!statics) {
        return true
    }
    for (const name in statics) {
        if (!sameValue((made as unknown as OfStatics)[name], statics[name])) {
            return false
        }
    }
    return true
}

/** Whether two values of a static are the same: equal, or arrays or plain objects of equal values */
function sameValue(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((value, index) => value === b[index])
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const keysOfA = Object.keys(a)
        const keysOfB = Object.keys(b)
        return keysOfA.length === keysOfB.length && keysOfA.every(key => (a as OfStatics)[key] === (b as OfStatics)[key])
    }
    return false
}
