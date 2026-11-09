// The PostgreSQL runners receive the values as the library reads them, whatever the driver was configured with: what
// they set on every query (pg's types, PGlite's parsers) wins over the parsers of the user for the types the library
// reads as dates, the other parsers of the user still apply, and what can't be set per query is rejected when the
// runner is created (pg's binary mode, a postgres.js transform of the results).

import pg from 'pg'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { PgPoolQueryRunner } from '../../../src/queryRunners/PgPoolQueryRunner.js'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { reasonOf } from '../lib/runnerContract.js'

function errorOf(fn: () => unknown): unknown {
    try {
        fn()
    } catch (e) {
        return e
    }
    throw new Error('Expected the call to throw')
}

const SQL = "select '2024-01-14'::date as d, '2024-01-14 09:15:30.123'::timestamp as ts, '0099-01-14 09:15:30'::timestamp as y99, '2024-01-14 18:15:30.123+09'::timestamptz as tstz, '09:15:30.123'::time as t, 42::int8 as i8"
const EXPECTED_DATES = {
    d: new Date(Date.UTC(2024, 0, 14)),
    ts: new Date(Date.UTC(2024, 0, 14, 9, 15, 30, 123)),
    y99: new Date('0099-01-14T09:15:30.000Z'),
    tstz: new Date(Date.UTC(2024, 0, 14, 9, 15, 30, 123)),
    t: '09:15:30.123',
}

describe('PostgreSQL runners: the configuration of the driver', () => {
    test('pg-in-binary-mode-is-rejected', () => {
        // pg reads binary from the configuration of a client or a pool, which its typing doesn't declare
        const uri = 'postgres://user:pwd@127.0.0.1:1/db'
        const binary = { connectionString: uri, binary: true }
        const text = { connectionString: uri, binary: false }
        expect(reasonOf(errorOf(() => new PgQueryRunner(new pg.Client(binary))))).toBe('INVALID_CONFIGURATION')
        expect(reasonOf(errorOf(() => new PgPoolQueryRunner(new pg.Pool(binary))))).toBe('INVALID_CONFIGURATION')
        expect(new PgQueryRunner(new pg.Client(text)).database).toBe('postgreSql')
        expect(new PgPoolQueryRunner(new pg.Pool()).database).toBe('postgreSql')
    })

    test('a-postgres-js-transform-of-the-results-is-rejected', async () => {
        const uri = 'postgres://user:pwd@127.0.0.1:1/db'
        const rejected = [
            postgres(uri, { transform: postgres.camel }),
            postgres(uri, { transform: postgres.toCamel }),
            postgres(uri, { transform: { value: { from: (value: unknown) => value } } }),
            postgres(uri, { transform: { row: { from: (row: any) => row } } }),
        ]
        const accepted = [
            postgres(uri),
            postgres(uri, { transform: { undefined: null } }),
            postgres(uri, { transform: postgres.fromCamel }),
            // In UTC (the suite runs in UTC), infer reads a timestamp right
            postgres(uri, { infer: true }),
        ]
        for (const sql of rejected) {
            expect(reasonOf(errorOf(() => new PostgresQueryRunner(sql)))).toBe('INVALID_CONFIGURATION')
        }
        for (const sql of accepted) {
            expect(new PostgresQueryRunner(sql).database).toBe('postgreSql')
        }
        await Promise.all([...rejected, ...accepted].map(sql => sql.end()))
    })
})

describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'pg'))('pg: the parsers of the user', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
    }, 300_000)
    afterAll(async () => {
        await db?.release()
    }, 300_000)

    test('a-date-and-a-timestamp-are-read-as-utc-and-the-other-parsers-of-the-client-apply', async () => {
        const client = new pg.Client({ connectionString: db!.uri })
        await client.connect()
        try {
            client.setTypeParser(1082, () => 'USER DATE')
            client.setTypeParser(1114, () => 'USER TIMESTAMP')
            client.setTypeParser(20, (value: string) => BigInt(value))
            const row = await new PgQueryRunner(client).executeSelectOneRow(SQL, [])
            expect(row).toEqual({ ...EXPECTED_DATES, i8: 42n })
            // The client keeps its parsers for its own queries
            expect((await client.query(SQL)).rows[0].ts).toBe('USER TIMESTAMP')
        } finally {
            await client.end()
        }
    })

    test('the-types-of-the-pool-apply-to-the-other-types', async () => {
        const types = {
            getTypeParser: (oid: number, format?: any): any => oid === 1114 ? () => 'USER TIMESTAMP' : oid === 20 ? (value: string) => BigInt(value) : pg.types.getTypeParser(oid, format),
        }
        const pool = new pg.Pool({ connectionString: db!.uri, max: 1, types })
        try {
            const row = await new PgPoolQueryRunner(pool).executeSelectOneRow(SQL, [])
            expect(row).toEqual({ ...EXPECTED_DATES, i8: 42n })
        } finally {
            await pool.end()
        }
    })
})

describe.skipIf(!isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'))('PGlite: the parsers of the database', () => {
    test('a-date-a-time-and-a-timestamp-are-read-as-the-library-reads-them-and-the-other-parsers-apply', async () => {
        const { PGlite } = await import('@electric-sql/pglite')
        const db = await PGlite.create('memory://', {
            parsers: { 1082: () => 'USER DATE', 1083: () => 'USER TIME', 1114: () => 'USER TIMESTAMP', 20: (value: string) => 'USER INT8 ' + value },
        })
        try {
            const expected = { ...EXPECTED_DATES, i8: 'USER INT8 42' }
            expect(await new PgLiteQueryRunner(db).executeSelectOneRow(SQL, [])).toEqual(expected)
            // Also on the transaction PGlite gives, which takes the same options
            expect(await db.transaction(tx => new PgLiteQueryRunner(tx).executeSelectOneRow(SQL, []))).toEqual(expected)
            // The database keeps its parsers for its own queries
            expect((await db.query<{ ts: unknown }>(SQL)).rows[0]!.ts).toBe('USER TIMESTAMP')
        } finally {
            await db.close()
        }
    })
})
