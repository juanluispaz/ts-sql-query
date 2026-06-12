import type { TerminalValueObject, NonValueObject } from '../utils/objectUtils.js'
import type { DynamicCondition, DinamicConditionExtension } from '../expressions/dynamicConditionUsingFilters.js'

export type { DynamicCondition }

/*
 * Building a dynamic condition from a business model (instead of from the value-source
 * map or a hand-written descriptor map).
 *
 * `DynamicDefinitionForModel<MODEL>` maps a plain business interface to the descriptor
 * map that `DynamicCondition` already understands (`number` → `'int'`, `string` →
 * `'string'`, a string/number literal union → `['enum', …]`, `Date` → date filter, a
 * nested plain object → recurse). `DynamicConditionForModel<MODEL>` then feeds that to
 * `DynamicCondition`, so the produced filter is — by construction — the same shape
 * `dynamicConditionFor(columns).withValues(...)` expects, with no value-source type
 * leaking into the public signature.
 *
 * Only the value categories the filter engine distinguishes are mapped; columns with a
 * custom-typed adapter (e.g. a branded `customComparable`) cannot be told apart from
 * their base type here, and non-filterable object values (arrays, Map/Set, binary, …)
 * map to `never`. For those, build the definition with the descriptor map directly.
 */
type DynamicDefinitionFieldForModel<T> =
    [T] extends [boolean] ? 'boolean' :
    [T] extends [bigint] ? 'bigint' :
    [T] extends [number] ? ([number] extends [T] ? 'int' : ['enum', T]) :
    [T] extends [string] ? ([string] extends [T] ? 'string' : ['enum', T]) :
    [T] extends [Date] ? 'localDateTime' :
    // Date matched above; any other terminal value object (RegExp, binary, …) or non-value
    // object (arrays, Map/Set, …) is not filterable → `never`. Plain objects recurse.
    [T] extends [TerminalValueObject | NonValueObject] ? never :
    [T] extends [object] ? DynamicDefinitionForModel<T> :
    never

export type DynamicDefinitionForModel<MODEL> = {
    [K in keyof MODEL & string]-?: DynamicDefinitionFieldForModel<NonNullable<MODEL[K]>>
}

export type DynamicConditionForModel<MODEL, EXTENSION extends DinamicConditionExtension = never> = DynamicCondition<DynamicDefinitionForModel<MODEL>, EXTENSION>
