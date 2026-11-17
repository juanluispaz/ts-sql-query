import type { typeName } from '../utils/symbols.js'

/**
 * The operations a class of a data type exposes to a dynamic filter: a static of the class, created with
 * `exposeFilterOperations`, that answers whether it exposes an operation; the instance declares its type, so the filter of
 * the data type knows its names
 */
export const filterOperation: unique symbol = Symbol('filterOperation')

/** The names of the operations a class (or an instance of it) exposes to a dynamic filter: the parameter of its function */
export type FilterOperationNamesOf<CLASS> = CLASS extends { [filterOperation]: (operation: infer NAME extends string) => boolean } ? NAME : never

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
 * of the class. It is called once, when the class is defined:
 *
 * ```ts
 * abstract class MoneyType extends IntegersType<Money, 'Money'> {
 *     static override readonly [filterOperation] = exposeFilterOperations(this, IntegersType, ['isPositive'])
 *     declare [filterOperation]: (typeof MoneyType)[typeof filterOperation]
 *     isPositive() { return this.greaterThan(0 as Money) }
 * }
 * ```
 */
export function exposeFilterOperations<CLASS extends { prototype: object }, FAMILY extends { [filterOperation]: (operation: never) => boolean } | undefined, const NAMES extends readonly ExposableNamesIn<CLASS['prototype']>[]>(_dataType: CLASS, family: FAMILY, names: NAMES): (operation: FilterOperationNamesOf<FAMILY> | NAMES[number]) => boolean {
    const own = new Set<string>(names)
    const familyExposes = family === undefined ? undefined : family[filterOperation] as (operation: string) => boolean
    if (familyExposes === undefined) {
        return (operation: string) => own.has(operation)
    }
    return (operation: string) => own.has(operation) || familyExposes(operation)
}
