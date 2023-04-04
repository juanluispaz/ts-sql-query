import { AnyValueSource, isValueSource } from './expressions/values'
import type { SelectedValues } from './extras/types'
import type { MandatoryPropertiesOf } from './utils/resultUtils'

export type { DynamicCondition, TypeSafeDynamicCondition } from './expressions/dynamicConditionUsingFilters'

export type Pickable = {
    [key in string]?: AnyValueSource | Pickable
}

export type DynamicPick<TYPE extends Pickable, MANDATORY extends MandatoryPaths<TYPE, ''> = never> = InternalDynamicPick<TYPE, MANDATORY, ''>
type InternalDynamicPick<TYPE, MANDATORY extends string, PREFIX extends string> = Omit<{
    [P in (keyof TYPE) & string]?:
        TYPE[P] extends AnyValueSource | undefined ? boolean 
        : InternalDynamicPick<TYPE[P], MANDATORY, `${PREFIX}.${P}`> | boolean
}, MadatoriesInType<TYPE, MANDATORY, PREFIX>>

type PickWithMandatories<TYPE, MANDATORY extends string, PREFIX extends string> = Expand<{
    [P in OptionalValueSourcesInType<TYPE, MANDATORY, PREFIX>]?: TYPE[P]
} & {
    [P in NonValueSourcesInType<TYPE, MANDATORY, PREFIX>]: 
        PREFIX extends '' 
        ? PickWithMandatories<TYPE[P], MANDATORY, `${P}`>
        : PickWithMandatories<TYPE[P], MANDATORY, `${PREFIX}.${P}`>
} & { 
    [Q in MANDATORY & keyof TYPE]: TYPE[Q] 
}>

type MadatoriesInType<TYPE, MANDATORY extends string, PREFIX extends string> =
    { [P in (keyof TYPE) & string]-?: `${PREFIX}${P}` extends MANDATORY ? P : never } [(keyof TYPE) & string]

type OptionalValueSourcesInType<TYPE, MANDATORY extends string, PREFIX extends string> =
    { [P in (keyof TYPE) & string]-?: TYPE[P] extends AnyValueSource | undefined ? (`${PREFIX}${P}` extends MANDATORY ? never : P) : never } [(keyof TYPE) & string]

type NonValueSourcesInType<TYPE, MANDATORY extends string, PREFIX extends string> =
    { [P in (keyof TYPE) & string]-?: TYPE[P] extends AnyValueSource | undefined ? never : `${PREFIX}${P}` extends MANDATORY ? never : P } [(keyof TYPE) & string]


type MandatoryPaths<TYPE, PREFIX extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? `${PREFIX}`
    : PREFIX extends '' ? { [KEY in MandatoryPropertiesOf<TYPE> & string] : MandatoryPaths<TYPE[KEY], `${KEY}`> }[MandatoryPropertiesOf<TYPE> & string]
    : { [KEY in MandatoryPropertiesOf<TYPE> & string] : MandatoryPaths<TYPE[KEY], `${PREFIX}.${KEY}`> }[MandatoryPropertiesOf<TYPE> & string] | `${PREFIX}`

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never
// type ExpandRecursively<T> = T extends object ? T extends infer O ? { [K in keyof O]: ExpandRecursively<O[K]> } : never : T;

export function dynamicPick<TYPE extends Pickable, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: DynamicPick<TYPE>, mandatory?: MANDATORY[]): PickWithMandatories<TYPE, MANDATORY, ''> {
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
                result[prop] = internalDynamicPick(o[prop], isRequired, required, prop)
            }
        }
    }
    return result
}

function internalDynamicPick(o: any, p: any, required: any, prefix: string): any {
    const result: any = {}

    for (let prop in o) {
        if (!o[prop]) {
            // Do nothing
        } else if ((prefix + '.' + prop) in required) {
            result[prop] = o[prop]
        } else {
            const isRequired = p[prop]
            if (isRequired === true) {
                result[prop] = o[prop]
            } else if (!isRequired) {
                // Do nothing
            } else if (typeof isRequired === 'object') {
                result[prop] = internalDynamicPick(o[prop], isRequired, required, prefix + '.' + prop)
            }
        }
    }
    return result
}

export type DynamicPickPaths<TYPE extends Pickable, MANDATORY extends MandatoryPaths<TYPE, ''> = never> = Exclude<MandatoryPaths<TYPE, ''>, MANDATORY>

export function dynamicPickPaths<TYPE extends Pickable, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: DynamicPickPaths<TYPE>[], mandatory?: MANDATORY[]): PickWithMandatories<TYPE, MANDATORY, ''> {
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
        console.log('>', prop)
        if (!o[prop]) {
            // Do nothing
        } else if (prop in required) {
            result[prop] = o[prop]
        } else if (isValueSource(o[prop])) {
            const r = internalDynamicPickPaths(o[prop], required, prop)
            if (r !== undefined)  {
                result[prop] = r
            }
        }
    }
    return result
}

function internalDynamicPickPaths(o: any, required: any, prefix: string): any {
    if (!o) {
        return undefined
    }
    
    const result: any = {}

    for (let prop in o) {
        console.log('>', prefix, prop)
        if (!o[prop]) {
            // Do nothing
        } else if ((prefix + '.' + prop) in required) {
            result[prop] = o[prop]
        } else if (isValueSource(o[prop])) {
            const r = internalDynamicPickPaths(o[prop], required, prefix + '.' + prop)
            if (r !== undefined)  {
                result[prop] = r
            }
        }
    }
    return result
}

export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }>(obj: TYPE, pick: PICK[], result: RESULT): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPaths<SelectedValues<TYPE>, PICK, ''>)[] }
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }>(obj: TYPE, pick: PICK[], result: RESULT | null): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPaths<SelectedValues<TYPE>, PICK, ''>)[] } | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }>(obj: TYPE, pick: PICK[], result: RESULT | undefined): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPaths<SelectedValues<TYPE>, PICK, ''>)[] } | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPaths<SelectedValues<TYPE>, PICK, ''>)[] } | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}>(obj: TYPE, pick: PICK[], result: RESULT[]): (RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''>)[]
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}>(obj: TYPE, pick: PICK[], result: RESULT[] | null): (RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''>)[] | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined): (RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''>)[] | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {} | null | undefined>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined): (RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''>)[] | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}>(obj: TYPE, pick: PICK[], result: RESULT): RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''>
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}>(obj: TYPE, pick: PICK[], result: RESULT | null): RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''> | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}>(obj: TYPE, pick: PICK[], result: RESULT | undefined): RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''> | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {} | null | undefined>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined): RESULT & PickPaths<SelectedValues<TYPE>, PICK, ''> | null | undefined
export function expandTypeFromDynamicPickPaths(obj: any, pick: any, result: any): any {
    obj
    pick
    return result
}

type PickPaths<TYPE, MANDATORY extends string, PREFIX extends string> = { 
    [Q in MANDATORY & keyof TYPE]: TYPE[Q] 
} & { 
    [P in Exclude<keyof TYPE & string, MANDATORY>]: PickPaths<TYPE[P], MANDATORY, `${PREFIX}.${P}`>
}