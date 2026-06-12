import type { PrimitiveValue, TerminalValue, TerminalValueObject, NonValueObject } from '../utils/objectUtils.js'
import type { OrderByMode } from '../expressions/select.js'

export type { OrderByMode }

/*
 * A dynamic order-by clause typed from a business model. This is the order-by counterpart
 * of `DynamicConditionForModel` (in `./dynamicCondition.ts`) — ordering is not a condition,
 * so it lives in its own module.
 *
 * `orderByFromString(...)` still takes a plain `string`; this type lets the caller OPT IN to
 * a stricter type for the order-by value they build, constraining it to the model's orderable
 * fields and the valid ordering modes (the resulting type is a `string` subtype, so it is
 * accepted as-is).
 *
 * `OrderByForModel<MODEL>` is a SINGLE clause — a field path, optionally followed by an
 * ordering mode (`'name'`, `'name asc'`, `'birthday desc nulls last'`, …). A multi-column
 * order-by is an array of clauses fed to `orderByFromStringArray(...)`:
 * `(['status insensitive', 'birthday asc'] satisfies OrderByForModel<M>[])`.
 *
 * Matching `orderByFromString`'s runtime, the orderable targets are the scalar LEAVES of
 * the model, addressed by their dotted path: a nested object inside a complex projection
 * contributes `'company.name'` (orderable) but NOT `'company'` (ordering by the object
 * itself is rejected at runtime). Array fields (aggregated arrays) and other non-scalar
 * values are not orderable. The leading `[T] extends [...]` guard gives the recursion a
 * base case so it terminates.
 */
type OrderableLeafPaths<MODEL> =
    [NonNullable<MODEL>] extends [TerminalValue]
    ? never
    : {
        [K in keyof NonNullable<MODEL> & string]:
            // A scalar value (primitive, Date, binary, …) is an orderable leaf; a non-value
            // object (array, Map/Set, …) is not orderable; a plain object recurses.
            NonNullable<NonNullable<MODEL>[K]> extends NonValueObject ? never
            : NonNullable<NonNullable<MODEL>[K]> extends PrimitiveValue | TerminalValueObject ? K
            : `${K}.${OrderableLeafPaths<NonNullable<NonNullable<MODEL>[K]>> & string}`
    }[keyof NonNullable<MODEL> & string]

export type OrderByForModel<MODEL> = `${OrderableLeafPaths<MODEL>}` | `${OrderableLeafPaths<MODEL>} ${OrderByMode}`
