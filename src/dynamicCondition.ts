import { AnyValueSource, isValueSource } from './expressions/values'
import type { MandatoryPropertiesOf, ResultObjectValues, ResultObjectValuesProjectedAsNullable } from './utils/resultUtils'
import type { neverUsedSymbol } from './utils/symbols'

export type { DynamicCondition } from './expressions/dynamicConditionUsingFilters'

export type Pickable = {
    [key in string]?: AnyValueSource | Pickable
}

export type DynamicPick<TYPE extends Pickable, MANDATORY extends MandatoryPaths<TYPE, ''> = never> = Expand<InternalDynamicPick<TYPE, MANDATORY, ''>>
type InternalDynamicPick<TYPE, MANDATORY extends string, PREFIX extends string> = Omit<{
    [P in (keyof TYPE) & string]?:
        TYPE[P] extends AnyValueSource | undefined ? boolean 
        : InternalDynamicPick<TYPE[P], MANDATORY, `${PREFIX}${P}.`> | boolean
}, MadatoriesInType<TYPE, MANDATORY, PREFIX>>

type PickWithMandatories<TYPE, MANDATORY extends string, PREFIX extends string> = Expand<{
    [P in OptionalValueSourcesInType<TYPE, MANDATORY, PREFIX>]?: TYPE[P]
} & {
    [P in NonValueSourcesInType<TYPE, MANDATORY, PREFIX>]: 
        PickWithMandatories<TYPE[P], MANDATORY, `${PREFIX}${P}.`>
} & { 
    [Q in MadatoriesInType<TYPE, MANDATORY, PREFIX>]: TYPE[Q] 
}>

type PickMandatories<TYPE, MANDATORY extends string, PREFIX extends string> = Expand<MarkPropertiesWithoutContentAsOptional<{
    [P in NonValueSourcesInType<TYPE, MANDATORY, PREFIX>]: 
        PickMandatories<TYPE[P], MANDATORY, `${PREFIX}${P}.`>
} & { 
    [Q in MadatoriesInType<TYPE, MANDATORY, PREFIX>]: TYPE[Q] 
}>>

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

export type DynamicPickPaths<TYPE extends Pickable, MANDATORY extends MandatoryPaths<TYPE, ''> = never> = Expand<Exclude<MandatoryPaths<TYPE, ''>, MANDATORY>>

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

export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>>)[] }
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>>)[] } | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>>)[] } | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPath<TYPE, PICK | MANDATORY>>)[] } | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[], mandatory?: MANDATORY[]): (Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>>)[]
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null, mandatory?: MANDATORY[]): (Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>>)[] | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>>)[] | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>>)[] | null | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>>
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>> | null
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>> | undefined
export function expandTypeFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Expand<RESULT & PickPath<TYPE, PICK | MANDATORY>> | null | undefined
export function expandTypeFromDynamicPickPaths(_obj: any, _pick: any, result: any, _mandatory?: any): any {
    return result
}

// If you need use this type in your project, use PickValuesPath instead
type PickPath<COLUMNS, MANDATORY extends string> = ResultObjectValues<PickMandatories<COLUMNS, MANDATORY, ''>>
    // This second line is added to allow TS be compatible with Pick usage as the result of the function
    & Pick<ResultObjectValues<COLUMNS>, MANDATORY & keyof ResultObjectValues<COLUMNS>>

export type PickValuesPath<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<PickPath<COLUMNS, PICKED>>

export type PickValuesPathWitAllProperties<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<
    ResultObjectValues<PickWithMandatories<COLUMNS, PICKED, ''>>
    // This second line is added to allow TS be compatible with Pick usage as the result of the function
    & Pick<ResultObjectValues<COLUMNS>, PICKED & keyof ResultObjectValues<COLUMNS>>>



export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[] }
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[] } | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[] } | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends { data: any[], count: number }, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Omit<RESULT, 'data'> & { data: (Expand<RESULT['data'][number] & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[] } | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[], mandatory?: MANDATORY[]): (Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[]
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null, mandatory?: MANDATORY[]): (Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[] | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[] | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT[] | null | undefined, mandatory?: MANDATORY[]): (Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>)[] | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT, mandatory?: MANDATORY[]): Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>>
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null, mandatory?: MANDATORY[]): Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>> | null
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | undefined, mandatory?: MANDATORY[]): Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>> | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths<TYPE extends Pickable, PICK extends DynamicPickPaths<TYPE>, RESULT extends {}, MANDATORY extends MandatoryPaths<TYPE, ''> = never>(obj: TYPE, pick: PICK[], result: RESULT | null | undefined, mandatory?: MANDATORY[]): Expand<RESULT & PickPathProjectedAsNullable<TYPE, PICK | MANDATORY>> | null | undefined
export function expandTypeProjectedAsNullableFromDynamicPickPaths(_obj: any, _pick: any, result: any, _mandatory?: any): any {
    return result
}



// If you need use this type in your project, use PickValuesPathProjectedAsNullable instead
type PickPathProjectedAsNullable<COLUMNS, MANDATORY extends string> = ResultObjectValuesProjectedAsNullable<PickMandatories<COLUMNS, MANDATORY, ''>>
    // This second line is added to allow TS be compatible with Pick usage as the result of the function
    & Pick<ResultObjectValuesProjectedAsNullable<COLUMNS>, MANDATORY & keyof ResultObjectValuesProjectedAsNullable<COLUMNS>>

export type PickValuesPathProjectedAsNullable<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<PickPathProjectedAsNullable<COLUMNS, PICKED>>

export type PickValuesPathWitAllPropertiesProjectedAsNullable<COLUMNS extends Pickable, PICKED extends DynamicPickPaths<COLUMNS>> = Expand<
    ResultObjectValuesProjectedAsNullable<PickWithMandatories<COLUMNS, PICKED, ''>>
    // This second line is added to allow TS be compatible with Pick usage as the result of the function
    & Pick<ResultObjectValuesProjectedAsNullable<COLUMNS>, PICKED & keyof ResultObjectValuesProjectedAsNullable<COLUMNS>>>

// Support till 9 clean up levels (recursive definition not working in [P in keyof T])
type MarkPropertiesWithoutContentAsOptional<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent<T>]: MarkPropertiesWithoutContentAsOptional2<T[P]>;
} & {
    [P in PropertiesWithoutContent<T>]?: MarkPropertiesWithoutContentAsOptional2<T[P]>;
} : T

type PropertiesWithContent<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional2<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional2<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional2<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent2<T>]: MarkPropertiesWithoutContentAsOptional3<T[P]>;
} & {
    [P in PropertiesWithoutContent2<T>]?: MarkPropertiesWithoutContentAsOptional3<T[P]>;
} : T

type PropertiesWithContent2<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional3<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent2<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional3<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional3<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent3<T>]: MarkPropertiesWithoutContentAsOptional4<T[P]>;
} & {
    [P in PropertiesWithoutContent3<T>]?: MarkPropertiesWithoutContentAsOptional4<T[P]>;
} : T

type PropertiesWithContent3<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional4<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent3<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional4<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional4<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent4<T>]: MarkPropertiesWithoutContentAsOptional5<T[P]>;
} & {
    [P in PropertiesWithoutContent4<T>]?: MarkPropertiesWithoutContentAsOptional5<T[P]>;
} : T

type PropertiesWithContent4<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional5<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent4<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional5<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional5<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent5<T>]: MarkPropertiesWithoutContentAsOptional6<T[P]>;
} & {
    [P in PropertiesWithoutContent5<T>]?: MarkPropertiesWithoutContentAsOptional6<T[P]>;
} : T

type PropertiesWithContent5<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional6<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent5<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional6<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional6<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent6<T>]: MarkPropertiesWithoutContentAsOptional7<T[P]>;
} & {
    [P in PropertiesWithoutContent6<T>]?: MarkPropertiesWithoutContentAsOptional7<T[P]>;
} : T

type PropertiesWithContent6<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional7<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent6<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional7<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional7<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent7<T>]: MarkPropertiesWithoutContentAsOptional8<T[P]>;
} & {
    [P in PropertiesWithoutContent7<T>]?: MarkPropertiesWithoutContentAsOptional8<T[P]>;
} : T

type PropertiesWithContent7<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional8<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent7<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional8<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional8<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent8<T>]: MarkPropertiesWithoutContentAsOptional9<T[P]>;
} & {
    [P in PropertiesWithoutContent8<T>]?: MarkPropertiesWithoutContentAsOptional9<T[P]>;
} : T

type PropertiesWithContent8<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional9<T[P]> ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent8<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends MarkPropertiesWithoutContentAsOptional9<T[P]> ? P : undefined extends T[P] ? P : never
}[keyof T]

type MarkPropertiesWithoutContentAsOptional9<T> = T extends AnyValueSource | undefined ? T : T extends object ? {
    [P in PropertiesWithContent9<T>]: T[P];
} & {
    [P in PropertiesWithoutContent9<T>]?: T[P];
} : T

type PropertiesWithContent9<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends T[P] ? never : undefined extends T[P] ? never : P
}[keyof T]

type PropertiesWithoutContent9<T> = {
    [P in keyof T] : { [neverUsedSymbol]: typeof neverUsedSymbol } extends T[P] ? P : undefined extends T[P] ? P : never
}[keyof T]
