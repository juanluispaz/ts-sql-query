// How MssqlPoolQueryRunner binds each parameter: with the type declared for the
// name of its type in typesByName, then by the category of its type, then by
// the name of its type, and otherwise (a parameter added without them, or a
// custom type) with a type inferred from the JavaScript value. The value read
// back proves the binding.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { TypeCategory } from '../../../src/TypeAdapter.js'
import { TsSqlError } from '../../../src/TsSqlError.js'
import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { MssqlPoolPromiseQueryRunner } from '../../../src/queryRunners/MssqlPoolPromiseQueryRunner.js'
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
        const placeholder = runner!.addParam(params, value, type, typeCategory, false)
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
            const placeholder = runner!.addParam(params, value, '', '', false)
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

    // 30 digits, 10 of them decimals: a decimal(38,10) keeps all of them, a float doesn't
    const exactDecimal = '12345678901234567890.1234567891'

    test('typesByName/an-exact-decimal-bound-as-text-keeps-every-digit', async () => {
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { ExactDecimal: TYPES.NVarChar } })
        await runner!.executeDatabaseSchemaModification('create table rt_exact_decimal (v decimal(38,10) not null)')
        try {
            const insertParams: any[] = []
            const inserted = await declared.executeInsert(`insert into rt_exact_decimal (v) values (${declared.addParam(insertParams, exactDecimal, 'ExactDecimal', 'customDouble', false)})`, insertParams)
            expect(inserted).toBe(1)
            const selectParams: any[] = []
            const placeholder = declared.addParam(selectParams, exactDecimal, 'ExactDecimal', 'customDouble', false)
            const read = await declared.executeSelectManyRows(`select cast(v as nvarchar(50)) as v, cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30)) as boundAs from rt_exact_decimal where v = ${placeholder}`, selectParams)
            expect(read).toEqual([{ v: exactDecimal, boundAs: 'nvarchar' }])

            // Without the declaration, the category binds it as a float, which loses digits
            const floatParams: any[] = []
            const asFloat = await runner!.executeSelectOneColumnOneRow(`select cast(cast(${runner!.addParam(floatParams, exactDecimal, 'ExactDecimal', 'customDouble', false)} as decimal(38,10)) as nvarchar(50))`, floatParams)
            expect(asFloat).not.toBe(exactDecimal)
        } finally {
            await runner!.executeDatabaseSchemaModification('drop table rt_exact_decimal')
        }
    })

    test('typesByName/a-decimal-type-loses-the-digits-of-a-long-exact-decimal', async () => {
        // The driver converts the value of a Decimal parameter to a JS number before sending it, so a long exact decimal
        // loses digits even declared with a scale that holds them; without a scale, Decimal is (18, 0)
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { Wide: TYPES.Decimal(38, 10), Bare: TYPES.Decimal } })
        const sent = async (value: unknown, type: string) => {
            const params: any[] = []
            const placeholder = declared.addParam(params, value, type, 'customDouble', false)
            return await declared.executeSelectOneColumnOneRow(`select cast(${placeholder} as nvarchar(50))`, params)
        }
        expect(await sent(exactDecimal, 'Wide')).not.toBe(exactDecimal)
        expect(await sent('12.56789', 'Bare')).toBe('13')
    })

    test('typesByName/a-type-with-its-arguments', async () => {
        // Decimal(18, 4) rounds to 4 decimals
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { Price: TYPES.Decimal(18, 4) } })
        const params: any[] = []
        const placeholder = declared.addParam(params, 1.23456, 'Price', 'customDouble', false)
        const row = await declared.executeSelectOneRow(`select cast(${placeholder} as nvarchar(50)) as v, cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30)) as boundAs, cast(sql_variant_property(${placeholder}, 'Scale') as int) as scale`, params)
        expect(row).toEqual({ v: '1.2346', boundAs: 'decimal', scale: 4 })
    })

    test('typesByName/the-declared-type-wins-over-the-category-and-applies-to-that-name-only', async () => {
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { int: TYPES.BigInt, Code: TYPES.Decimal(10, 2) } })
        const boundBy = async (value: unknown, type: string, typeCategory: TypeCategory) => {
            const params: any[] = []
            const placeholder = declared.addParam(params, value, type, typeCategory, false)
            return await declared.executeSelectOneColumnOneRow(`select cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30))`, params)
        }
        expect(await boundBy(1, 'int', 'int')).toBe('bigint')
        expect(await boundBy(12, 'Code', 'customInt')).toBe('decimal')
        expect(await boundBy(12, 'Cents', 'customInt')).toBe('int')
    })

    test('typesByName/the-pool-promise-runner-passes-it-on', async () => {
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolPromiseQueryRunner(Promise.resolve(pool!), { typesByName: { ExactDecimal: TYPES.NVarChar } })
        const params: any[] = []
        const placeholder = declared.addParam(params, exactDecimal, 'ExactDecimal', 'customDouble', false)
        expect(await declared.executeSelectOneRow(`select ${placeholder} as v, cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30)) as boundAs`, params)).toEqual({ v: exactDecimal, boundAs: 'nvarchar' })
    })

    test('customDecimal/hand-written-sql-adds-two-parameters-as-numbers', async () => {
        // Bound as nvarchar, two parameters would be concatenated as text: each is cast to a decimal with its digits
        const params: any[] = []
        const first = runner!.addParam(params, exactDecimal, 'Amount', 'customDecimal', false)
        const second = runner!.addParam(params, '0.0000000001', 'Amount', 'customDecimal', false)
        expect([first, second]).toEqual(['cast(@0 as decimal(30, 10))', 'cast(@1 as decimal(11, 10))'])
        expect(await runner!.executeSelectOneColumnOneRow(`select cast(${first} + ${second} as nvarchar(50))`, params)).toBe('12345678901234567890.1234567892')
    })

    test('customDecimal/hand-written-sql-rejects-a-value-beyond-38-digits', () => {
        const params: any[] = []
        let error: unknown
        try {
            runner!.addParam(params, '1'.repeat(39), 'Amount', 'customDecimal', false)
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: '1'.repeat(39), typeName: 'Amount', paramIndex: 0 })
    })

    test('a-statement-without-a-result-set', async () => {
        expect(await runner!.executeSelectManyRows('declare @x int')).toEqual([])
    })
})
