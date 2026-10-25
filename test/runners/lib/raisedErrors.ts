// Errors the engine raises on demand, for the error codes no real condition
// provokes in a test (a full disk, a corrupted page, a replication failure):
// the engine and the driver are real, only the condition is not. Each code
// the native mapping docs list (documentedMappings.ts) is raised and must be
// reported as its row says — the `raised.<code>` tests of the runner contract.
//
//   PostgreSQL         raise exception ... using errcode = '<SQLSTATE>'
//   MySQL / MariaDB    signal sqlstate 'HY000' set mysql_errno = <number>
//   Oracle             pragma exception_init(e, -<number>); raise e
//   SQL Server         raiserror(<number>, 16, 1), only from 13000 (and
//                      raiserror('<message>', 16, 1) for 50000)
//
// SQLite has no way to raise an error code from SQL.

import type { DatabaseType } from '../../../src/queryRunners/QueryRunner.js'
import { documentedMappings, type DocumentedMapping } from './documentedMappings.js'

export interface RaisedError extends DocumentedMapping {
    /** The statement that makes the engine raise it. */
    readonly sql: string
}

const MESSAGE = 'rt_err raised'

/**
 * Oracle errors that can't be raised on purpose: the thin driver drops a
 * connection whose server reports them (NJS-500), or the server reports
 * another error instead (ORA-04030 → ORA-04068).
 */
const ORACLE_NOT_RAISABLE = new Set([600, 603, 1012, 1041, 1089, 3113, 3114, 3135, 4030, 12537])

/**
 * The arguments RAISERROR needs for the message of each documented SQL Server
 * error from 13000, one per format placeholder of its text in sys.messages
 * (SQL Server 2025, English). The numbers missing here can't be raised: they
 * aren't in sys.messages (Azure SQL Database errors) or their text uses a
 * placeholder RAISERROR doesn't take (%lc, %S_MSG).
 */
const SQL_SERVER_RAISERROR_ARGUMENTS: Record<number, string> = {
    13606: "", 13612: "", 13613: "", 13614: "", 13615: "", 13616: "", 13617: "",
    13619: "0", 13622: "0", 13625: "", 13636: "", 13638: "N'x'", 13639: "", 13640: "0", 13641: "", 13642: "",
    13643: "", 13644: "0", 13645: "0", 13646: "0", 13648: "1, N'x', 0", 13650: "0", 13654: "", 13655: "1, N'x'",
    13656: "", 13657: "", 13658: "", 13659: "0, 0, 0", 13660: "'x'", 13661: "", 13662: "", 13663: "", 13665: "'x'",
    13670: "N'x'", 13671: "0", 13684: "", 13687: "", 13692: "", 18452: "1, N'x'",
    18456: "1, N'x', 1, N'x', 1, N'x'", 18470: "1, N'x', 1, N'x'", 18487: "1, N'x', 1, N'x'",
    18488: "1, N'x', 1, N'x'", 19300: "1, 'x', 1, 'x'", 19307: "1, N'x', 1, 'x'", 19308: "1, N'x', 1, 'x'",
    19309: "1, 'x'", 28014: "", 40050: "", 40051: "", 40052: "", 40054: "", 40058: "", 40067: "", 40072: "",
    40073: "", 40080: "", 40083: "", 40145: "", 40188: "1, N'x'", 40307: "0, 0", 40501: "N'x', 0", 40504: "",
    40505: "", 40508: "", 40510: "1, N'x'", 40511: "1, N'x'", 40512: "N'x'", 40513: "1, N'x'", 40514: "N'x'",
    40515: "1, N'x'", 40516: "", 40517: "1, N'x'", 40518: "1, N'x'", 40522: "1, N'x'",
    40523: "1, N'x'", 40524: "1, N'x'", 40525: "N'x'", 40526: "1, N'x'", 40527: "", 40528: "", 40529: "1, N'x'",
    40531: "1, N'x'", 40532: "1, N'x'", 40536: "N'x'", 40540: "", 40544: "1, N'x'", 40548: "1, N'x'", 40549: "",
    40550: "", 40551: "", 40552: "", 40553: "", 40555: "N'x'", 40558: "", 40559: "", 40573: "1, N'x'", 40574: "",
    40576: "", 40578: "1, N'x'", 40584: "1, N'x', 1, N'x'", 40586: "", 40587: "", 40597: "1, N'x'", 40598: "'x'",
    40599: "", 40604: "1, N'x'", 40606: "", 40607: "", 40611: "", 40613: "1, N'x', 1, N'x', 1, N'x'",
    40615: "1, N'x', 1, N'x'", 40620: "1, N'x'", 40623: "1, N'x'", 40624: "1, N'x'", 40628: "1, N'x'",
    40635: "1, N'x'", 40640: "", 40642: "", 40644: "", 40648: "", 40652: "1, N'x'", 40656: "", 40658: "",
    40662: "1, N'x'", 40668: "1, N'x'", 40669: "1, N'x'", 40671: "1, N'x', 1, N'x', 1, N'x'", 40675: "", 41300: "",
    41301: "", 41302: "", 41303: "0", 41305: "", 41321: "1, N'x'", 41325: "", 41327: "1, N'x'", 41331: "",
    41339: "1, N'x'", 41340: "", 41361: "", 41363: "1, N'x', 1, N'x'", 41376: "N'x'", 41379: "1, N'x', N'x'",
    41394: "", 42303: "", 42304: "", 42305: "", 43201: "cast(0 as bigint), 1, N'x', 0, 0",
    43202: "cast(0 as bigint), 1, N'x', 0", 43203: "1, N'x', 1, N'x'", 45020: "N'x', 0",
    45021: "N'x', 0", 45031: "", 45043: "N'x', N'x'",
}

function raiseStatement(database: DatabaseType, mapping: DocumentedMapping): string | undefined {
    const n = mapping.number
    switch (database) {
        case 'postgreSql':
            return typeof n === 'string' && /^[0-9A-Z]{5}$/.test(n) && n !== '00000'
                ? `do $$ begin raise exception '${MESSAGE}' using errcode = '${n}'; end $$`
                : undefined
        case 'mySql':
        case 'mariaDB':
            // 2000-2999 are the client library's own errors (CR_*): the server never sends them
            return typeof n === 'number' && n >= 1 && n <= 65535 && !(n >= 2000 && n <= 2999)
                ? `signal sqlstate 'HY000' set mysql_errno = ${n}, message_text = '${MESSAGE}'`
                : undefined
        case 'oracle':
            // -1403 can't be associated with an exception (ORA-01403 is raised as +100)
            return typeof n === 'number' && mapping.code.startsWith('ORA-') && n !== 1403 && !ORACLE_NOT_RAISABLE.has(n)
                ? `declare e exception; pragma exception_init(e, -${n}); begin raise e; end;`
                : undefined
        case 'sqlServer':
            if (n === 50000) return `raiserror('${MESSAGE}', 16, 1)`
            if (typeof n !== 'number' || n < 13000 || n >= 50000) return undefined
            const args = SQL_SERVER_RAISERROR_ARGUMENTS[n]
            if (args === undefined) return undefined
            // RAISERROR takes constants or variables, not expressions: a bigint goes through a variable
            const declare = args.includes('cast(0 as bigint)') ? 'declare @rt_err_bigint bigint = 0; ' : ''
            return `${declare}raiserror(${n}, 16, 1${args ? ', ' + args.replaceAll('cast(0 as bigint)', '@rt_err_bigint') : ''})`
        default:
            return undefined
    }
}

/**
 * Numbers mysql2 still names as MySQL did before 8.4 (ER_WRONG_OUTER_JOIN for
 * the ER_WRONG_OUTER_JOIN_UNUSED the docs list): the code a driver reports is
 * kept, so only the number and the reason are checked for them.
 */
export const DRIVER_NAMED_ERROR_NUMBERS = new Set([1120, 1557, 3597, 3600])

export function raisedErrors(database: DatabaseType): RaisedError[] {
    const raised: RaisedError[] = []
    for (const mapping of documentedMappings(database)) {
        const sql = raiseStatement(database, mapping)
        if (sql) raised.push({ ...mapping, sql })
    }
    return raised
}
