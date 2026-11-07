// How MssqlPoolQueryRunner binds each parameter: by the category of its type,
// then by the name of its type, and otherwise (a parameter added without them,
// or a custom type) with a type inferred from the JavaScript value. The value
// read back proves the binding.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { TypeCategory } from '../../../src/TypeAdapter.js'
import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'

describe.skipIf(!isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'))('MssqlPoolQueryRunner: parameter types', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let pool: import('mssql').ConnectionPool | undefined
    let runner: QueryRunner | undefined

    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        pool = await new db.mssql.ConnectionPool({ ...db.config, pool: { max: 2, min: 0 } }).connect()
        runner = new MssqlPoolQueryRunner(pool)
    }, 300_000)
    afterAll(async () => {
        await pool?.close()
        await db?.release()
    }, 300_000)

    // The base type SQL Server bound the parameter with.
    async function boundAs(value: unknown, type: string = '', typeCategory: TypeCategory = ''): Promise<string> {
        const params: any[] = []
        const placeholder = runner!.addParam(params, value, type, typeCategory)
        return await runner!.executeSelectOneColumnOneRow(`select cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30))`, params)
    }

    test('inferred-from-the-value', async () => {
        const localDate = Object.assign(new Date(Date.UTC(2026, 0, 2)), { ___type___: 'localDate' })
        const localTime = Object.assign(new Date(Date.UTC(1970, 0, 1, 10, 30)), { ___type___: 'localTime' })
        const localDateTime = Object.assign(new Date(), { ___type___: 'localDateTime' })
        const cases: [unknown, string][] = [
            [1, 'int'], [1.5, 'float'], [10n, 'bigint'], [true, 'bit'], [[3], 'int'],
            [new Date(), 'datetime2'], [localDate, 'date'], [localTime, 'time'], [localDateTime, 'datetime2'],
            ['12', 'int'], ['12345678901', 'bigint'], ['1.5', 'float'], ['2026-01-02', 'date'], ['10:30:00', 'nvarchar'],
            ['2026-01-02 10:30:00', 'datetime2'], ['2026-01-02T10:30:00', 'datetime2'],
            ['2026-01-02 10:30:00+01:00', 'datetimeoffset'], ['2026-01-02T10:30:00Z', 'datetimeoffset'],
            ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'uniqueidentifier'], ['text', 'nvarchar'],
            [Buffer.from([1, 2]), 'varbinary'],
        ]
        for (const [value, expected] of cases) {
            expect([value, await boundAs(value)]).toEqual([value, expected])
        }
    })

    test('a-null-without-a-data-type', async () => {
        for (const value of [null, undefined]) {
            const params: any[] = []
            const placeholder = runner!.addParam(params, value, '', '')
            expect(await runner!.executeSelectOneColumnOneRow(`select case when ${placeholder} is null then 1 else 0 end`, params)).toBe(1)
        }
    })

    test('the-category-of-the-type-wins', async () => {
        const cases: [unknown, string, TypeCategory, string][] = [
            [1, 'boolean', 'boolean', 'bit'], [1, 'int', 'int', 'int'], [1, 'bigint', 'bigint', 'bigint'],
            [1, 'double', 'double', 'float'], ['12', 'string', 'string', 'nvarchar'],
            ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'uuid', 'uuid', 'uniqueidentifier'], [new Date(), 'localDate', 'localDate', 'date'],
            [new Date(), 'localTime', 'localTime', 'time'], [new Date(), 'localDateTime', 'localDateTime', 'datetime2'],
            [1, 'Cents', 'customInt', 'int'], [10n, 'Downloads', 'customBigint', 'bigint'], [1, 'Money', 'customDouble', 'float'],
            ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'SigningKey', 'customUuid', 'uniqueidentifier'],
            [new Date(), 'ReleaseDay', 'customLocalDate', 'date'], [new Date(), 'CutoffClock', 'customLocalTime', 'time'],
            [new Date(), 'SignOffStamp', 'customLocalDateTime', 'datetime2'],
        ]
        for (const [value, type, typeCategory, expected] of cases) {
            expect([type, await boundAs(value, type, typeCategory)]).toEqual([type, expected])
        }
    })

    test('without-a-category-the-name-of-the-type-decides', async () => {
        const cases: [unknown, string, string][] = [
            [1, 'boolean', 'bit'], ['12', 'stringInt', 'bigint'], ['1.5', 'stringDouble', 'float'], [1, 'double', 'float'],
            ['12', 'string', 'nvarchar'],
        ]
        for (const [value, type, expected] of cases) {
            expect([type, await boundAs(value, type)]).toEqual([type, expected])
        }
    })

    test('a-custom-type-sends-a-text-as-text', async () => {
        const cases: [unknown, string, TypeCategory, string][] = [
            ['1.2', 'Semver', 'customComparable', 'nvarchar'], ['12', 'ReleaseChannel', 'custom', 'nvarchar'],
            ['2026-01-02', 'Stage', 'enum', 'nvarchar'], [7, 'aCustomTypeName', '', 'int'], ['constructor', 'constructor', '', 'nvarchar'],
        ]
        for (const [value, type, typeCategory, expected] of cases) {
            expect([type, await boundAs(value, type, typeCategory)]).toEqual([type, expected])
        }
    })

    test('a-statement-without-a-result-set', async () => {
        expect(await runner!.executeSelectManyRows('declare @x int')).toEqual([])
    })
})
