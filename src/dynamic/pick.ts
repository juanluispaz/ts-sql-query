import { isValueSource } from '../expressions/values.js'
import type { DataToProjectOfAny } from '../complexProjections/dataToProject.js'
import type { PickablePaths, PickWitOthersAsOptionals, PickingAsBooleanObjectMap, PickMandatoryOnly } from '../complexProjections/picking.js'
import type { ResultObjectValues } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullable } from '../complexProjections/resultWithOptionalsAsNull.js'
import type { Expand } from '../utils/objectUtils.js'
import type { DeepPick } from '../extras/deepUtilities.js'

export type Pickable = DataToProjectOfAny
export type DynamicPick<TYPE extends Pickable, MANDATORY extends PickablePaths<TYPE> = never> = Expand<PickingAsBooleanObjectMap<TYPE, MANDATORY>>
export type DynamicPickPaths<TYPE extends Pickable, MANDATORY extends PickablePaths<TYPE> = never> = Expand<Exclude<PickablePaths<TYPE>, MANDATORY>>

/*
 * Result type (not projected as nullable)
 */
export type PickValuesPath<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<ResultObjectValues<PickMandatoryOnly<COLUMNS, PICKED>>>
export type PickValuesPathWitAllProperties<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<ResultObjectValues<PickWitOthersAsOptionals<COLUMNS, PICKED>>>

/*
 * Result type (projected as nullable)
 */
export type PickValuesPathProjectedAsNullable<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<COLUMNS, PICKED>>>
export type PickValuesPathWitAllPropertiesProjectedAsNullable<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<ResultObjectValuesProjectedAsNullable<PickWitOthersAsOptionals<COLUMNS, PICKED>>>

/*
 * Flat (top-level) picked properties keyed DIRECTLY on the requested key set — the bridge
 * to a built-in `Pick<Model, K>`. `FlatPickValues` keys on `K` itself, which is exactly the
 * shape TypeScript relates to a hand-written `Pick<Model, K>` over a generic `K`. (The
 * `DeepPick` bridge below iterates `keyof` of the source instead, so it serves the nested
 * `DeepPick<Model, PATHS>` annotation but is NOT interchangeable with this for built-in
 * `Pick`.) Nested paths are not top-level keys, so they contribute nothing here.
 */
type FlatPickValues<COLUMNS extends Pickable, PICKED extends string> = Pick<ResultObjectValues<COLUMNS>, PICKED & keyof ResultObjectValues<COLUMNS>>
type FlatPickValuesProjectedAsNullable<COLUMNS extends Pickable, PICKED extends string> = Pick<ResultObjectValuesProjectedAsNullable<COLUMNS>, PICKED & keyof ResultObjectValuesProjectedAsNullable<COLUMNS>>

export function dynamicPick<TYPE extends Pickable, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: DynamicPick<TYPE>, mandatory?: MANDATORY[]): PickWitOthersAsOptionals<TYPE, MANDATORY> {
    const result: any = {}
    const required: any = {}

    if (mandatory) {
        for (let i = 0, length = mandatory.length; i < length; i++) {
            required[mandatory[i]] = true
        }
    }

    const o: any = obj
    const p: any = pick

    for (let prop in o) {
        if (!o[prop]) {
            // Do nothing
        } else if (prop in required) {
            result[prop] = o[prop]
        } else {
            const isRequired = p[prop]
            if (isRequired === true) {
                result[prop] = o[prop]
            } else if (!isRequired) {
                // Do nothing
            } else if (typeof isRequired === 'object') {
                const content = internalDynamicPick(o[prop], isRequired, required, prop)
                if (content !== undefined) {
                    result[prop] = content
                }
            }
        }
    }
    return result
}

function internalDynamicPick(o: any, p: any, required: any, prefix: string): any {
    const result: any = {}
    let hasContent = false

    for (let prop in o) {
        if (!o[prop]) {
            // Do nothing
        } else if ((prefix + '.' + prop) in required) {
            hasContent = true
            result[prop] = o[prop]
        } else {
            const isRequired = p[prop]
            if (isRequired === true) {
                hasContent = true
                result[prop] = o[prop]
            } else if (!isRequired) {
                // Do nothing
            } else if (typeof isRequired === 'object') {
                const content = internalDynamicPick(o[prop], isRequired, required, prefix + '.' + prop)
                if (content !== undefined) {
                    hasContent = true
                    result[prop] = content
                }
            }
        }
    }

    if (!hasContent) {
        return undefined
    }
    return result
}

export function dynamicPickPaths<TYPE extends Pickable, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: DynamicPickPaths<TYPE>[], mandatory?: MANDATORY[]): PickWitOthersAsOptionals<TYPE, MANDATORY> {
    const result: any = {}
    const required: any = {}

    if (mandatory) {
        for (let i = 0, length = mandatory.length; i < length; i++) {
            required[mandatory[i]] = true
        }
    }

    if (pick) {
        for (let i = 0, length = pick.length; i < length; i++) {
            required[pick[i]] = true
        }
    }

    const o: any = obj

    for (let prop in o) {
        if (!o[prop]) {
            // Do nothing
        } else if (prop in required) {
            result[prop] = o[prop]
        } else if (!isValueSource(o[prop])) {
            const content = internalDynamicPickPaths(o[prop], required, prop)
            if (content !== undefined)  {
                result[prop] = content
            }
        }
    }
    return result
}

function internalDynamicPickPaths(o: any, required: any, prefix: string): any {
    const result: any = {}
    let hasContent = false

    for (let prop in o) {
        if (!o[prop]) {
            // Do nothing
        } else if ((prefix + '.' + prop) in required) {
            hasContent = true
            result[prop] = o[prop]
        } else if (!isValueSource(o[prop])) {
            const content = internalDynamicPickPaths(o[prop], required, prefix + '.' + prop)
            if (content !== undefined)  {
                hasContent = true
                result[prop] = content
            }
        }
    }

    if (!hasContent) {
        return undefined
    }
    return result
}

/*
 * Each overload returns its structural result — `Expand<RESULT & ResultObjectValues<...>>`,
 * which is what `PickValuesPath` exposes — INTERSECTED with two bridge terms. The structural
 * result alone is not assignable to a hand-written pick of a business model while the picked
 * keys are still a generic type parameter: its key set is computed through mapped/conditional
 * types, so TypeScript cannot reduce it. The two bridges restore assignability over a generic
 * key/path set, each targeting a different caller annotation:
 *   - `FlatPickValues<TYPE, PICK | MANDATORY>` keys directly ON the requested keys, the shape
 *     TypeScript relates to a built-in `Pick<Model, K>` (flat, top-level keys).
 *   - `DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>` is covariant in its first type
 *     argument, so it relates to a caller's `DeepPick<Model, PATHS>` (nested, dotted paths).
 * Both bridges must stay OUTSIDE the `Expand<...>` wrapper: `Expand` re-keys on `keyof` of its
 * argument, which is generic-deferred here, and that would erase the direct keying. They are NOT
 * interchangeable (`FlatPickValues` iterates the requested keys; `DeepPick` iterates the source
 * keys), so both are needed. `PickValuesPath` and the other documented result-type aliases stay
 * purely structural — the bridges live only on the inferred return type.
 */
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[] }
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[] } | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[] } | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[] } | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[], mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[]
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[] | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[] | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)[] | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>)
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>) | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>) | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValues<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValues<TYPE>, PICK | MANDATORY>) | null | undefined
export function expandTypeFromDynamicPickPaths(_obj: any, _pick: any, result: any, _mandatory?: any): any {
    return result
}

export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[] }
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[] } | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[] } | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[] } | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[], mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[]
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[] | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[] | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)[] | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>)
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>) | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>) | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<NoInfer<TYPE>>, RESULT extends {}, MANDATORY extends PickablePaths<NoInfer<TYPE>> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> & FlatPickValuesProjectedAsNullable<TYPE, PICK | MANDATORY> & DeepPick<ResultObjectValuesProjectedAsNullable<TYPE>, PICK | MANDATORY>) | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths(_obj: any, _pick: any, result: any, _mandatory?: any): any {
    return result
}
