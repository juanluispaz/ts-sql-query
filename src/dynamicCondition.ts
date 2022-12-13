import { AnyValueSource } from './expressions/values'
import { MandatoryPropertiesOf } from './utils/resultUtils'

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