import { AnyValueSource, isValueSource } from './expressions/values'
import type { MandatoryPropertiesOf, ResultObjectValues } from './utils/resultUtils'
import type { neverUsedSymbol } from './utils/symbols'

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
        ? PickWithMandatories<TYPE[P], MANDATORY, `${P}.`>
        : PickWithMandatories<TYPE[P], MANDATORY, `${PREFIX}.${P}.`>
} & { 
    [Q in MadatoriesInType<TYPE, MANDATORY, PREFIX>]: TYPE[Q] 
}>

type PickMandatories<TYPE, MANDATORY extends string, PREFIX extends string> = Expand<{
    [P in NonValueSourcesInType<TYPE, MANDATORY, PREFIX>]: 
        PREFIX extends '' 
        ? PickMandatories<TYPE[P], MANDATORY, `${P}.`>
        : PickMandatories<TYPE[P], MANDATORY, `${PREFIX}.${P}.`>
} & { 
    [Q in MadatoriesInType<TYPE, MANDATORY, PREFIX>]: TYPE[Q] 
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

export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>)[] }
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>)[] } | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>)[] } | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>)[] } | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[], mandatory?: MANDATORY[]): (RESULT & PickPath<TYPE, PICK | MANDATORY>)[]
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null, mandatory?: MANDATORY[]): (RESULT & PickPath<TYPE, PICK | MANDATORY>)[] | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined, mandatory?: MANDATORY[]): (RESULT & PickPath<TYPE, PICK | MANDATORY>)[] | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined, mandatory?: MANDATORY[]): (RESULT & PickPath<TYPE, PICK | MANDATORY>)[] | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): RESULT & PickPath<TYPE, PICK | MANDATORY>
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): RESULT & PickPath<TYPE, PICK | MANDATORY> | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): RESULT & PickPath<TYPE, PICK | MANDATORY> | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): RESULT & PickPath<TYPE, PICK | MANDATORY> | null | undefined
export function expandTypeFromDynamicPickPaths(_obj: any, _pick: any, result: any, _mandatory?: any): any {
    return result
}

// If you need use this type in your project, use PickValuesPath instead
type PickPath<COLUMNS, MANDATORY extends string> = RemovePropertiesWithoutContent<ResultObjectValues<PickMandatories<COLUMNS, MANDATORY, ''>>>
    // This second line is added to allow TS be compatible with Pick usage as the result of the function
    & Pick<ResultObjectValues<COLUMNS>, MANDATORY & keyof ResultObjectValues<COLUMNS>>

export type PickValuesPath<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = PickPath<COLUMNS, PICKED>

// Support till 9 clean up levels (recursive definition not working in [P in keyof T])
type RemovePropertiesWithoutContent<T> = T extends object ? {
    [P in PropertiesWithContent<T>]: RemovePropertiesWithoutContent2<T[P]>;
} : T

type PropertiesWithContent<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent2<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent2<T> = T extends object ? {
    [P in PropertiesWithContent2<T>]: RemovePropertiesWithoutContent3<T[P]>;
} : T

type PropertiesWithContent2<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent3<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent3<T> = T extends object ? {
    [P in PropertiesWithContent3<T>]: RemovePropertiesWithoutContent4<T[P]>;
} : T

type PropertiesWithContent3<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent4<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent4<T> = T extends object ? {
    [P in PropertiesWithContent4<T>]: RemovePropertiesWithoutContent5<T[P]>;
} : T

type PropertiesWithContent4<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent5<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent5<T> = T extends object ? {
    [P in PropertiesWithContent5<T>]: RemovePropertiesWithoutContent6<T[P]>;
} : T

type PropertiesWithContent5<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent6<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent6<T> = T extends object ? {
    [P in PropertiesWithContent6<T>]: RemovePropertiesWithoutContent7<T[P]>;
} : T

type PropertiesWithContent6<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent7<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent7<T> = T extends object ? {
    [P in PropertiesWithContent7<T>]: RemovePropertiesWithoutContent8<T[P]>;
} : T

type PropertiesWithContent7<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent8<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent8<T> = T extends object ? {
    [P in PropertiesWithContent8<T>]: RemovePropertiesWithoutContent9<T[P]>;
} : T

type PropertiesWithContent8<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends RemovePropertiesWithoutContent9<T[P]> ? never : P
}[keyof T]

type RemovePropertiesWithoutContent9<T> = T extends object ? {
    [P in PropertiesWithContent9<T>]: T[P];
} : T

type PropertiesWithContent9<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends T[P] ? never : P
}[keyof T]
