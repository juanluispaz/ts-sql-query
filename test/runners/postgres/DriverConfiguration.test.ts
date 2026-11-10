// The PostgreSQL runners receive the values as the library reads them, whatever the driver was configured with: what
// they set on every query (pg's types, PGlite's parsers) wins over the parsers of the user for the types the library
// reads as dates, the other parsers of the user still apply, and what can't be set per query is rejected when the
// runner is created (pg's binary mode, a postgres.js transform of the results, a session put in a zone other than the
// zone of the database, taken as UTC).

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

    test('a-session-in-another-zone-than-the-database-is-rejected', async () => {
        // The database is taken as UTC: a session the configuration puts in another zone is rejected, one it leaves
        // unset (in the zone of the database) or puts in UTC is accepted
        const uri = 'postgres://user:pwd@127.0.0.1:1/db'
        const madrid = '-c TimeZone=Europe/Madrid'
        const rejectedPg = [
            { connectionString: uri, options: madrid },
            { connectionString: uri, options: '-c statement_timeout=30s --timezone=Europe/Madrid' },
            { connectionString: uri + '?options=' + encodeURIComponent(madrid) },
            { connectionString: uri, options: '-c TimeZone=UTC -c timezone=Europe/Madrid' },
        ]
        const acceptedPg = [
            { connectionString: uri },
            { connectionString: uri, options: '-c TimeZone=UTC' },
            { connectionString: uri, options: '-c TimeZone=Etc/UTC' },
            { connectionString: uri, options: '-c TimeZone=+00:00' },
            { connectionString: uri, options: '-c statement_timeout=30s' },
            { connectionString: uri, options: '-c TimeZone=Europe/Madrid -c TimeZone=UTC' },
        ]
        for (const config of rejectedPg) {
            expect(reasonOf(errorOf(() => new PgQueryRunner(new pg.Client(config))))).toBe('INVALID_CONFIGURATION')
        }
        for (const config of acceptedPg) {
            expect(new PgQueryRunner(new pg.Client(config)).database).toBe('postgreSql')
        }
        // A pool is checked with the configuration it was given (its clients, with the rest)
        expect(reasonOf(errorOf(() => new PgPoolQueryRunner(new pg.Pool({ connectionString: uri, options: madrid }))))).toBe('INVALID_CONFIGURATION')
        expect(new PgPoolQueryRunner(new pg.Pool({ connectionString: uri, options: '-c TimeZone=UTC' })).database).toBe('postgreSql')
        // PGOPTIONS, which pg reads when the client is created
        const previous = process.env['PGOPTIONS']
        process.env['PGOPTIONS'] = madrid
        try {
            expect(reasonOf(errorOf(() => new PgQueryRunner(new pg.Client({ connectionString: uri }))))).toBe('INVALID_CONFIGURATION')
        } finally {
            if (previous === undefined) {
                delete process.env['PGOPTIONS']
            } else {
                process.env['PGOPTIONS'] = previous
            }
        }

        const rejected = [
            postgres(uri, { connection: { TimeZone: 'Europe/Madrid' } }),
            postgres(uri, { connection: { timezone: 'Europe/Madrid' } }),
            postgres(uri, { connection: { options: madrid } }),
            postgres(uri + '?TimeZone=Europe%2FMadrid'),
        ]
        const accepted = [
            postgres(uri, { connection: { TimeZone: 'UTC' } }),
            postgres(uri, { connection: { application_name: 'app' } }),
            postgres(uri + '?TimeZone=UTC'),
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

describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'pg'))('pg: the zone of the session', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
    }, 300_000)
    afterAll(async () => {
        await db?.release()
    }, 300_000)

    test('a-pool-whose-connection-string-puts-the-session-in-another-zone-is-rejected-at-its-first-query', async () => {
        // The options of the connection string reach only the clients of the pool: the first query is rejected, and
        // the client goes back to the pool
        const uri = db!.uri + (db!.uri.includes('?') ? '&' : '?') + 'options=' + encodeURIComponent('-c TimeZone=Europe/Madrid')
        const pool = new pg.Pool({ connectionString: uri, max: 1 })
        try {
            // The setting is real: the session of this pool is in Europe/Madrid, and the current date and time of the
            // database come in it, not in the zone of the database (UTC)
            const raw = (await pool.query("select current_setting('TimeZone') as tz, extract(timezone from now()) <> 0 as moved")).rows[0]
            expect(raw).toEqual({ tz: 'Europe/Madrid', moved: true })
            const runner = new PgPoolQueryRunner(pool)
            let error: unknown
            try {
                await runner.executeSelectOneRow('select localtimestamp as ts', [])
            } catch (e) {
                error = e
            }
            expect(reasonOf(error)).toBe('INVALID_CONFIGURATION')
            // With max: 1, a query of the pool works only if the client was given back
            expect((await pool.query('select 1 as one')).rows[0]).toEqual({ one: 1 })
        } finally {
            await pool.end()
        }
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
