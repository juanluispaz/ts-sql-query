import type { DataTypeClass, TypeAdapter } from '../TypeAdapter.js'

// The type adapter of a value source is part of its class: a value source with a type adapter is an instance of a
// subclass of the class of its data type that carries the adapter. That subclass is created once for each class and
// adapter, and kept in the adapter, hidden (not enumerable, under a symbol), indexed by a small number given to each
// class the first time.

/** The type adapter of an adapted class */
export const typeAdapterOfClass: unique symbol = Symbol('typeAdapterOfClass')
/** The class an adapted class extends: the class of the data type without the adapter */
const unadaptedClass: unique symbol = Symbol('unadaptedClass')
/** The number given to a class of a data type, to index the subclasses kept in an adapter */
const classIdKey: unique symbol = Symbol('dataTypeClassId')
/** The subclasses an adapter made, by the number of the class they extend */
const adaptedClassesKey: unique symbol = Symbol('adaptedClasses')

let lastClassId = 0

interface AdaptableClass {
    [typeAdapterOfClass]?: TypeAdapter | undefined
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

/** The class of a value source of that data type with that type adapter (the class itself without an adapter) */
export function __adaptedTypeClassOf(typeClass: DataTypeClass, typeAdapter: TypeAdapter | undefined): DataTypeClass {
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
    const existing = classes?.[id]
    if (existing) {
        return existing
    }
    const adapted = createAdaptedClass(base, typeAdapter)
    if (!classes) {
        if (!Object.isExtensible(adapter)) {
            return adapted
        }
        classes = []
        Object.defineProperty(adapter, adaptedClassesKey, { value: classes })
    }
    classes[id] = adapted
    return adapted
}

function createAdaptedClass(base: DataTypeClass, typeAdapter: TypeAdapter): DataTypeClass {
    const adapted = class extends (base as unknown as abstract new () => object) {} as unknown as AdaptableClass
    Object.defineProperty(adapted, 'name', { value: (base as unknown as { name: string }).name })
    Object.defineProperty(adapted, typeAdapterOfClass, { value: typeAdapter })
    Object.defineProperty(adapted, unadaptedClass, { value: base })
    return adapted as unknown as DataTypeClass
}
