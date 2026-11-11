// localDate, localTime and localDateTime through every Oracle runner, with the process in UTC and in other zones:
// what is stored when a Date is sent, what is read from a stored value, and that a value read and sent back stays the
// same. The zone is set when a process starts, so each runner runs in a process of its own:
// see localTemporalValuesInAnyZone/probe.ts and ../lib/localTemporalValuesProbe.ts for the contract.

import { fileURLToPath } from 'node:url'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'
import { describeLocalTemporalValuesInAnyZone, describeRunnerRequirements } from '../lib/localTemporalValues.js'
import { oracleTemporalDialect } from '../lib/localTemporalValuesProbe.js'

const probe = fileURLToPath(new URL('./localTemporalValuesInAnyZone/probe.ts', import.meta.url))
const enabled = isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb')

async function acquire() {
    const db = await acquireRunnerTestDatabase()
    return { info: { user: db.user, password: db.password, connectString: db.connectString }, release: () => db.release() }
}

const runners = ['OracleDBQueryRunner', 'OracleDBPoolQueryRunner', 'OracleDBPoolPromiseQueryRunner']

// oracledb builds the Date of a DATE or a TIMESTAMP with the zone of the process, and the runner takes its local getters
// back: a stored time the zone skips when it changes to summer time doesn't exist there, and oracledb has already moved
// it an hour (the JSON of aggregateAsArray is built by the server and keeps it)
const springForwardGapOf: Record<string, string> = { 'Europe/Madrid': 'the Madrid spring-forward gap', 'America/New_York': 'the New York spring-forward gap' }
// Oracle counts the days before 1582-10-15 in the Julian calendar, a Date in the Gregorian one: the digits sent and read
// agree, the day of the week and the epoch milliseconds Oracle computes don't (test/ENGINE_SUPPORT.md)
const julianGetter = /^(read|send) getters \| [a-z]+ [^|]+ \| [^|]*0999-01-14[^|]* \| (getDay|getTime)$/
function oracleLimitOf(zone: string, caseName: string): string | undefined {
    if (julianGetter.test(caseName)) {
        return 'Oracle computes the dates before 1582-10-15 in the Julian calendar'
    }
    const gap = springForwardGapOf[zone]
    if (gap && /^(read|round trip equals|round trip update set|send const in the select list) \| (dt|dtx) /.test(caseName) && caseName.includes('(' + gap + ')')) {
        return 'oracledb moves a time (stored, or a constant of the select list, a TIMESTAMP) that does not exist in the zone of the process'
    }
    return undefined
}

describeLocalTemporalValuesInAnyZone({
    database: 'Oracle',
    dialect: oracleTemporalDialect,
    probe,
    acquire,
    // ORA_SDTZ = UTC is what the runners require when the process isn't in UTC (see the requirements below)
    runners: runners.map(runner => ({ runner, enabled, needsConnection: true, envFor: (zone: string) => zone === 'UTC' ? {} : { ORA_SDTZ: 'UTC' }, limitOf: oracleLimitOf })),
})

// What the runners of oracledb must validate, at the first query (which carries the databaseTimeZone of the
// connection, UTC here): the session in the zone of the database.
// oracledb sets the session from process.env.ORA_SDTZ, or else from the offset of the process: ORA_SDTZ in UTC, or
// unset with the process in UTC
describeRunnerRequirements({
    title: 'Oracle: the runners of oracledb require the session in UTC, from ORA_SDTZ or from a process in UTC',
    probe,
    acquire,
    enabled,
    requirements: runners.flatMap(runner => [
        { title: `${runner} without ORA_SDTZ is rejected in Europe/Madrid`, runner, zone: 'Europe/Madrid', expected: 'rejected at its first query' as const },
        { title: `${runner} without ORA_SDTZ is rejected in America/New_York`, runner, zone: 'America/New_York', expected: 'rejected at its first query' as const },
        { title: `${runner} with ORA_SDTZ = Europe/Madrid is rejected in Europe/Madrid`, runner, zone: 'Europe/Madrid', env: { ORA_SDTZ: 'Europe/Madrid' }, expected: 'rejected at its first query' as const },
        { title: `${runner} with ORA_SDTZ = Europe/Madrid is rejected in UTC`, runner, zone: 'UTC', env: { ORA_SDTZ: 'Europe/Madrid' }, expected: 'rejected at its first query' as const },
        { title: `${runner} with ORA_SDTZ = DBTIMEZONE is rejected in UTC`, runner, zone: 'UTC', env: { ORA_SDTZ: 'DBTIMEZONE' }, expected: 'rejected at its first query' as const },
        { title: `${runner} with ORA_SDTZ = UTC is accepted in Europe/Madrid`, runner, zone: 'Europe/Madrid', env: { ORA_SDTZ: 'UTC' }, expected: 'created' as const },
        { title: `${runner} with ORA_SDTZ = +00:00 is accepted in Europe/Madrid`, runner, zone: 'Europe/Madrid', env: { ORA_SDTZ: '+00:00' }, expected: 'created' as const },
        { title: `${runner} without ORA_SDTZ is accepted in UTC`, runner, zone: 'UTC', expected: 'created' as const },
        { title: `${runner} without ORA_SDTZ is accepted in Etc/UTC`, runner, zone: 'Etc/UTC', expected: 'created' as const },
    ]),
})
