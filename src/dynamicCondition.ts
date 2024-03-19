import { isValueSource } from './expressions/values'
import type { DataToProjectOfAny } from './complexProjections/dataToProject'
import type { PickablePaths, PickWitOthersAsOptionals, PickingAsBooleanObjectMap, PickMandatoryOnly } from './complexProjections/picking'
import type { ResultObjectValues } from './complexProjections/resultWithOptionalsAsUndefined'
import type { ResultObjectValuesProjectedAsNullable } from './complexProjections/resultWithOptionalsAsNull'
import type { Expand } from './utils/objectUtils'

export type { DynamicCondition } from './expressions/dynamicConditionUsingFilters'

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

// TODO: pick: DynamicPickPaths<NoInfer<TYPE>> introduced in TS 5.4 (too recently)
export function dynamicPick<TYPE extends Pickable, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: DynamicPick<TYPE>, mandatory?: MANDATORY[]): PickWitOthersAsOptionals<TYPE, MANDATORY> {
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
                    result[prop] = internalDynamicPick(o[prop], isRequired, required, prop)
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

// TODO: pick: DynamicPickPaths<NoInfer<TYPE>> introduced in TS 5.4 (too recently)
export function dynamicPickPaths<TYPE extends Pickable, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: DynamicPickPaths<TYPE>[], mandatory?: MANDATORY[]): PickWitOthersAsOptionals<TYPE, MANDATORY> {
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
                hasContent
                result[prop] = content
            }
        }
    }

    if (!hasContent) {
        return undefined
    }
    return result
}

export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] }
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] } | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] } | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] } | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[], mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[]
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValues<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> | null | undefined
export function expandTypeFromDynamicPickPaths(_obj: any, _pick: any, result: any, _mandatory?: any): any {
    return result
}

export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] }
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] } | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] } | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] } | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[], mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[]
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>)[] | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>>
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends PickablePaths<TYPE> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Expand<RESULT & ResultObjectValuesProjectedAsNullable<PickMandatoryOnly<TYPE, PICK | MANDATORY>>> | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths(_obj: any, _pick: any, result: any, _mandatory?: any): any {
    return result
}
