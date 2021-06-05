export type { DynamicCondition, TypeSafeDynamicCondition } from './expressions/dynamicConditionUsingFilters'

export type DynamicPick<Type, Mandatory extends keyof Type = never> = Omit<{
    [P in keyof Type]?: boolean
}, Mandatory>

type PickWithMandatories<Type, Mandatory extends keyof Type = never> = { 
    [P in keyof Type]?: Type[P] 
} & { 
    [Q in Mandatory]: Type[Q] 
} 

export function dynamicPick<Type, Mandatory extends keyof Type = never>(obj: Type, pick: DynamicPick<Type>, mandatory?: Mandatory[]): { [P in keyof PickWithMandatories<Type, Mandatory>]: PickWithMandatories<Type, Mandatory>[P] } {
    const result: any = {}
    const o: any = obj
    const p: any = pick

    if (mandatory) {
        for (let i = 0, length = mandatory.length; i < length; i++) {
            const p = mandatory[i]
            result[p] = o[p]    
        }
    }
    for (let prop in p) {
        if (p[prop] && prop in o) {
            result[prop] = o[prop]
        }
    }
    return result
}