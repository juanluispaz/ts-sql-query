// The class of a data type says the type in the database of its values (its static sqlDataType): the query runners and
// the connections send and read a value by it, without knowing the class. The SQL data type of a column, given with
// its type adapter, is more precise and is the one used where it says the type requested.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { IntType, Table, withSqlDataType } from '../../../src/exports/v2/index.js'
import type { SqlDataType } from '../../../src/TypeAdapter.js'
import { IntegersType } from '../../../src/typeSystem/numeric.js'
import { operandTypeName, typeName } from '../../../src/utils/symbols.js'

// An integer of 30 digits, read and sent as a bigint of JavaScript
const thirtyDigits: SqlDataType = { family: 'exact numeric', precision: 30, scale: 0 }
abstract class BigIntegerType extends IntegersType<bigint> {
    static override readonly type = 'BigInteger'
    static override readonly customType = 'customBigint'
    static override readonly sqlDataType: SqlDataType = thirtyDigits
    declare [typeName]: 'type:BigInteger:customBigint:'
    declare [operandTypeName]: 'type:BigInteger:customBigint:'
}

class PostgreSqlDB extends PostgreSqlConnection<'PostgreSqlDB'> {}
class SqlServerDB extends SqlServerConnection<'SqlServerDB'> {}

const tThing = new class TThing extends Table<PostgreSqlDB, 'TThing'> {
    id = this.column('id', IntType)
    big = this.column('big', BigIntegerType)
    constructor() { super('thing') }
}()
const tSqlServerThing = new class TSqlServerThing extends Table<SqlServerDB, 'TSqlServerThing'> {
    big = this.column('big', BigIntegerType)
    small = this.column('small', BigIntegerType, withSqlDataType({ family: 'exact numeric', scale: 0, bytes: 2 }))
    constructor() { super('thing') }
}()

let lastQuery = ''
let lastParams: any[] = []
let rowsToReturn: any[] = []
function mock() {
    return new MockQueryRunner((_type, query, params) => {
        lastQuery = query
        lastParams = params
        return rowsToReturn
    })
}

describe('DataTypeSqlDataType', () => {
    test('the-runner-reads-the-sql-data-type-of-the-class-and-the-one-declared-apart', async () => {
        const conn = new PostgreSqlDB(mock())
        rowsToReturn = [{ big: '123456789012345678901234567890' }]
        const rows = await conn.selectFrom(tThing).where(tThing.big.equals(5n)).select({ big: tThing.big }).executeSelectMany()
        expect(rows).toEqual([{ big: 123456789012345678901234567890n }])
        const queryContext = getQueryContext(lastQuery, lastParams)
        // The one of the type is in its class; none is declared for the column
        expect(queryContext.getParam(0)?.requestedType?.sqlDataType).toBe(thirtyDigits)
        expect(queryContext.getParam(0)?.requestedSqlDataType).toBeUndefined()
        expect(queryContext.getResultColumn('big')?.requestedType.sqlDataType).toBe(thirtyDigits)
        expect(queryContext.getResultColumn('big')?.requestedSqlDataType).toBeUndefined()
    })

    test('postgresql-casts-a-value-by-the-sql-data-type-of-its-class', async () => {
        const conn = new PostgreSqlDB(mock())
        rowsToReturn = []
        await conn.selectFromNoTable().select({ v: conn.const(5n, BigIntegerType), w: conn.const(5, IntType) }).executeSelectMany()
        expect(lastQuery).toBe('select $1::numeric as v, $2::int4 as w')
    })

    test('sql-server-reads-an-integer-wider-than-a-bigint-as-its-text', async () => {
        const conn = new SqlServerDB(mock())
        rowsToReturn = [{ big: '123456789012345678901234567890', small: 7n }]
        const rows = await conn.selectFrom(tSqlServerThing).select({ big: tSqlServerThing.big, small: tSqlServerThing.small }).executeSelectMany()
        // The column of 2 bytes, as its type adapter says, is read as the driver gives it
        expect(lastQuery).toBe('select convert(nvarchar(41), big) as big, small as small from thing')
        expect(rows).toEqual([{ big: 123456789012345678901234567890n, small: 7n }])
    })
})
