import { IntegersType } from './numeric.js'
import type { operandTypeName, typeName } from '../utils/symbols.js'

/** An integer number of 64 bits, a JavaScript bigint */
export abstract class BigintType extends IntegersType<bigint> {
    static override readonly type = 'bigint'
    static override readonly customType = undefined
    declare [typeName]: 'type:bigint:'
    declare [operandTypeName]: 'type:bigint:'
}
