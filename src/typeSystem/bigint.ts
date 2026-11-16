import type { SqlDataType } from '../TypeAdapter.js'
import { IntegersType } from './numeric.js'
import type { operandTypeName, typeName } from '../utils/symbols.js'

/** An integer number of 64 bits, a JavaScript bigint */
/** The type in the database of a bigint: an integer of 8 bytes */
export const bigintSqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 8 }

export abstract class BigintType extends IntegersType<bigint> {
    static override readonly type = 'bigint'
    static override readonly customType = undefined
    static override readonly sqlDataType: SqlDataType = bigintSqlDataType
    declare [typeName]: 'type:bigint:'
    declare [operandTypeName]: 'type:bigint:'
}
