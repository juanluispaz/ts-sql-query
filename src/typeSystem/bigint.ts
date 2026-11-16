import type { SqlDataType } from '../TypeAdapter.js'
import { IntegersType } from './numeric.js'
import { bigintSqlDataType } from './numericSqlDataTypes.js'

/** An integer number of 64 bits, a JavaScript bigint */
export abstract class BigintType extends IntegersType<bigint, 'bigint'> {
    static override readonly type = 'bigint'
    static override readonly sqlDataType: SqlDataType | undefined = bigintSqlDataType
}
