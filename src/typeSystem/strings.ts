import { ComparableType } from './comparable.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/** A text */
export abstract class StringType extends ComparableType<string> {
    static override readonly __type = 'string'
    static override readonly __customType = undefined
    declare [typeName]: 'type:string:'
    declare [operandTypeName]: 'type:string:'
}
