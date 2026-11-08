// OracleDBQueryRunner reads the expected type of each result column on the params: a column expected as a
// customDecimal is fetched as text, with every digit, where oracledb would give a JavaScript number. The other columns
// keep what oracledb gives them, also with a global oracledb.fetchTypeHandler of the application.

import oracledb from 'oracledb'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryResultColumn, QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { OracleDBQueryRunner } from '../../../src/queryRunners/OracleDBQueryRunner.js'
import { setQueryResultColumns } from '../../../src/utils/queryParamsMetadata.js'
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
        setQueryResultColumns(params, columns)
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

    test('the-global-fetch-type-handler-still-decides-for-the-other-columns', async () => {
        const previous = oracledb.fetchTypeHandler
        oracledb.fetchTypeHandler = (metadata) => metadata.name === 'plain' || metadata.name === 'amount' ? { converter: (value: unknown) => 'global ' + String(value) } : undefined
        try {
            const row = await runner!.executeSelectOneRow(sql, paramsExpecting([decimal('amount'), double('price'), double('plain')]))
            expect(row).toEqual({ amount: '12345678901234567890.1234567891', price: -0.25, plain: 'global 1.5' })
        } finally {
            oracledb.fetchTypeHandler = previous
        }
    })
})
