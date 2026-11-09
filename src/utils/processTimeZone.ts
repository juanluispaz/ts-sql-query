// Whether the process runs in UTC, for the query runners whose driver needs a setting only when it doesn't: with the
// process in UTC the local getters of a Date are its UTC getters, and what the driver does with them is already right.

import { TsSqlProcessingError } from '../TsSqlError.js'

// The names of a zone that is UTC all year (IANA names and their aliases, and the POSIX UTC0), in upper case
const utcZoneNames = new Set<string>([
    'UTC', 'UTC0', 'ETC/UTC', 'UCT', 'ETC/UCT',
    'GMT', 'GMT0', 'GMT+0', 'GMT-0', 'ETC/GMT', 'ETC/GMT0', 'ETC/GMT+0', 'ETC/GMT-0',
    'UNIVERSAL', 'ETC/UNIVERSAL', 'ZULU', 'ETC/ZULU', 'GREENWICH', 'ETC/GREENWICH',
])

/** Whether the name of a zone is one of a zone that is UTC all year; a leading `:` (POSIX) is ignored */
export function isUtcTimeZoneName(name: string): boolean {
    const trimmed = name.trim()
    return utcZoneNames.has((trimmed.startsWith(':') ? trimmed.slice(1) : trimmed).toUpperCase())
}

/**
 * Whether the process runs in UTC: by `process.env.TZ` when it is set, otherwise by the zone the runtime resolves.
 * Never by the current offset, which is 0 in some zones only part of the year.
 */
export function isProcessInUtc(): boolean {
    const tz = globalThis.process?.env?.['TZ']
    if (tz) {
        return isUtcTimeZoneName(tz)
    }
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
    return !!resolved && isUtcTimeZoneName(resolved)
}

/**
 * oracledb (thin) sets the zone of the session when it connects: the one of `process.env.ORA_SDTZ`, or else the
 * offset of the process at that moment. The library binds a date and time as a timestamp with time zone in UTC, which
 * Oracle converts with the zone of the session to compare it with a `date` or a `timestamp`: outside UTC the session
 * must be in UTC. Thrown when the query runner is created.
 */
export function requireOracleSessionInUtc(queryRunner: string): void {
    if (isProcessInUtc()) {
        return
    }
    const sessionTimeZone = globalThis.process?.env?.['ORA_SDTZ']
    if (sessionTimeZone && (isUtcTimeZoneName(sessionTimeZone) || /^[+-]?0?0:00$/.test(sessionTimeZone.trim()))) {
        return
    }
    throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'ORA_SDTZ', value: sessionTimeZone },
        queryRunner + ' requires the environment variable ORA_SDTZ set to UTC when the process does not run in UTC: oracledb sets the zone of the session from it when it connects, and the date and time values are in UTC. ORA_SDTZ is ' + (sessionTimeZone === undefined ? 'not set' : "'" + sessionTimeZone + "'"))
}
