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
 * order-by is an array of clauses, joined for `orderByFromString(...)`:
 * `orderByFromString(orderBy.join(', '))`, with `orderBy: OrderByForModel<M>[]`.
 *
 * Matching `orderByFromString`'s runtime, the orderable targets are the scalar LEAVES of
 * the model, addressed by their dotted path: a nested object inside a complex projection
 * contributes `'company.name'` (orderable) but NOT `'company'` (ordering by the object
 * itself is rejected at runtime). Array fields (aggregated arrays) and other non-scalar
 * values are not orderable.
 *
 * The paths are built level by level, with no recursion, up to 5 levels deep, the deepest
 * nesting of a complex projection (`'a.b.c.d.e'`); a leaf deeper than that isn't offered.
 */
// The type of a property, without null and undefined
type PropertyOf<MODEL, K extends keyof NonNullable<MODEL>> = NonNullable<NonNullable<MODEL>[K]>
// The orderable leaves of MODEL, and the dotted path of the leaves of each nested object one level deeper
type OrderableLeafPaths<MODEL> = OrderableLeafPaths1<MODEL>
type OrderableLeafPaths1<MODEL> =
    [NonNullable<MODEL>] extends [TerminalValue] ? never : {
        [K in keyof NonNullable<MODEL> & string]:
            PropertyOf<MODEL, K> extends NonValueObject ? never
            : PropertyOf<MODEL, K> extends PrimitiveValue | TerminalValueObject ? K
            : `${K}.${OrderableLeafPaths2<PropertyOf<MODEL, K>> & string}`
    }[keyof NonNullable<MODEL> & string]
type OrderableLeafPaths2<MODEL> =
    [NonNullable<MODEL>] extends [TerminalValue] ? never : {
        [K in keyof NonNullable<MODEL> & string]:
            PropertyOf<MODEL, K> extends NonValueObject ? never
            : PropertyOf<MODEL, K> extends PrimitiveValue | TerminalValueObject ? K
            : `${K}.${OrderableLeafPaths3<PropertyOf<MODEL, K>> & string}`
    }[keyof NonNullable<MODEL> & string]
type OrderableLeafPaths3<MODEL> =
    [NonNullable<MODEL>] extends [TerminalValue] ? never : {
        [K in keyof NonNullable<MODEL> & string]:
            PropertyOf<MODEL, K> extends NonValueObject ? never
            : PropertyOf<MODEL, K> extends PrimitiveValue | TerminalValueObject ? K
            : `${K}.${OrderableLeafPaths4<PropertyOf<MODEL, K>> & string}`
    }[keyof NonNullable<MODEL> & string]
type OrderableLeafPaths4<MODEL> =
    [NonNullable<MODEL>] extends [TerminalValue] ? never : {
        [K in keyof NonNullable<MODEL> & string]:
            PropertyOf<MODEL, K> extends NonValueObject ? never
            : PropertyOf<MODEL, K> extends PrimitiveValue | TerminalValueObject ? K
            : `${K}.${OrderableLeafPaths5<PropertyOf<MODEL, K>> & string}`
    }[keyof NonNullable<MODEL> & string]
// The last level: only its leaves, a nested object here is too deep
type OrderableLeafPaths5<MODEL> =
    [NonNullable<MODEL>] extends [TerminalValue] ? never : {
        [K in keyof NonNullable<MODEL> & string]:
            PropertyOf<MODEL, K> extends NonValueObject ? never
            : PropertyOf<MODEL, K> extends PrimitiveValue | TerminalValueObject ? K
            : never
    }[keyof NonNullable<MODEL> & string]

export type OrderByForModel<MODEL> = `${OrderableLeafPaths<MODEL>}` | `${OrderableLeafPaths<MODEL>} ${OrderByMode}`
