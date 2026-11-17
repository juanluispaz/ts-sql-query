// How the PostgreSQL query runners give the database the type of a parameter
// the library asks it for (forceTypeCast): pg and Bun SQL can't send a typed
// parameter, and write the type as a cast in the placeholder (`$1::int4`);
// postgres.js and PGlite send the parameter with the oid of its type, and leave
// the placeholder bare. pg_typeof shows the type the engine resolved. Each one
// takes typesByName: the cast (pg, Bun SQL) written where the library asks for
// the type, or the oid (postgres.js, PGlite; also a function giving the
// parameter on postgres.js) sent with every parameter of that type name.

import pg from 'pg'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import type { DataTypeClass } from '../../../src/TypeAdapter.js'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { PgPoolQueryRunner } from '../../../src/queryRunners/PgPoolQueryRunner.js'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { addParam, typeNameOf } from '../lib/params.js'
import { ComparableType, EnumType, EqualableType, IntegersType, LocalDateType, RealsType } from '../../../src/exports/v2/index.js'

// The data types of the user the parameters are of, each one a class of the family of its values
abstract class BigType extends EqualableType<unknown, 'Big'> { static override readonly type = 'Big' }
abstract class CentsType extends IntegersType<number, 'Cents'> { static override readonly type = 'Cents' }
abstract class ExactDecimalType extends RealsType<number, 'ExactDecimal'> { static override readonly type = 'ExactDecimal' }
abstract class RatioType extends ComparableType<unknown, 'Ratio'> { static override readonly type = 'Ratio' }
abstract class StatusType extends EnumType<unknown, 'Status'> { static override readonly type = 'Status' }

const isBun = typeof globalThis.Bun !== 'undefined'

// 30 digits, 10 of them decimals: a numeric keeps all of them, a float8 doesn't
const exactDecimal = '12345678901234567890.1234567891'

interface Runners {
    // Without typesByName
    plain: QueryRunner
    // With typesByName: { ExactDecimal: <numeric> }
    declared: QueryRunner
    close(): Promise<void>
}

function describeParamTypes(label: string, enabled: boolean, typesTheParam: boolean, create: () => Promise<Runners>): void {
    describe.skipIf(!enabled)(label + ': parameter types', () => {
        let runners: Runners | undefined
        beforeAll(async () => { runners = await create() }, 300_000)
        afterAll(async () => { await runners?.close() }, 300_000)

        async function resolvedType(r: QueryRunner, value: unknown, type: string | DataTypeClass, forceTypeCast: boolean): Promise<{ placeholder: string, type: string }> {
            const params: any[] = []
            const placeholder = addParam(r, params, value, type, forceTypeCast)
            expect(getQueryContext('', params).getParam(0)?.forceTypeCast).toBe(forceTypeCast)
            return { placeholder, type: await r.executeQuery('selectOneColumnOneRow', `select pg_typeof(${placeholder})::text`, params) }
        }

        test('a-param-the-library-asks-the-type-of', async () => {
            const cases: [unknown, string | DataTypeClass, string, string][] = [
                [7, 'int', 'int4', 'integer'],
                [9007199254740993n, 'bigint', 'int8', 'bigint'],
                [1.5, 'double', 'float8', 'double precision'],
                ['abc', 'string', 'text', 'text'],
                [true, 'boolean', 'bool', 'boolean'],
                ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'uuid', 'uuid', 'uuid'],
                [new Date(Date.UTC(2024, 0, 15)), 'localDate', 'date', 'date'],
                [new Date(Date.UTC(2024, 0, 15, 10, 30)), 'localDateTime', 'timestamp', 'timestamp without time zone'],
                [null, 'int', 'int4', 'integer'],
                [null, 'localDate', 'date', 'date'],
                [7, CentsType, 'int4', 'integer'],
                // The type of the value of an enum, a type of the user without a SQL data type or a value without a built-in type
                [5, StatusType, 'int4', 'integer'],
                [5000000000, BigType, 'int8', 'bigint'],
                [2.5, RatioType, 'float8', 'double precision'],
            ]
            for (const [value, type, cast, expected] of cases) {
                const resolved = await resolvedType(runners!.plain, value, type, true)
                expect([typeNameOf(type), value, resolved]).toEqual([typeNameOf(type), value, { placeholder: typesTheParam ? '$1' : '$1::' + cast, type: expected }])
            }
        })

        test('hand-written-sql/the-type-given-to-addParam-sends-a-date-as-a-date', async () => {
            // SQL written by hand: the parameter has no context until addParam gives it one with its type
            const day = new Date(Date.UTC(2024, 0, 15))
            const typed: any[] = []
            const placeholder = runners!.plain.addParam(typed, day, 'localDate')
            expect(getQueryContext('', typed).getParam(0)?.requestedType).toBe(LocalDateType)
            expect(await runners!.plain.executeQuery('selectOneColumnOneRow', `select ${placeholder}::text`, typed)).toBe('2024-01-15')
            const untyped: any[] = []
            const untypedPlaceholder = runners!.plain.addParam(untyped, day, undefined)
            expect(getQueryContext('', untyped).getParam(0)).toBeUndefined()
            expect(await runners!.plain.executeQuery('selectOneColumnOneRow', `select ${untypedPlaceholder}::text`, untyped)).not.toBe('2024-01-15')
        })

        test('a-forced-param-without-a-postgresql-type-goes-untyped', async () => {
            // A text of an enum has no type: PostgreSQL resolves it from where it's written
            const params: any[] = []
            const placeholder = addParam(runners!.plain, params, 'Acme Corp', StatusType, true)
            expect(placeholder).toBe('$1')
            expect(await runners!.plain.executeQuery('selectOneColumnOneRow', `select id from organization where name = ${placeholder}`, params)).toBe(1)
        })

        test('a-param-compared-with-a-column-goes-untyped', async () => {
            const params: any[] = []
            const placeholder = addParam(runners!.plain, params, 1, 'int', false)
            expect(placeholder).toBe('$1')
            expect(await runners!.plain.executeQuery('selectOneColumnOneRow', `select name from organization where id = ${placeholder}`, params)).toBe('Acme Corp')
        })

        test('the-params-of-the-query-are-not-changed', async () => {
            const params: any[] = []
            const placeholder = addParam(runners!.declared, params, 7, 'int', true)
            const decimal = addParam(runners!.declared, params, exactDecimal, ExactDecimalType, false)
            await runners!.declared.executeQuery('selectOneRow', `select ${placeholder} as a, ${decimal}::text as b`, params)
            expect(params).toEqual([7, exactDecimal])
        })

        test('a-typed-param-inside-a-transaction', async () => {
            const r = runners!.plain
            const type = await r.executeInTransaction(() => {
                const params: any[] = []
                return r.executeQuery('selectOneColumnOneRow', `select pg_typeof(${addParam(r, params, 7, 'int', true)})::text`, params)
            }, r)
            expect(type).toBe('integer')
        })

        test('typesByName/an-exact-decimal-keeps-every-digit', async () => {
            const r = runners!.declared
            const params: any[] = []
            const placeholder = addParam(r, params, exactDecimal, ExactDecimalType, true)
            expect(placeholder).toBe(typesTheParam ? '$1' : '$1::numeric')
            expect(await r.executeQuery('selectOneRow', `select (${placeholder})::text as v, pg_typeof(${placeholder})::text as t`, params)).toEqual({ v: exactDecimal, t: 'numeric' })

            // Without the declaration, a RealsType gets the type of a double, which loses digits
            const plainParams: any[] = []
            const asDouble = await runners!.plain.executeQuery('selectOneColumnOneRow', `select (${addParam(runners!.plain, plainParams, exactDecimal, ExactDecimalType, true)})::text`, plainParams)
            expect(asDouble).not.toBe(exactDecimal)
        })

        test('typesByName/inserted-into-and-compared-with-a-numeric-column', async () => {
            const r = runners!.declared
            await r.executeQuery('executeDatabaseSchemaModification', 'create table rt_exact_decimal (v numeric(38,10) not null)', [])
            try {
                const insertParams: any[] = []
                expect(await r.executeQuery('insert', `insert into rt_exact_decimal (v) values (${addParam(r, insertParams, exactDecimal, ExactDecimalType, false)})`, insertParams)).toBe(1)
                const params: any[] = []
                const placeholder = addParam(r, params, exactDecimal, ExactDecimalType, true)
                expect(await r.executeQuery('selectManyRows', `select v::text as v from rt_exact_decimal where v = ${placeholder}`, params)).toEqual([{ v: exactDecimal }])
            } finally {
                await r.executeQuery('executeDatabaseSchemaModification', 'drop table rt_exact_decimal', [])
            }
        })

        test('typesByName/a-param-the-library-does-not-ask-the-type-of', async () => {
            // The cast is written only where the library asks for the type; a typed param is sent typed everywhere
            const params: any[] = []
            const placeholder = addParam(runners!.declared, params, exactDecimal, ExactDecimalType, false)
            expect(placeholder).toBe('$1')
            if (typesTheParam) {
                expect(await runners!.declared.executeQuery('selectOneColumnOneRow', `select pg_typeof(${placeholder})::text`, params)).toBe('numeric')
            }
        })
    })
}

describeParamTypes('PgQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'pg'), false, async () => {
    const db = await acquireRunnerTestDatabase()
    const client = new pg.Client({ connectionString: db.uri })
    await client.connect()
    return {
        plain: new PgQueryRunner(client),
        declared: new PgQueryRunner(client, { typesByName: { ExactDecimal: 'numeric' } }),
        close: async () => { await client.end(); await db.release() },
    }
})

describeParamTypes('PgPoolQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'pg'), false, async () => {
    const db = await acquireRunnerTestDatabase()
    const pool = new pg.Pool({ connectionString: db.uri, max: 2 })
    return {
        plain: new PgPoolQueryRunner(pool),
        declared: new PgPoolQueryRunner(pool, { typesByName: { ExactDecimal: 'numeric' } }),
        close: async () => { await pool.end(); await db.release() },
    }
})

describeParamTypes('PostgresQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'), true, async () => {
    const db = await acquireRunnerTestDatabase()
    const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
    return {
        plain: new PostgresQueryRunner(sql),
        declared: new PostgresQueryRunner(sql, { typesByName: { ExactDecimal: 1700 } }),
        close: async () => { await sql.end(); await db.release() },
    }
})

// A type declared in the types option of postgres.js, given by a function
describeParamTypes('PostgresQueryRunner (a type of the types option)', isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'), true, async () => {
    const db = await acquireRunnerTestDatabase()
    const sql = postgres(db.uri, {
        max: 2,
        onnotice: () => {},
        types: { exact: { to: 1700, from: [1700], serialize: (value: string) => value, parse: (value: string) => value } },
    })
    return {
        plain: new PostgresQueryRunner(sql),
        declared: new PostgresQueryRunner(sql, { typesByName: { ExactDecimal: (value: string) => sql.typed.exact(value) } }),
        close: async () => { await sql.end(); await db.release() },
    }
})

describeParamTypes('PgLiteQueryRunner', isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'), true, async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const db = await PGlite.create('memory://')
    await db.exec("create table organization (id int primary key, name text not null); insert into organization values (1, 'Acme Corp')")
    return {
        plain: new PgLiteQueryRunner(db),
        declared: new PgLiteQueryRunner(db, { typesByName: { ExactDecimal: 1700 } }),
        close: async () => { await db.close() },
    }
})

describeParamTypes('BunSqlPostgresQueryRunner', isBun && isRealDbEnabled('postgres', 'docker', 'newest', 'bun_sql_postgres'), false, async () => {
    const { BunSqlPostgresQueryRunner } = await import('../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
    const db = await acquireRunnerTestDatabase()
    const { SQL } = await import('bun')
    const sql = new SQL(db.uri, { max: 2 })
    return {
        plain: new BunSqlPostgresQueryRunner(sql),
        declared: new BunSqlPostgresQueryRunner(sql, { typesByName: { ExactDecimal: 'numeric' } }),
        close: async () => { await sql.close(); await db.release() },
    }
})
