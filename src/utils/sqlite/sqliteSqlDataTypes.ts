import type { SqlDataType } from '../../TypeAdapter.js'
import { mySqlMariaDBSqlDataTypeFrom } from '../mySqlMariaDB/mySqlMariaDBSqlDataTypes.js'
import { oracleSqlDataTypeFrom } from '../oracle/oracleSqlDataTypes.js'
import { postgreSqlSqlDataTypeFrom } from '../postgreSql/postgreSqlSqlDataTypes.js'
import { sqlServerSqlDataTypeFrom } from '../sqlServer/sqlServerSqlDataTypes.js'
import { nativeNameFor, withNative } from '../sqlDataTypeNames.js'

/** The family alone, without the native name of the database that read it */
function familyOnly(sqlDataType: SqlDataType): SqlDataType {
    const { native: _native, ...rest } = sqlDataType
    return rest as SqlDataType
}

/**
 * The type of a column of SQLite, as it is declared: the six types of a STRICT table as they are; any other name, the
 * one of a type of another database (read as PostgreSQL, MySQL, SQL Server and Oracle read it, in that order: the
 * intent of who wrote it); a name none of them knows, a user-defined type; no name, a value of any type
 */
function sqliteFamilyOf(nativeName: string): SqlDataType {
    const name = nativeName.trim()
    switch (name.toLowerCase()) {
        case '': case 'any': return { family: 'variant' }
        case 'int': case 'integer': return { family: 'exact numeric', scale: 0, bytes: 8 }
        case 'real': return { family: 'approximate numeric', precision: 53 }
        case 'text': return { family: 'character string' }
        case 'blob': return { family: 'binary string' }
    }
    for (const read of [postgreSqlSqlDataTypeFrom, (n: string) => mySqlMariaDBSqlDataTypeFrom(n, 'mySql'), sqlServerSqlDataTypeFrom, oracleSqlDataTypeFrom]) {
        const sqlDataType = read(name)
        if (sqlDataType.family !== 'user-defined') {
            return familyOnly(sqlDataType)
        }
    }
    return { family: 'user-defined', name }
}

export function sqliteSqlDataTypeFrom(nativeName: string): SqlDataType {
    return withNative(sqliteFamilyOf(nativeName), 'sqlite', nativeName)
}

/**
 * The type of a STRICT table of SQLite for the SQL data type, as the library stores it with the default strategies of
 * the connection (a date as text, a uuid as a blob, a decimal as text), or undefined when SQLite has none
 */
export function sqliteNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
    const native = nativeNameFor(sqlDataType, 'sqlite')
    if (native !== undefined) {
        return native
    }
    switch (sqlDataType.family) {
        case 'exact numeric':
            return sqlDataType.bytes !== undefined || sqlDataType.scale === 0 ? 'INTEGER' : 'TEXT'
        case 'approximate numeric':
            return 'REAL'
        case 'boolean':
            return 'INTEGER'
        case 'character string':
        case 'datetime':
        case 'document':
        case 'enumeration':
            return 'TEXT'
        case 'binary string':
            return sqlDataType.external ? undefined : 'BLOB'
        case 'uuid':
            return 'BLOB'
        case 'variant':
            return 'ANY'
        default:
            return undefined
    }
}
