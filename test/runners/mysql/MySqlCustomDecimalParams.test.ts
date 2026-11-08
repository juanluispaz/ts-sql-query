// A customDecimal parameter added by hand to a query written by hand, on every MySQL query runner (mysql2, its pool,
// Bun SQL): it is cast to a decimal with the digits of the value, so the database computes with every digit instead
// of a double, and a value beyond decimal(65, 30) is rejected before anything is sent.

import mysql2 from 'mysql2'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { TsSqlError } from '../../../src/TsSqlError.js'
import { MySql2QueryRunner } from '../../../src/queryRunners/MySql2QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'

// 30 digits, 10 of them decimals: a double keeps about 16
const exact = '12345678901234567890.1234567891'

describe.skipIf(!isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'))('MySQL query runners: a customDecimal parameter in hand-written SQL', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: mysql2.Connection | undefined
    let runner: MySql2QueryRunner | undefined

    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        connection = mysql2.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
        runner = new MySql2QueryRunner(connection)
    }, 300_000)
    afterAll(async () => {
        await new Promise<void>(resolve => connection ? connection.end(() => resolve()) : resolve())
        await db?.release()
    }, 300_000)

    test('computes-with-every-digit', async () => {
        const params: any[] = []
        const placeholder = runner!.addParam(params, exact, 'Amount', 'customDecimal', false)
        expect(placeholder).toBe('cast(? as decimal(30, 10))')
        expect(await runner!.executeSelectOneColumnOneRow(`select cast(${placeholder} + 0 as char)`, params)).toBe(exact)
    })

    test('a-value-beyond-the-widest-decimal-is-rejected', () => {
        const params: any[] = []
        let error: unknown
        try {
            runner!.addParam(params, '1.' + '1'.repeat(31), 'Amount', 'customDecimal', false)
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: '1.' + '1'.repeat(31), typeName: 'Amount', paramIndex: 0 })
        expect(params).toEqual([])
    })
})
