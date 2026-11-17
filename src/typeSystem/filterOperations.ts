import type { typeName } from '../utils/symbols.js'

/**
 * The operations a class of a data type exposes to a dynamic filter: a static of the class, created with
 * `exposeFilterOperations`, that gives the method a name of a filter calls (the name itself, or the one an alias stands
 * for), or undefined when the class doesn't expose it; the instance declares its type, so the filter of the data type
 * knows its names
 */
export const filterOperation: unique symbol = Symbol('filterOperation')

/** The names of the operations a class (or an instance of it) exposes to a dynamic filter: the parameter of its function */
export type FilterOperationNamesOf<CLASS> = CLASS extends { [filterOperation]: (operation: infer NAME extends string) => unknown } ? NAME : never

/**
 * The names of the methods of an instance a dynamic filter can call: they give a condition (a value source of the group
 * logical) and have no parameters or one that is required. A method without parameters takes `true` (the condition) or
 * `false` (its negation); one with a parameter, the value of the filter
 */
type ExposableNamesIn<INSTANCE> = {
    [K in keyof INSTANCE & string]: INSTANCE[K] extends (value?: any) => { [typeName]: `type:${string}:logical:` }
        ? (INSTANCE[K] extends (...args: infer PARAMETERS) => any ? (PARAMETERS extends [] ? K : PARAMETERS extends [any] ? K : never) : never)
        : never
}[keyof INSTANCE & string]

/**
 * The operations a class of a data type exposes to a dynamic filter: the ones of its family and the names given, methods
 * of the class, and the aliases given, other names a filter can use for them that the types don't offer (a name an older
 * version used, kept for the systems that still send it). A name exposed by the class or its family wins over an alias.
 * It is called once, when the class is defined:
 *
 * ```ts
 * abstract class MoneyType extends IntegersType<Money, 'Money'> {
 *     static override readonly [filterOperation] = exposeFilterOperations(this, IntegersType, ['isPositive'], { positive: 'isPositive' })
 *     declare [filterOperation]: (typeof MoneyType)[typeof filterOperation]
 *     isPositive() { return this.greaterThan(0 as Money) }
 * }
 * ```
 */
export function exposeFilterOperations<CLASS extends { prototype: object }, FAMILY extends { [filterOperation]: (operation: never) => unknown } | undefined, const NAMES extends readonly ExposableNamesIn<CLASS['prototype']>[]>(_dataType: CLASS, family: FAMILY, names: NAMES, aliases?: { readonly [alias: string]: FilterOperationNamesOf<FAMILY> | NAMES[number] }): (operation: FilterOperationNamesOf<FAMILY> | NAMES[number]) => string | undefined {
    const methods = new Map<string, string>(family === undefined ? undefined : (family[filterOperation] as unknown as FilterOperationsOfClass)[filterOperationMethods])
    for (const name of names) {
        methods.set(name, name)
    }
    if (aliases !== undefined) {
        for (const alias in aliases) {
            if (methods.get(alias) !== alias) {
                methods.set(alias, aliases[alias]!)
            }
        }
    }
    const methodOf = (operation: string) => methods.get(operation)
    // The names of the class and its family with the method each one calls, for a class that extends it
    Object.defineProperty(methodOf, filterOperationMethods, { value: methods })
    return methodOf
}

/** The method each name of a filter calls, of a class and its family: kept on the function exposeFilterOperations gives */
const filterOperationMethods: unique symbol = Symbol('filterOperationMethods')

/** The function exposeFilterOperations gives, as a class that extends the class asks it for its names */
interface FilterOperationsOfClass {
    [filterOperationMethods]: ReadonlyMap<string, string>
}
