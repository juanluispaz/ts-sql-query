// localDate, localTime and localDateTime through every PostgreSQL runner, with the process in UTC and in other zones:
// what is stored when a Date is sent, what is read from a stored value, and that a value read and sent back stays the
// same. The zone is set when a process starts, so each runner runs in a process of its own:
// see localTemporalValuesInAnyZone/probe.ts and ../lib/localTemporalValuesProbe.ts for the contract.

import { fileURLToPath } from 'node:url'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { describeLocalTemporalValuesInAnyZone, describeRunnerRequirements } from '../lib/localTemporalValues.js'
import { postgresTemporalDialect } from '../lib/localTemporalValuesProbe.js'
import { environmentVersions, isEnvironmentVersionSelected } from '../lib/versions.js'

const probe = fileURLToPath(new URL('./localTemporalValuesInAnyZone/probe.ts', import.meta.url))
const isBun = typeof globalThis.Bun !== 'undefined'
const pgEnabled = isRealDbEnabled('postgres', 'docker', 'newest', 'pg')

async function acquireOn(version: string) {
    const db = await acquireRunnerTestDatabase(undefined, version)
    return { info: { uri: db.uri }, release: () => db.release() }
}
const acquire = () => acquireOn('newest')

// Each version of the engine mapped for --docker-version closest runs too, with the compatibilityVersion of its cells;
// PGlite has one version
for (const { version, compatibilityVersion, label } of await environmentVersions('postgres', 'pg')) {
    describeLocalTemporalValuesInAnyZone({
        database: 'PostgreSQL' + label,
        compatibilityVersion,
        dialect: postgresTemporalDialect,
        probe,
        acquire: () => acquireOn(version),
        runners: [
            { runner: 'PgPoolQueryRunner', enabled: isRealDbEnabled('postgres', 'docker', version, 'pg'), needsConnection: true },
            { runner: 'PgQueryRunner', enabled: isRealDbEnabled('postgres', 'docker', version, 'pg'), needsConnection: true },
            { runner: 'PostgresQueryRunner', enabled: isRealDbEnabled('postgres', 'docker', version, 'postgres'), needsConnection: true },
            { runner: 'PgLiteQueryRunner', enabled: version === 'newest' && isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'), needsConnection: false },
            { runner: 'BunSqlPostgresQueryRunner', enabled: isBun && isRealDbEnabled('postgres', 'docker', version, 'bun_sql_postgres'), needsConnection: true },
        ],
    })
}

// What the runners of pg must validate when created: the binary mode of pg off, in any zone (once, with the newest
// version: it doesn't depend on the version)
describeRunnerRequirements({
    title: 'PostgreSQL: the runners of pg require the binary mode off',
    probe,
    acquire,
    enabled: pgEnabled && isEnvironmentVersionSelected('postgres', 'newest'),
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
    enabled: isRealDbEnabled('postgres', 'docker', 'newest', 'postgres') && isEnvironmentVersionSelected('postgres', 'newest'),
    requirements: [
        { title: 'PostgresQueryRunner with infer: true is rejected in Europe/Madrid', runner: 'PostgresQueryRunner', options: { infer: true }, zone: 'Europe/Madrid', expected: 'rejected' },
        { title: 'PostgresQueryRunner with infer: true is accepted in UTC', runner: 'PostgresQueryRunner', options: { infer: true }, zone: 'UTC', expected: 'created' },
        { title: 'PostgresQueryRunner without infer is accepted in Europe/Madrid', runner: 'PostgresQueryRunner', zone: 'Europe/Madrid', expected: 'created' },
    ],
})
