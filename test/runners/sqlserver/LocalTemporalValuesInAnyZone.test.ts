// localDate, localTime and localDateTime through every SQL Server runner, with the process in UTC and in other zones:
// what is stored when a Date is sent, what is read from a stored value, and that a value read and sent back stays the
// same. The zone is set when a process starts, so each runner runs in a process of its own:
// see localTemporalValuesInAnyZone/probe.ts and ../lib/localTemporalValuesProbe.ts for the contract.

import { fileURLToPath } from 'node:url'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'
import { describeLocalTemporalValuesInAnyZone, describeRunnerRequirements } from '../lib/localTemporalValues.js'
import { sqlServerTemporalDialect } from '../lib/localTemporalValuesProbe.js'

const probe = fileURLToPath(new URL('./localTemporalValuesInAnyZone/probe.ts', import.meta.url))
const enabled = isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql')

async function acquire() {
    const db = await acquireRunnerTestDatabase()
    return { info: { config: db.config }, release: () => db.release() }
}

const runners = ['MssqlPoolQueryRunner', 'MssqlPoolPromiseQueryRunner']

// The zoned values are stored at +09:00 (the same instant). The value read is its instant, but datepart of a
// datetimeoffset gives the parts of the offset it was stored with, not UTC: the hour of 18:15 +09:00 is 18
// (docs/configuration/time-zones.md, "Known limits"). getTime counts the instant
const storedOffsetHour = /^read getters \| dtz datetimeoffset\(3\) \| [^|]*\+09:00[^|]* \| getHours$/
function sqlServerLimitOf(_zone: string, caseName: string): string | undefined {
    return storedOffsetHour.test(caseName) ? 'the parts of a datetimeoffset are those of the offset it was stored with' : undefined
}

describeLocalTemporalValuesInAnyZone({
    database: 'SQL Server',
    dialect: sqlServerTemporalDialect,
    probe,
    acquire,
    runners: runners.flatMap(runner => [
        { runner, label: `${runner} (useUTC: true)`, options: { useUTC: true }, enabled, needsConnection: true, limitOf: sqlServerLimitOf },
        // useUTC: false is only valid with the process in UTC (see the requirements below)
        { runner, label: `${runner} (useUTC: false)`, options: { useUTC: false }, enabled, needsConnection: true, zones: ['UTC'], limitOf: sqlServerLimitOf },
    ]),
})

// What the runners of mssql must validate when created: useUTC not false, unless the process is in UTC. The promise
// of a pool only gives its configuration once it resolves, so MssqlPoolPromiseQueryRunner may reject at its first query
describeRunnerRequirements({
    title: 'SQL Server: the runners of mssql require useUTC unless the process is in UTC',
    probe,
    acquire,
    enabled,
    requirements: runners.flatMap(runner => {
        const rejected = runner === 'MssqlPoolPromiseQueryRunner' ? 'rejected when created or at its first query' as const : 'rejected' as const
        return [
            { title: `${runner} with useUTC: false is rejected in Europe/Madrid`, runner, options: { useUTC: false }, zone: 'Europe/Madrid', expected: rejected },
            { title: `${runner} with useUTC: false is rejected in Asia/Tokyo`, runner, options: { useUTC: false }, zone: 'Asia/Tokyo', expected: rejected },
            { title: `${runner} with useUTC: false is accepted in UTC`, runner, options: { useUTC: false }, zone: 'UTC', expected: 'created' as const },
            { title: `${runner} with useUTC: false is accepted in Etc/UTC`, runner, options: { useUTC: false }, zone: 'Etc/UTC', expected: 'created' as const },
            { title: `${runner} with useUTC: true is accepted in Europe/Madrid`, runner, options: { useUTC: true }, zone: 'Europe/Madrid', expected: 'created' as const },
            { title: `${runner} without useUTC is accepted in Europe/Madrid`, runner, zone: 'Europe/Madrid', expected: 'created' as const },
        ]
    }),
})
