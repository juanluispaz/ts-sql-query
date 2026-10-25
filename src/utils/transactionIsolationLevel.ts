import { TsSqlProcessingError } from '../TsSqlError.js'
import type { BeginTransactionOpts, DatabaseType } from '../queryRunners/QueryRunner.js'

type IsolationLevel = NonNullable<BeginTransactionOpts[0]>

/*
 * ts-sql-query names the isolation levels with the SQL standard's words, and with SQL Server's `snapshot` for the
 * level the standard has no name for (every read sees the database as it stood at one moment). Each database spells
 * the same promise differently, so the level is translated here to the words the database expects. A level the
 * database doesn't really deliver is not offered: PostgreSQL accepts `read uncommitted` but runs `read committed`,
 * and the `repeatable read` of PostgreSQL, MySQL and MariaDB is a snapshot, not the standard's `repeatable read`.
 */
const isolationLevelByDatabase: { [db in DatabaseType]: { [level in IsolationLevel]?: string } } = {
    mariaDB: {
        'read uncommitted': 'read uncommitted',
        'read committed': 'read committed',
        'snapshot': 'repeatable read',
        'serializable': 'serializable',
    },
    mySql: {
        'read uncommitted': 'read uncommitted',
        'read committed': 'read committed',
        'snapshot': 'repeatable read',
        'serializable': 'serializable',
    },
    noopDB: {
        'read uncommitted': 'read uncommitted',
        'read committed': 'read committed',
        'repeatable read': 'repeatable read',
        'snapshot': 'snapshot',
        'serializable': 'serializable',
    },
    oracle: {
        'read committed': 'read committed',
        'snapshot': 'serializable',
    },
    postgreSql: {
        'read committed': 'read committed',
        'snapshot': 'repeatable read',
        'serializable': 'serializable',
    },
    sqlite: {},
    sqlServer: {
        'read uncommitted': 'read uncommitted',
        'read committed': 'read committed',
        'repeatable read': 'repeatable read',
        'snapshot': 'snapshot',
        'serializable': 'serializable',
    },
}

/**
 * Returns the words the database uses for the requested isolation level, or undefined when no level was requested.
 * Throws TRANSACTION_LEVEL_NOT_SUPPORTED when the database doesn't offer that level.
 */
export function databaseIsolationLevel(database: DatabaseType, level: string | undefined): string | undefined {
    if (!level) {
        return undefined
    }
    const levels = isolationLevelByDatabase[database]
    const result = Object.prototype.hasOwnProperty.call(levels, level) ? levels[level as IsolationLevel] : undefined
    if (result === undefined) {
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, database + " doesn't support the transactions level: " + level)
    }
    return result
}
