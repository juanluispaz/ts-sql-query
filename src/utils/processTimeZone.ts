// Whether the process runs in UTC, for the query runners whose driver needs a setting only when it doesn't: with the
// process in UTC the local getters of a Date are its UTC getters, and what the driver does with them is already right.

import { TsSqlProcessingError } from '../TsSqlError.js'
import { getQueryConnectionConfigurationOf } from './queryParamsMetadata.js'

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

// The value of process.env.TZ isProcessInUtc last computed its answer for (null: never), and that answer
let lastTz: string | undefined | null = null
let lastInUtc = false

/**
 * Whether the process runs in UTC: by `process.env.TZ` when it is set, otherwise by the zone the runtime resolves.
 * Never by the current offset, which is 0 in some zones only part of the year. Node and Bun change the zone of the
 * process when `process.env.TZ` is assigned, so the answer is computed again only when its value changes.
 */
export function isProcessInUtc(): boolean {
    const tz = globalThis.process?.env?.['TZ']
    if (tz !== lastTz) {
        if (tz) {
            lastInUtc = isUtcTimeZoneName(tz)
        } else {
            const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
            lastInUtc = !!resolved && isUtcTimeZoneName(resolved)
        }
        lastTz = tz
    }
    return lastInUtc
}

/**
 * Whether the text of a zone given to the session is UTC: a name of a zone that is UTC all year, or an offset of zero
 * (`+00:00`, `00:00`, `-00:00`, `+00`, `0`), which PostgreSQL and Oracle take as UTC whatever its sign
 */
export function isUtcSessionTimeZone(timeZone: string): boolean {
    return isUtcTimeZoneName(timeZone) || /^[+-]?0?0(:00)?$/.test(timeZone.trim())
}

/**
 * The zone a query runner read, without a query, that the configuration of its connection gives the session: undefined
 * when it sets none (the session then has the zone of the database); `name` and `value` are that configuration, and
 * `origin` says where it comes from, for the message
 */
export interface SessionTimeZone {
    readonly queryRunner: string
    readonly timeZone: string
    readonly name: string
    readonly value: unknown
    readonly origin: string
    /** How the user puts the session in another zone, for the message (by default: set it or leave it unset) */
    readonly howToSet?: string | undefined
}

/**
 * The session of a connection must be in the zone of the database, the `databaseTimeZone` of the connection (UTC
 * without one): checked for each query, which carries the configuration of the connection in its params, against the
 * zone the query runner read when it was created. A promise rejected with INVALID_CONFIGURATION, or undefined.
 */
export function rejectSessionNotInDatabaseZone(session: SessionTimeZone | undefined, params: any[]): Promise<never> | undefined {
    if (!session) {
        return undefined
    }
    const databaseTimeZone = getQueryConnectionConfigurationOf(params)?.databaseTimeZone ?? 'UTC'
    const databaseInUtc = isUtcTimeZoneName(databaseTimeZone)
    if (databaseInUtc ? isUtcSessionTimeZone(session.timeZone) : session.timeZone.trim().toLowerCase() === databaseTimeZone.trim().toLowerCase()) {
        return undefined
    }
    return Promise.reject(new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: session.name, value: session.value },
        session.queryRunner + " requires the session in the zone of the database, the databaseTimeZone of the connection ('" + databaseTimeZone + "'): " + session.origin + " sets the session to '" + session.timeZone + "'. " + (databaseInUtc
            ? "Set the session to UTC or leave it unset; if the database isn't in UTC, declare its zone in the databaseTimeZone of the connection instead of moving the session to UTC"
            : (session.howToSet ? session.howToSet.replace('{zone}', databaseTimeZone) : "Set the session to '" + databaseTimeZone + "' or leave it unset") + ": in another zone, what the database produces in it (now(), a default) is not in the zone of its data")))
}

/**
 * The zone a `TimeZone` setting in the `options` of a PostgreSQL connection gives the session (the command-line
 * options of the server: `-c TimeZone=…` or `--TimeZone=…`, separated by spaces, a `\` escaping the next character;
 * the name of the setting in any case; the last one wins, as in the server), or undefined when it sets none.
 */
export function postgreSqlOptionsTimeZone(options: unknown): string | undefined {
    if (typeof options !== 'string') {
        return undefined
    }
    const words: string[] = []
    let word = ''
    let inWord = false
    for (let i = 0; i < options.length; i++) {
        const c = options[i]!
        if (c === '\\' && i + 1 < options.length) {
            word += options[++i]
            inWord = true
        } else if (/\s/.test(c)) {
            if (inWord) {
                words.push(word)
            }
            word = ''
            inWord = false
        } else {
            word += c
            inWord = true
        }
    }
    if (inWord) {
        words.push(word)
    }
    let timeZone: string | undefined
    for (let i = 0; i < words.length; i++) {
        let setting: string | undefined
        const w = words[i]!
        if (w === '-c') {
            setting = words[++i]
        } else if (w.startsWith('-c')) {
            setting = w.slice(2)
        } else if (w.startsWith('--')) {
            setting = w.slice(2)
        }
        if (setting === undefined) {
            continue
        }
        const equals = setting.indexOf('=')
        if (equals >= 0 && setting.slice(0, equals).replace(/-/g, '_').toLowerCase() === 'timezone') {
            timeZone = setting.slice(equals + 1)
        }
    }
    return timeZone
}

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
