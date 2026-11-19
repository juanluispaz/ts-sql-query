import type { TemporalPlainDate, TemporalPlainDateTime, TemporalPlainTime } from '../typeSystem/temporal.js'
import type { TerminalValueObject, NonValueObject } from '../utils/objectUtils.js'
import type { DynamicCondition, DynamicConditionExtension } from '../expressions/dynamicConditionUsingFilters.js'
import type { ComparableType } from '../typeSystem/comparable.js'
import type { EnumType } from '../typeSystem/enum.js'

export type { DynamicCondition }

/*
 * Building a dynamic condition from a business model (instead of from the value-source
 * map or a hand-written descriptor map).
 *
 * `DynamicDefinitionForModel<MODEL>` maps a plain business interface to the descriptor
 * map that `DynamicCondition` already understands (`number` → `'int'`, `string` →
 * `'string'`, a string/number literal union → `EnumType<…, string>`, `Date` → date filter, a
 * nested plain object → recurse). `DynamicConditionForModel<MODEL>` then feeds that to
 * `DynamicCondition`, so the produced filter is — by construction — the same shape
 * `dynamicConditionFor(columns).withValues(...)` expects, with no value-source type
 * leaking into the public signature.
 *
 * The type says nothing about how the column is defined. A branded string or number is
 * a type of the user, and which one can't be known here: `ComparableType` has the operators
 * that fit all of them, and it keeps the brand in the values. Non-filterable object values
 * (arrays, Map/Set, binary, …) map to `never`. For those, or for the exact filter of a
 * column, build the definition with the descriptor map directly.
 */
// A brand adds keys that the base type doesn't have, and a union of literals doesn't.
type IsBrandOf<T, BASE> = [Exclude<keyof T, keyof BASE>] extends [never] ? false : true

// The descriptor of a scalar value of the model; never for anything else
type DynamicDefinitionLeafForModel<T> =
    [T] extends [boolean] ? 'boolean' :
    [T] extends [bigint] ? 'bigint' :
    [T] extends [number] ? ([number] extends [T] ? 'int' : IsBrandOf<T, number> extends true ? ComparableType<T, string> : EnumType<T, string>) :
    [T] extends [string] ? ([string] extends [T] ? 'string' : IsBrandOf<T, string> extends true ? ComparableType<T, string> : EnumType<T, string>) :
    [T] extends [Date] ? 'localDateTime' :
    [T] extends [TemporalPlainDate] ? 'plainDate' :
    [T] extends [TemporalPlainTime] ? 'plainTime' :
    [T] extends [TemporalPlainDateTime] ? 'plainDateTime' :
    never

// Whether a value of the model is a nested object, whose properties are filtered one level deeper. Date, the Temporal
// values without zone and the scalars are leaves; any other terminal value object (RegExp, binary, …) or non-value object (arrays, Map/Set, …) is
// not filterable
type IsNestedModel<T> =
    [T] extends [boolean | bigint | number | string | Date | TemporalPlainDate | TemporalPlainTime | TemporalPlainDateTime] ? false :
    [T] extends [TerminalValueObject | NonValueObject] ? false :
    [T] extends [object] ? true :
    false

// The definition of a model, level by level up to 5 levels, as a complex projection (no recursion): a nested object
// deeper than that has no filter
export type DynamicDefinitionForModel<MODEL> = DynamicDefinitionForModel1<MODEL>
type DynamicDefinitionForModel1<MODEL> = {
    [K in keyof MODEL & string]-?: IsNestedModel<NonNullable<MODEL[K]>> extends true ? DynamicDefinitionForModel2<NonNullable<MODEL[K]>> : DynamicDefinitionLeafForModel<NonNullable<MODEL[K]>>
}
type DynamicDefinitionForModel2<MODEL> = {
    [K in keyof MODEL & string]-?: IsNestedModel<NonNullable<MODEL[K]>> extends true ? DynamicDefinitionForModel3<NonNullable<MODEL[K]>> : DynamicDefinitionLeafForModel<NonNullable<MODEL[K]>>
}
type DynamicDefinitionForModel3<MODEL> = {
    [K in keyof MODEL & string]-?: IsNestedModel<NonNullable<MODEL[K]>> extends true ? DynamicDefinitionForModel4<NonNullable<MODEL[K]>> : DynamicDefinitionLeafForModel<NonNullable<MODEL[K]>>
}
type DynamicDefinitionForModel4<MODEL> = {
    [K in keyof MODEL & string]-?: IsNestedModel<NonNullable<MODEL[K]>> extends true ? DynamicDefinitionForModel5<NonNullable<MODEL[K]>> : DynamicDefinitionLeafForModel<NonNullable<MODEL[K]>>
}
type DynamicDefinitionForModel5<MODEL> = {
    [K in keyof MODEL & string]-?: IsNestedModel<NonNullable<MODEL[K]>> extends true ? never : DynamicDefinitionLeafForModel<NonNullable<MODEL[K]>>
}

export type DynamicConditionForModel<MODEL, EXTENSION extends DynamicConditionExtension = never> = DynamicCondition<DynamicDefinitionForModel<MODEL>, EXTENSION>
