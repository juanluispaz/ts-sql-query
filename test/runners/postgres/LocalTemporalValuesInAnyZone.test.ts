// localDate, localTime and localDateTime through every PostgreSQL runner, with the process in UTC and in other zones:
// what is stored when a Date is sent, what is read from a stored value, and that a value read and sent back stays the
// same. The zone is set when a process starts, so each runner runs in a process of its own:
// see localTemporalValuesInAnyZone/probe.ts and ../lib/localTemporalValuesProbe.ts for the contract.

import { fileURLToPath } from 'node:url'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { describeLocalTemporalValuesInAnyZone, describeRunnerRequirements } from '../lib/localTemporalValues.js'
import { postgresTemporalDialect } from '../lib/localTemporalValuesProbe.js'

const probe = fileURLToPath(new URL('./localTemporalValuesInAnyZone/probe.ts', import.meta.url))
const isBun = typeof globalThis.Bun !== 'undefined'
const pgEnabled = isRealDbEnabled('postgres', 'docker', 'newest', 'pg')

// A const localDateTime in the select list is sent as a timestamp, and PGlite converts a timestamp to a timestamptz with
// the zone of its session, which it takes from the process as a fixed offset (the other runners' sessions are in UTC)
function pgLiteLimitOf(zone: string, caseName: string): string | undefined {
    if (zone !== 'UTC' && caseName.startsWith('send insert from a select of consts | dtz timestamptz |')) {
        return 'PGlite converts the const timestamp to timestamptz with the zone of the process'
    }
    return undefined
}

async function acquire() {
    const db = await acquireRunnerTestDatabase()
    return { info: { uri: db.uri }, release: () => db.release() }
}

describeLocalTemporalValuesInAnyZone({
    database: 'PostgreSQL',
    dialect: postgresTemporalDialect,
    probe,
    acquire,
    runners: [
        { runner: 'PgPoolQueryRunner', enabled: pgEnabled, needsConnection: true },
        { runner: 'PgQueryRunner', enabled: pgEnabled, needsConnection: true },
        { runner: 'PostgresQueryRunner', enabled: isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'), needsConnection: true },
        { runner: 'PgLiteQueryRunner', enabled: isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'), needsConnection: false, limitOf: pgLiteLimitOf },
        { runner: 'BunSqlPostgresQueryRunner', enabled: isBun && isRealDbEnabled('postgres', 'docker', 'newest', 'bun_sql_postgres'), needsConnection: true },
    ],
})

// What the runners of pg must validate when created: the binary mode of pg off, in any zone
describeRunnerRequirements({
    title: 'PostgreSQL: the runners of pg require the binary mode off',
    probe,
    acquire,
    enabled: pgEnabled,
    requirements: ['PgPoolQueryRunner', 'PgQueryRunner'].flatMap(runner => [
        { title: `${runner} with binary: true is rejected in UTC`, runner, options: { binary: true }, zone: 'UTC', expected: 'rejected' as const },
        { title: `${runner} with binary: true is rejected in Europe/Madrid`, runner, options: { binary: true }, zone: 'Europe/Madrid', expected: 'rejected' as const },
        { title: `${runner} with binary: false is accepted in Europe/Madrid`, runner, options: { binary: false }, zone: 'Europe/Madrid', expected: 'created' as const },
        { title: `${runner} without binary is accepted in Europe/Madrid`, runner, zone: 'Europe/Madrid', expected: 'created' as const },
    ]),
})

// What the runner of postgres.js must validate when created: infer off, unless the process is in UTC (with it
// postgres.js reads a timestamp with the zone of the process)
describeRunnerRequirements({
    title: 'PostgreSQL: the runner of postgres.js requires infer off unless the process is in UTC',
    probe,
    acquire,
    enabled: isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'),
    requirements: [
        { title: 'PostgresQueryRunner with infer: true is rejected in Europe/Madrid', runner: 'PostgresQueryRunner', options: { infer: true }, zone: 'Europe/Madrid', expected: 'rejected' },
        { title: 'PostgresQueryRunner with infer: true is accepted in UTC', runner: 'PostgresQueryRunner', options: { infer: true }, zone: 'UTC', expected: 'created' },
        { title: 'PostgresQueryRunner without infer is accepted in Europe/Madrid', runner: 'PostgresQueryRunner', zone: 'Europe/Madrid', expected: 'created' },
    ],
})
