// The zone oracledb gives the session, read without a query (see processTimeZone.ts)

import { isProcessInUtc, type SessionTimeZone } from '../processTimeZone.js'

/**
 * The zone oracledb (thin) gives the session when it connects: the one of `process.env.ORA_SDTZ`, or else the offset of
 * the process at that moment, which is UTC only when the process runs in UTC (`LOCAL` and `DBTIMEZONE` go as keywords,
 * whose zone can't be known without a query, and never match). Read when the query runner is created.
 */
export function oracleSessionTimeZone(queryRunner: string): SessionTimeZone {
    const sessionTimeZone = globalThis.process?.env?.['ORA_SDTZ']
    // An unset ORA_SDTZ is not the zone of the database: oracledb gives the session the offset of the process
    const howToSet = "Set the environment variable ORA_SDTZ to '{zone}' before the connections are opened"
    if (sessionTimeZone) {
        return { queryRunner, timeZone: sessionTimeZone, name: 'ORA_SDTZ', value: sessionTimeZone, origin: 'the environment variable ORA_SDTZ, from which oracledb sets the zone of the session when it connects,', howToSet }
    }
    if (isProcessInUtc()) {
        return { queryRunner, timeZone: 'UTC', name: 'ORA_SDTZ', value: sessionTimeZone, origin: 'ORA_SDTZ is not set, and oracledb, when it connects, with the process in UTC,', howToSet }
    }
    return { queryRunner, timeZone: 'the offset of the process', name: 'ORA_SDTZ', value: sessionTimeZone, origin: 'ORA_SDTZ is not set, and oracledb, when it connects,', howToSet }
}
