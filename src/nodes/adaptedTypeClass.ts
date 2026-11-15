import type { DataTypeClass, SqlDataType, TypeAdapter } from '../TypeAdapter.js'
import { __typeSqlDataTypeOf } from '../typeSystem/dataTypes.js'

// The type adapter of a value source is part of its class: a value source with a type adapter is an instance of a
// subclass of the class of its data type that carries the adapter. That subclass is created once for each class and
// adapter, and kept in the adapter, hidden (not enumerable, under a symbol), indexed by a small number given to each
// class the first time.

/** The type adapter of an adapted class */
export const typeAdapterOfClass: unique symbol = Symbol('typeAdapterOfClass')
/** Whether an adapted class says the SQL data type of its adapter (a computed value has only its conversions) */
const keepsSqlDataType: unique symbol = Symbol('keepsSqlDataType')
/** The class an adapted class extends: the class of the data type without the adapter */
const unadaptedClass: unique symbol = Symbol('unadaptedClass')
/** The number given to a class of a data type, to index the subclasses kept in an adapter */
const classIdKey: unique symbol = Symbol('dataTypeClassId')
/** The subclasses an adapter made, by the number of the class they extend */
const adaptedClassesKey: unique symbol = Symbol('adaptedClasses')

let lastClassId = 0

interface AdaptableClass {
    [typeAdapterOfClass]?: TypeAdapter | undefined
    [keepsSqlDataType]?: boolean | undefined
    [unadaptedClass]?: DataTypeClass | undefined
    [classIdKey]?: number | undefined
}

interface AdapterWithClasses {
    [adaptedClassesKey]?: Array<DataTypeClass | undefined> | undefined
}

/** The class of the data type without its type adapter */
export function __unadaptedClassOf(typeClass: DataTypeClass): DataTypeClass {
    return (typeClass as AdaptableClass)[unadaptedClass] ?? typeClass
}

/**
 * The class of a value source of that data type with that type adapter (the class itself without an adapter). With
 * `withSqlDataType` false, the class has the conversions of the adapter but not its SQL data type: a value computed
 * from a column is not a value of that column
 */
export function __adaptedTypeClassOf(typeClass: DataTypeClass, typeAdapter: TypeAdapter | undefined, withSqlDataType: boolean = true): DataTypeClass {
    const base = __unadaptedClassOf(typeClass)
    if (!typeAdapter) {
        return base
    }
    const baseClass = base as AdaptableClass
    // Own property: a class inherits the statics of the class it extends
    let id = Object.hasOwn(baseClass, classIdKey) ? baseClass[classIdKey]! : undefined
    if (id === undefined) {
        id = ++lastClassId
        Object.defineProperty(baseClass, classIdKey, { value: id })
    }
    const adapter = typeAdapter as AdapterWithClasses
    let classes = adapter[adaptedClassesKey]
    // Two classes for each class and adapter: with the SQL data type of the adapter, and without it
    const index = withSqlDataType ? id * 2 : id * 2 + 1
    const existing = classes?.[index]
    if (existing) {
        return existing
    }
    const adapted = createAdaptedClass(base, typeAdapter, withSqlDataType)
    if (!classes) {
        if (!Object.isExtensible(adapter)) {
            return adapted
        }
        classes = []
        Object.defineProperty(adapter, adaptedClassesKey, { value: classes })
    }
    classes[index] = adapted
    return adapted
}

function createAdaptedClass(base: DataTypeClass, typeAdapter: TypeAdapter, withSqlDataType: boolean): DataTypeClass {
    // It only carries the adapter: the chain of the conversions applies it (NextTypeAdapter)
    const Base = base as unknown as abstract new () => object
    const adapted = class extends Base {} as unknown as AdaptableClass
    Object.defineProperty(adapted, 'name', { value: (base as unknown as { name: string }).name })
    Object.defineProperty(adapted, typeAdapterOfClass, { value: typeAdapter })
    Object.defineProperty(adapted, unadaptedClass, { value: base })
    Object.defineProperty(adapted, keepsSqlDataType, { value: withSqlDataType })
    return adapted as unknown as DataTypeClass
}

/** The class of a value source: the one of its data type, with its type adapter */
export function __classOf(valueSource: object): DataTypeClass {
    return valueSource.constructor as unknown as DataTypeClass
}

/** The type adapter of a class of a data type, if it has one */
export function __typeAdapterOf(typeClass: DataTypeClass): TypeAdapter | undefined {
    return (typeClass as AdaptableClass)[typeAdapterOfClass]
}

/** The SQL data type a class of a data type says: the one of its type adapter, unless it is a computed value */
export function __sqlDataTypeOf(typeClass: DataTypeClass): SqlDataType | undefined {
    const adaptable = typeClass as AdaptableClass
    return adaptable[keepsSqlDataType] ? adaptable[typeAdapterOfClass]?.sqlDataType : undefined
}

/**
 * The SQL data type of a value of a class of a data type: the one its type adapter says, unless it is a computed value,
 * or the default of its data type
 */
export function __valueSqlDataTypeOf(typeClass: DataTypeClass): SqlDataType | undefined {
    return __sqlDataTypeOf(typeClass) ?? __typeSqlDataTypeOf(__unadaptedClassOf(typeClass))
}

/**
 * The class of a value whose value is the one of the value source given, in the data type given (nullIfValue,
 * valueWhenNull, max, a no-op, ...): its type adapter as it has it, with its SQL data type if it has it
 */
export function __keptClassOf(valueSource: object, typeClass: DataTypeClass): DataTypeClass {
    const adaptable = valueSource.constructor as AdaptableClass
    return __adaptedTypeClassOf(typeClass, adaptable[typeAdapterOfClass], adaptable[keepsSqlDataType] ?? true)
}

/**
 * The class of a value computed from the value source given, of the same data type (add, concat, sum, ...): the
 * conversions of its type adapter, without its SQL data type
 */
export function __computedClassOf(valueSource: object, typeClass: DataTypeClass): DataTypeClass {
    return __adaptedTypeClassOf(typeClass, (valueSource.constructor as AdaptableClass)[typeAdapterOfClass], false)
}
