import { AnyValueSource } from './expressions/values'

export type { DynamicCondition, TypeSafeDynamicCondition } from './expressions/dynamicConditionUsingFilters'

export type Pickable = {
    [key: string]: AnyValueSource | Pickable
}

export type DynamicPick<Type extends Pickable, Mandatory extends keyof Type = never> = Omit<{
    [P in keyof Type]?: Type[P] extends AnyValueSource ? boolean : Type[P] extends Pickable ? boolean | DynamicPick<Type[P]> : never
}, Mandatory>

type PickWithMandatories<Type extends Pickable, Mandatory extends keyof Type = never> = { 
    [P in Exclude<keyof Type, Mandatory>]?: Type[P] extends AnyValueSource ? Type[P] : Type[P] extends Pickable ? PickWithMandatories<Type[P]> : never
} & { 
    [Q in Mandatory]: Type[Q] 
} 


export function dynamicPick<Type extends Pickable, Mandatory extends keyof Type = never>(obj: Type, pick: DynamicPick<Type>, mandatory?: Mandatory[]): { [P in keyof PickWithMandatories<Type, Mandatory>]: PickWithMandatories<Type, Mandatory>[P] } {
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