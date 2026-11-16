// How MssqlPoolQueryRunner binds each parameter: with the type declared for the
// name of its type in typesByName, then by its type and its type of the user, and
// otherwise (a parameter added without them, or an enum, a custom or a
// ComparableType) with a type inferred from the JavaScript value. The value read
// back proves the binding.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { DataTypeClass } from '../../../src/TypeAdapter.js'
import { TsSqlError } from '../../../src/TsSqlError.js'
import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { MssqlPoolPromiseQueryRunner } from '../../../src/queryRunners/MssqlPoolPromiseQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'
import { addParam, typeNameOf } from '../lib/params.js'
import { ComparableType, DecimalsType, EnumType, EqualableType, IntegersType, LocalDateTimesType, LocalDatesType, LocalTimesType, RealsType, UuidsType } from '../../../src/exports/v2/index.js'
import type { SqlDataType } from '../../../src/TypeAdapter.js'

// The data types of the user the parameters are of, each one a class of the family of its values
abstract class BareType extends RealsType<number, 'Bare'> { static override readonly type = 'Bare' }
abstract class AmountType extends DecimalsType<string, 'Amount'> { static override readonly type = 'Amount' }
abstract class CentsType extends IntegersType<number, 'Cents'> { static override readonly type = 'Cents' }
abstract class CodeType extends IntegersType<number, 'Code'> { static override readonly type = 'Code' }
abstract class CutoffClockType extends LocalTimesType<Date, 'CutoffClock'> { static override readonly type = 'CutoffClock' }
abstract class DownloadsType extends IntegersType<bigint, 'Downloads'> {
    static override readonly type = 'Downloads'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 8 }
}
abstract class ExactDecimalType extends RealsType<number, 'ExactDecimal'> { static override readonly type = 'ExactDecimal' }
abstract class MoneyType extends RealsType<number, 'Money'> { static override readonly type = 'Money' }
abstract class PriceType extends RealsType<number, 'Price'> { static override readonly type = 'Price' }
abstract class ReleaseChannelType extends EqualableType<unknown, 'ReleaseChannel'> { static override readonly type = 'ReleaseChannel' }
abstract class ReleaseDayType extends LocalDatesType<Date, 'ReleaseDay'> { static override readonly type = 'ReleaseDay' }
abstract class SemverType extends ComparableType<unknown, 'Semver'> { static override readonly type = 'Semver' }
abstract class SignOffStampType extends LocalDateTimesType<Date, 'SignOffStamp'> { static override readonly type = 'SignOffStamp' }
abstract class SigningKeyType extends UuidsType<string, 'SigningKey'> { static override readonly type = 'SigningKey' }
abstract class WideType extends RealsType<number, 'Wide'> { static override readonly type = 'Wide' }
abstract class StageType extends EnumType<unknown, 'Stage'> { static override readonly type = 'Stage' }

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
    async function boundAs(value: unknown, type: string | DataTypeClass = ''): Promise<string> {
        const params: any[] = []
        const placeholder = addParam(runner!, params, value, type, false)
        return await runner!.executeQuery('selectOneColumnOneRow', `select cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30))`, params)
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
            const placeholder = addParam(runner!, params, value, '', false)
            expect(await runner!.executeQuery('selectOneColumnOneRow', `select case when ${placeholder} is null then 1 else 0 end`, params)).toBe(1)
        }
    })

    test('the-type-and-the-own-type-decide', async () => {
        const cases: [unknown, string | DataTypeClass, string][] = [
            [1, 'boolean', 'bit'], [1, 'int', 'int'], [1, 'bigint', 'bigint'],
            [1, 'double', 'float'], ['12', 'string', 'nvarchar'],
            ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'uuid', 'uniqueidentifier'], [new Date(), 'localDate', 'date'],
            [new Date(), 'localTime', 'time'], [new Date(), 'localDateTime', 'datetime2'],
            [1, CentsType, 'int'], [10n, DownloadsType, 'bigint'], [1, MoneyType, 'float'],
            ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', SigningKeyType, 'uniqueidentifier'],
            [new Date(), ReleaseDayType, 'date'], [new Date(), CutoffClockType, 'time'],
            [new Date(), SignOffStampType, 'datetime2'],
        ]
        for (const [value, type, expected] of cases) {
            expect([typeNameOf(type), await boundAs(value, type)]).toEqual([typeNameOf(type), expected])
        }
    })

    test('a-own-type-sends-a-text-as-text', async () => {
        const cases: [unknown, string | DataTypeClass, string][] = [
            ['1.2', SemverType, 'nvarchar'], ['12', ReleaseChannelType, 'nvarchar'],
            ['2026-01-02', StageType, 'nvarchar'], [7, 'aCustomTypeName', 'int'], ['constructor', 'constructor', 'nvarchar'],
        ]
        for (const [value, type, expected] of cases) {
            expect([typeNameOf(type), await boundAs(value, type)]).toEqual([typeNameOf(type), expected])
        }
    })

    // 30 digits, 10 of them decimals: a decimal(38,10) keeps all of them, a float doesn't
    const exactDecimal = '12345678901234567890.1234567891'

    test('typesByName/an-exact-decimal-bound-as-text-keeps-every-digit', async () => {
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { ExactDecimal: TYPES.NVarChar } })
        await runner!.executeQuery('executeDatabaseSchemaModification', 'create table rt_exact_decimal (v decimal(38,10) not null)', [])
        try {
            const insertParams: any[] = []
            const inserted = await declared.executeQuery('insert', `insert into rt_exact_decimal (v) values (${addParam(declared, insertParams, exactDecimal, ExactDecimalType, false)})`, insertParams)
            expect(inserted).toBe(1)
            const selectParams: any[] = []
            const placeholder = addParam(declared, selectParams, exactDecimal, ExactDecimalType, false)
            const read = await declared.executeQuery('selectManyRows', `select cast(v as nvarchar(50)) as v, cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30)) as boundAs from rt_exact_decimal where v = ${placeholder}`, selectParams)
            expect(read).toEqual([{ v: exactDecimal, boundAs: 'nvarchar' }])

            // Without the declaration, a RealsType is bound as a float, which loses digits
            const floatParams: any[] = []
            const asFloat = await runner!.executeQuery('selectOneColumnOneRow', `select cast(cast(${addParam(runner!, floatParams, exactDecimal, ExactDecimalType, false)} as decimal(38,10)) as nvarchar(50))`, floatParams)
            expect(asFloat).not.toBe(exactDecimal)
        } finally {
            await runner!.executeQuery('executeDatabaseSchemaModification', 'drop table rt_exact_decimal', [])
        }
    })

    test('typesByName/a-decimal-type-loses-the-digits-of-a-long-exact-decimal', async () => {
        // The driver converts the value of a Decimal parameter to a JS number before sending it, so a long exact decimal
        // loses digits even declared with a scale that holds them; without a scale, Decimal is (18, 0)
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { Wide: TYPES.Decimal(38, 10), Bare: TYPES.Decimal } })
        const sent = async (value: unknown, type: DataTypeClass) => {
            const params: any[] = []
            const placeholder = addParam(declared, params, value, type, false)
            return await declared.executeQuery('selectOneColumnOneRow', `select cast(${placeholder} as nvarchar(50))`, params)
        }
        expect(await sent(exactDecimal, WideType)).not.toBe(exactDecimal)
        expect(await sent('12.56789', BareType)).toBe('13')
    })

    test('typesByName/a-type-with-its-arguments', async () => {
        // Decimal(18, 4) rounds to 4 decimals
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { Price: TYPES.Decimal(18, 4) } })
        const params: any[] = []
        const placeholder = addParam(declared, params, 1.23456, PriceType, false)
        const row = await declared.executeQuery('selectOneRow', `select cast(${placeholder} as nvarchar(50)) as v, cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30)) as boundAs, cast(sql_variant_property(${placeholder}, 'Scale') as int) as scale`, params)
        expect(row).toEqual({ v: '1.2346', boundAs: 'decimal', scale: 4 })
    })

    test('typesByName/the-declared-type-wins-over-the-type-and-applies-to-that-name-only', async () => {
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolQueryRunner(pool!, { typesByName: { int: TYPES.BigInt, Code: TYPES.Decimal(10, 2) } })
        const boundBy = async (value: unknown, type: string | DataTypeClass) => {
            const params: any[] = []
            const placeholder = addParam(declared, params, value, type, false)
            return await declared.executeQuery('selectOneColumnOneRow', `select cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30))`, params)
        }
        expect(await boundBy(1, 'int')).toBe('bigint')
        expect(await boundBy(12, CodeType)).toBe('decimal')
        expect(await boundBy(12, CentsType)).toBe('int')
    })

    test('typesByName/the-pool-promise-runner-passes-it-on', async () => {
        const { TYPES } = db!.mssql
        const declared = new MssqlPoolPromiseQueryRunner(Promise.resolve(pool!), { typesByName: { ExactDecimal: TYPES.NVarChar } })
        const params: any[] = []
        const placeholder = addParam(declared, params, exactDecimal, ExactDecimalType, false)
        expect(await declared.executeQuery('selectOneRow', `select ${placeholder} as v, cast(sql_variant_property(${placeholder}, 'BaseType') as nvarchar(30)) as boundAs`, params)).toEqual({ v: exactDecimal, boundAs: 'nvarchar' })
    })

    test('ownDecimal/hand-written-sql-adds-two-parameters-as-numbers', async () => {
        // Bound as nvarchar, two parameters would be concatenated as text: each is cast to a decimal with its digits
        const params: any[] = []
        const first = addParam(runner!, params, exactDecimal, AmountType, false)
        const second = addParam(runner!, params, '0.0000000001', AmountType, false)
        expect([first, second]).toEqual(['cast(@0 as decimal(30, 10))', 'cast(@1 as decimal(11, 10))'])
        expect(await runner!.executeQuery('selectOneColumnOneRow', `select cast(${first} + ${second} as nvarchar(50))`, params)).toBe('12345678901234567890.1234567892')
    })

    test('ownDecimal/hand-written-sql-rejects-a-value-beyond-38-digits', () => {
        const params: any[] = []
        let error: unknown
        try {
            addParam(runner!, params, '1'.repeat(39), AmountType, false)
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: '1'.repeat(39), typeName: 'Amount', paramIndex: 0 })
    })

    test('a-statement-without-a-result-set', async () => {
        expect(await runner!.executeQuery('selectManyRows', 'declare @x int', [])).toEqual([])
    })
})
