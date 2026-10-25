// The native error mappings the documentation promises
// (docs/api/error-management/native-mappings/<database>.md), read as data:
// one entry per database error code or number listed in a row, with the
// reason (and subtype) of that row. The raised-error tests (`raised.*`, see
// raisedErrors.ts) have the engine raise each code and check the library
// reports what its row says.
//
// Left out: entries that depend on more than the code (`... when the message
// ...`), entries a connector produces (they name it, `([pg](...))`) and the
// SQLSTATE classes, which have no single code to raise.

import { readFileSync } from 'node:fs'
import type { DatabaseType } from '../../../src/queryRunners/QueryRunner.js'

export interface DocumentedMapping {
    /** The symbolic code the row names: `ER_DUP_ENTRY`, `unique_violation`, `ORA-00001`, `EREQUEST`. */
    readonly code: string
    /** The number or SQLSTATE: 1062, '23505', 1, 2627. */
    readonly number: number | string
    /** The reason of the row, with its subtype when the row has one: { reason, constraintType: 'unique' }. */
    readonly expected: { reason: string, [subtype: string]: string }
}

const PAGES: Partial<Record<DatabaseType, string>> = {
    postgreSql: 'postgresql.md',
    mySql: 'mysql.md',
    mariaDB: 'mariadb.md',
    oracle: 'oracle.md',
    sqlServer: 'sql-server.md',
    sqlite: 'sqlite.md',
}

export function documentedMappings(database: DatabaseType): DocumentedMapping[] {
    const page = PAGES[database]
    if (!page) return []
    const text = readFileSync(new URL('../../../docs/api/error-management/native-mappings/' + page, import.meta.url), 'utf8')
    const byNumber = new Map<string, DocumentedMapping[]>()
    for (const line of text.split('\n')) {
        if (!line.startsWith('| ') || line.startsWith('| Category') || line.startsWith('| ---')) continue
        const cells = line.slice(2, -2).split(' | ')
        if (cells.length !== 4 || cells[2] === '-') continue
        const expected = parseReason(cells[1]!)
        for (const entry of cells[2]!.split('<br>')) {
            const match = /^`([^`]+)` \/ `([0-9A-Z]+)`: (.*)$/.exec(entry)
            if (!match || / when | if /.test(match[3]!)) continue
            const number = /^\d+$/.test(match[2]!) && database !== 'postgreSql' ? Number(match[2]) : match[2]!
            const key = String(number)
            byNumber.set(key, [...byNumber.get(key) ?? [], { code: match[1]!, number, expected }])
        }
    }
    // A number listed under two different reasons depends on more than the
    // number (the active database, the message): not a single promise to check.
    return [...byNumber.values()]
        .filter(mappings => new Set(mappings.map(m => JSON.stringify(m.expected))).size === 1)
        .map(mappings => mappings[0]!)
}

function parseReason(cell: string): { reason: string, [subtype: string]: string } {
    const match = /^`(\w+)`(?:<br>\*\*(\w+)\*\*<br>`([^`]+)`)?$/.exec(cell)
    if (!match) throw new Error('Unexpected reason cell in the native mapping docs: ' + cell)
    return match[2] ? { reason: match[1]!, [match[2]]: match[3]! } : { reason: match[1]! }
}
