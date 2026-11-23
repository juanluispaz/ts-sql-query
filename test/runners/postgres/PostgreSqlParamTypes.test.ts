// How the PostgreSQL query runners give the database the type of a parameter
// the library asks it for (forceTypeCast): pg and Bun SQL can't send a typed
// parameter, and write the type as a cast in the placeholder (`$1::int4`);
// postgres.js and PGlite send the parameter with the oid of its type, and leave
// the placeholder bare. pg_typeof shows the type the engine resolved. postgres.js
// and PGlite take driverTypeOf, for a type the library doesn't know, like an enum
// of the database, whose oid is its own in each database: the oid (or, on
// postgres.js, the parameter) it gives is sent with the parameter in every
// position.

import pg from 'pg'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import type { SqlDataType } from '../../../src/TypeAdapter.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import type { DataTypeClass } from '../../../src/TypeAdapter.js'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { PgPoolQueryRunner } from '../../../src/queryRunners/PgPoolQueryRunner.js'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { addParam, typeNameOf } from '../lib/params.js'
import { ComparableType, EnumType, EqualableType, IntegersType, LocalDateType } from '../../../src/exports/v2/index.js'

// The data types of the user the parameters are of, each one a class of the family of its values
abstract class BigType extends EqualableType<unknown, 'Big'> { static override readonly type = 'Big' }
abstract class CentsType extends IntegersType<number, 'Cents'> { static override readonly type = 'Cents' }
abstract class MoodType extends EnumType<'happy' | 'sad', 'Mood'> { static override readonly type = 'Mood'; static override readonly values = ['happy', 'sad'] as const }
// An enum of the database whose class says its SQL data type: the native name of a type the library doesn't know. It
// takes any value (values null), so a value the enum of the database doesn't have reaches the database
abstract class FeelingType extends EnumType<'happy' | 'sad', 'Feeling'> {
    static override readonly type = 'Feeling'
    static override readonly values = null
    static override readonly sqlDataType: SqlDataType = { family: 'user-defined', name: 'rt_feeling' }
}
class FeelingConnection extends PostgreSqlConnection<'FeelingConnection'> {}
abstract class RatioType extends ComparableType<unknown, 'Ratio'> { static override readonly type = 'Ratio' }
abstract class StatusType extends EnumType<unknown, 'Status'> { static override readonly type = 'Status'; static override readonly values = null }

const isBun = typeof globalThis.Bun !== 'undefined'

interface Runners {
    plain: QueryRunner
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

        test('a-type-the-library-does-not-know-is-cast-with-the-native-name-of-its-sql-data-type', async () => {
            // pg and Bun SQL write the cast of a constant selected on its own with the native name of the SQL data type of
            // its class, here an enum of the database: a value the enum doesn't have is rejected. postgres.js and PGlite
            // send the oid of a type only when it is fixed, which the one of an enum isn't: it goes untyped, as a text
            const r = runners!.plain
            await r.executeQuery('executeDatabaseSchemaModification', 'drop type if exists rt_feeling', [])
            await r.executeQuery('executeDatabaseSchemaModification', "create type rt_feeling as enum ('happy', 'sad')", [])
            const conn = new FeelingConnection(r)
            const happy = conn.selectFromNoTable().selectOneColumn(conn.const('happy', FeelingType))
            expect(happy.query()).toBe(typesTheParam ? 'select $1 as result' : 'select $1::rt_feeling as result')
            expect(await happy.executeSelectOne()).toBe('happy')
            const other = conn.selectFromNoTable().selectOneColumn(conn.const('other' as 'happy', FeelingType))
            let error: unknown
            try {
                await other.executeSelectOne()
            } catch (e) {
                error = e
            }
            expect(error === undefined).toBe(typesTheParam)
        })

        test('a-param-compared-with-a-column-goes-untyped', async () => {
            const params: any[] = []
            const placeholder = addParam(runners!.plain, params, 1, 'int', false)
            expect(placeholder).toBe('$1')
            expect(await runners!.plain.executeQuery('selectOneColumnOneRow', `select name from organization where id = ${placeholder}`, params)).toBe('Acme Corp')
        })

        test('the-params-of-the-query-are-not-changed', async () => {
            const params: any[] = []
            const placeholder = addParam(runners!.plain, params, 7, 'int', true)
            const day = addParam(runners!.plain, params, new Date(Date.UTC(2024, 0, 15)), 'localDate', false)
            await runners!.plain.executeQuery('selectOneRow', `select ${placeholder} as a, ${day}::text as b`, params)
            expect(params).toEqual([7, new Date(Date.UTC(2024, 0, 15))])
        })

        test('a-typed-param-inside-a-transaction', async () => {
            const r = runners!.plain
            const type = await r.executeInTransaction(() => {
                const params: any[] = []
                return r.executeQuery('selectOneColumnOneRow', `select pg_typeof(${addParam(r, params, 7, 'int', true)})::text`, params)
            }, r)
            expect(type).toBe('integer')
        })
    })
}

describeParamTypes('PgQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'pg'), false, async () => {
    const db = await acquireRunnerTestDatabase()
    const client = new pg.Client({ connectionString: db.uri })
    await client.connect()
    return {
        plain: new PgQueryRunner(client),
        close: async () => { await client.end(); await db.release() },
    }
})

describeParamTypes('PgPoolQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'pg'), false, async () => {
    const db = await acquireRunnerTestDatabase()
    const pool = new pg.Pool({ connectionString: db.uri, max: 2 })
    return {
        plain: new PgPoolQueryRunner(pool),
        close: async () => { await pool.end(); await db.release() },
    }
})

describeParamTypes('PostgresQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'), true, async () => {
    const db = await acquireRunnerTestDatabase()
    const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
    return {
        plain: new PostgresQueryRunner(sql),
        close: async () => { await sql.end(); await db.release() },
    }
})

describeParamTypes('PgLiteQueryRunner', isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'), true, async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const db = await PGlite.create('memory://')
    await db.exec("create table organization (id int primary key, name text not null); insert into organization values (1, 'Acme Corp')")
    return {
        plain: new PgLiteQueryRunner(db),
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
        close: async () => { await sql.close(); await db.release() },
    }
})

// An enum of the database: the library doesn't know its oid, which is its own in each database. The query runners that
// send the parameter with its type take it from driverTypeOf, and send it so in every position; without it, a parameter
// the library doesn't ask the type of goes untyped, and PostgreSQL can't work out its type where nothing gives it one.
interface DriverTypeOfRunners {
    // driverTypeOf gives the oid of the enum to a Mood
    byOid: QueryRunner
    // driverTypeOf gives the parameter itself, typed with that oid (postgres.js)
    byParameter: QueryRunner | undefined
    plain: QueryRunner
    close(): Promise<void>
}

const createMoodType = "drop type if exists rt_mood; create type rt_mood as enum ('happy', 'sad')"

function describeDriverTypeOf(label: string, enabled: boolean, create: () => Promise<DriverTypeOfRunners>): void {
    describe.skipIf(!enabled)(label + ': driverTypeOf', () => {
        let runners: DriverTypeOfRunners | undefined
        beforeAll(async () => { runners = await create() }, 300_000)
        afterAll(async () => { await runners?.close() }, 300_000)

        async function resolvedType(r: QueryRunner): Promise<{ placeholder: string, type: unknown }> {
            const params: any[] = []
            const placeholder = r.addParam(params, 'happy', MoodType)
            return { placeholder, type: await r.executeQuery('selectOneColumnOneRow', `select pg_typeof(${placeholder})::text`, params) }
        }

        test('driverTypeOf/an-enum-of-the-database-is-sent-with-its-oid', async () => {
            expect(await resolvedType(runners!.byOid)).toEqual({ placeholder: '$1', type: 'rt_mood' })
            // Without it, the parameter goes untyped, and PostgreSQL can't work its type out there
            let error: unknown
            try {
                await resolvedType(runners!.plain)
            } catch (e) {
                error = e
            }
            expect(String(error)).toMatch(/could not determine data type of parameter \$1/)
        })

        test('driverTypeOf/the-parameter-it-gives-is-sent', async () => {
            if (runners!.byParameter) {
                expect(await resolvedType(runners!.byParameter)).toEqual({ placeholder: '$1', type: 'rt_mood' })
            }
        })

        test('driverTypeOf/a-parameter-of-another-type-is-sent-as-the-library-does', async () => {
            const params: any[] = []
            const placeholder = addParam(runners!.byOid, params, 7, 'int', true)
            expect(await runners!.byOid.executeQuery('selectOneColumnOneRow', `select pg_typeof(${placeholder})::text`, params)).toBe('integer')
        })
    })
}

/** The oid of the enum rt_mood, created in the database */
async function moodOid(r: QueryRunner): Promise<number> {
    await r.executeQuery('executeDatabaseSchemaModification', createMoodType, [])
    return Number(await r.executeQuery('selectOneColumnOneRow', "select oid from pg_type where typname = 'rt_mood'", []))
}

describeDriverTypeOf('PostgresQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'), async () => {
    const db = await acquireRunnerTestDatabase()
    const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
    const plain = new PostgresQueryRunner(sql)
    const oid = await moodOid(plain)
    return {
        byOid: new PostgresQueryRunner(sql, { driverTypeOf: (param) => param.requestedType === MoodType ? oid : undefined }),
        byParameter: new PostgresQueryRunner(sql, { driverTypeOf: (param, value) => param.requestedType === MoodType ? sql.typed(value as string, oid) : undefined }),
        plain,
        close: async () => { await sql.end(); await db.release() },
    }
})

describeDriverTypeOf('PgLiteQueryRunner', isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'), async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const db = await PGlite.create('memory://')
    const plain = new PgLiteQueryRunner(db)
    const oid = await moodOid(plain)
    return {
        byOid: new PgLiteQueryRunner(db, { driverTypeOf: (param) => param.requestedType === MoodType ? oid : undefined }),
        byParameter: undefined,
        plain,
        close: async () => { await db.close() },
    }
})
