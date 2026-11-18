// What a computed value keeps of the type adapter of its column: the SQL data type of the column stays only with a
// value of the column (a comparison, a fallback of the column's values); a computed value has none, and a number or a
// text given to a computation doesn't take it.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { IntType, StringType, Table, withSqlDataType } from '../../../src/exports/v2/index.js'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}

const tThing = new class TThing extends Table<DBConnection, 'TThing'> {
    small = this.column('small', IntType, withSqlDataType({ family: 'exact numeric', bytes: 2 }))
    code = this.column('code', StringType, withSqlDataType({ family: 'character string', length: 3, fixed: true }))
    name = this.column('name', StringType, withSqlDataType({ family: 'character string', length: 50 }))
    body = this.column('body', StringType, withSqlDataType({ family: 'character string', largeObject: true }))
    label = this.column('label', StringType, withSqlDataType({ family: 'character string', length: 20, national: true }))
    constructor() { super('thing') }
}()

let lastQuery = ''
let lastParams: any[] = []
const conn = new DBConnection(new MockQueryRunner((_type, query, params) => {
    lastQuery = query
    lastParams = params
    return []
}))

function sqlDataTypes() {
    const context = getQueryContext(lastQuery, lastParams)
    return {
        params: lastParams.map((_value, index) => context.getParam(index)?.requestedSqlDataType),
        result: context.resultColumns?.map(column => column.originalSqlDataType),
    }
}

describe('AdapterPropagation', () => {
    test('a-fraction-added-to-a-small-int-is-a-double-without-the-type-of-the-column', async () => {
        await conn.selectFrom(tThing).select({ v: tThing.small.add(1.5) }).executeSelectMany()
        // Sent as a double, not with the type of the column (`int2`), which would lose the fraction
        expect(lastQuery).toBe('select small + $1::float8 as v from thing')
        expect(lastParams).toEqual([1.5])
        expect(sqlDataTypes()).toEqual({ params: [undefined], result: [undefined] })
    })

    test('a-value-compared-with-a-column-takes-the-type-of-the-column', async () => {
        await conn.selectFrom(tThing).where(tThing.code.equals('abc')).select({ v: tThing.code }).executeSelectMany()
        expect(sqlDataTypes()).toEqual({
            params: [{ family: 'character string', length: 3, fixed: true }],
            result: [{ family: 'character string', length: 3, fixed: true }],
        })
    })

    test('a-text-computed-from-a-column-and-the-text-given-to-it-have-no-type-of-the-column', async () => {
        await conn.selectFrom(tThing).select({ v: tThing.code.concat('abcdef') }).executeSelectMany()
        expect(lastQuery).toBe('select code || $1 as v from thing')
        expect(sqlDataTypes()).toEqual({ params: [undefined], result: [undefined] })
    })

    test('a-fallback-of-another-column-keeps-no-type-of-a-column', async () => {
        await conn.selectFrom(tThing).select({ v: tThing.code.valueWhenNull(tThing.name), w: tThing.code.valueWhenNull('zz') }).executeSelectMany()
        expect(sqlDataTypes()).toEqual({
            params: [{ family: 'character string', length: 3, fixed: true }],
            result: [undefined, { family: 'character string', length: 3, fixed: true }],
        })
    })

    test('a-text-computed-from-a-large-object-or-a-national-text-is-one-without-a-length', async () => {
        // A large object or a national text as an operand makes the computed text one too, as the databases give it; its
        // length is the one each database computes
        await conn.selectFrom(tThing).select({
            concat: tThing.body.concat('x'),
            operand: tThing.name.concat(tThing.body),
            lower: tThing.label.toLowerCase(),
            replace: tThing.name.replaceAll('a', tThing.label),
            both: tThing.body.concat(tThing.label),
            plain: tThing.name.substr(1, 2),
        }).executeSelectMany()
        expect(sqlDataTypes()).toEqual({
            params: [undefined, undefined, undefined, undefined],
            result: [
                { family: 'character string', largeObject: true },
                { family: 'character string', largeObject: true },
                { family: 'character string', national: true },
                { family: 'character string', national: true },
                { family: 'character string', largeObject: true, national: true },
                undefined,
            ],
        })
    })
})
