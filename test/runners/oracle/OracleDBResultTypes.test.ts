// OracleDBQueryRunner reads the expected type of each result column on the params: a column expected as a
// customDecimal or a bigint is fetched as text, with every digit, where oracledb would give a JavaScript number. The
// fetch type handler of the runner answers for every column, so the global settings of oracledb of the application
// (oracledb.fetchTypeHandler, fetchAsString, fetchAsBuffer, maxRows) don't change what the library receives; a DATE or
// a TIMESTAMP is the Date whose UTC getters are its digits, a CLOB is text.

import oracledb from 'oracledb'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryResultColumn, QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { OracleDBQueryRunner } from '../../../src/queryRunners/OracleDBQueryRunner.js'
import { queryResultColumns, setMetadata } from '../../../src/utils/metadataSymbols.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'

describe.skipIf(!isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'))('OracleDBQueryRunner: result types', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: oracledb.Connection | undefined
    let runner: QueryRunner | undefined

    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        connection = await oracledb.getConnection({ user: db.user, password: db.password, connectString: db.connectString })
        runner = new OracleDBQueryRunner(connection)
    }, 300_000)
    afterAll(async () => {
        await connection?.close()
        await db?.release()
    }, 300_000)

    const sql = 'select cast(12345678901234567890.1234567891 as number(38, 10)) as "amount", cast(-0.25 as number(10, 2)) as "price", 1.5 as "plain" from dual'
    const decimal = (name: string): QueryResultColumn => ({ name, path: name, type: 'Amount', typeCategory: 'customDecimal' })
    const double = (name: string): QueryResultColumn => ({ name, path: name, type: 'double', typeCategory: 'double' })

    function paramsExpecting(columns: QueryResultColumn[]): any[] {
        const params: any[] = []
        setMetadata(params, queryResultColumns, columns)
        return params
    }

    test('a-custom-decimal-column-is-fetched-as-text', async () => {
        const row = await runner!.executeSelectOneRow(sql, paramsExpecting([decimal('amount'), decimal('price'), double('plain')]))
        expect(row).toEqual({ amount: '12345678901234567890.1234567891', price: '-.25', plain: 1.5 })
    })

    test('without-expectations-the-driver-gives-numbers', async () => {
        const row = await runner!.executeSelectOneRow(sql, [])
        expect(row).toEqual({ amount: 12345678901234567000, price: -0.25, plain: 1.5 })
    })

    test('the-only-column-without-a-name', async () => {
        const params = paramsExpecting([{ name: '', path: '', type: 'Amount', typeCategory: 'customDecimal' }])
        expect(await runner!.executeSelectOneColumnOneRow('select cast(12345678901234567890.1234567891 as number(38, 10)) from dual', params)).toBe('12345678901234567890.1234567891')
    })

    test('a-bigint-column-is-fetched-as-text', async () => {
        const params = paramsExpecting([{ name: 'big', path: 'big', type: 'bigint', typeCategory: 'bigint' }, double('plain')])
        const row = await runner!.executeSelectOneRow('select cast(123456789012345678901 as number(21)) as "big", 1.5 as "plain" from dual', params)
        expect(row).toEqual({ big: '123456789012345678901', plain: 1.5 })
    })

    test('the-global-settings-of-oracledb-are-not-applied', async () => {
        const previousHandler = oracledb.fetchTypeHandler
        const previousAsString = oracledb.fetchAsString
        const previousAsBuffer = oracledb.fetchAsBuffer
        const previousMaxRows = oracledb.maxRows
        oracledb.fetchTypeHandler = (metadata) => metadata.name === 'plain' || metadata.name === 'amount' ? { converter: (value: unknown) => 'global ' + String(value) } : undefined
        oracledb.fetchAsString = [oracledb.NUMBER, oracledb.DATE]
        oracledb.fetchAsBuffer = [oracledb.BLOB]
        oracledb.maxRows = 1
        try {
            const row = await runner!.executeSelectOneRow(sql, paramsExpecting([decimal('amount'), double('price'), double('plain')]))
            expect(row).toEqual({ amount: '12345678901234567890.1234567891', price: -0.25, plain: 1.5 })
            const dates = await runner!.executeSelectOneRow(`select date '2024-01-14' as "d", timestamp '2024-01-14 09:15:30.123' as "ts" from dual`, [])
            expect(dates).toEqual({ d: new Date(Date.UTC(2024, 0, 14)), ts: new Date(Date.UTC(2024, 0, 14, 9, 15, 30, 123)) })
            const rows = await runner!.executeSelectManyRows('select level as "n" from dual connect by level <= 3', [])
            expect(rows).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
        } finally {
            oracledb.fetchTypeHandler = previousHandler
            oracledb.fetchAsString = previousAsString
            oracledb.fetchAsBuffer = previousAsBuffer
            oracledb.maxRows = previousMaxRows
        }
    })

    test('a-clob-is-fetched-as-text', async () => {
        const row = await runner!.executeSelectOneRow(`select to_clob('some text') as "c" from dual`, [])
        expect(row).toEqual({ c: 'some text' })
    })
})
