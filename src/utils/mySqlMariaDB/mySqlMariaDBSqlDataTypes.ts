import type { SqlDataType, SqlDataTypeNative } from '../../TypeAdapter.js'
import { argumentNumber, nativeNameFor, nativeTypeParts, unquotedArgument } from '../sqlDataTypeNames.js'

type MySqlMariaDB = 'mySql' | 'mariaDB'

const integers: { readonly [name: string]: 1 | 2 | 3 | 4 | 8 } = {
    tinyint: 1, int1: 1, smallint: 2, int2: 2, mediumint: 3, int3: 3, middleint: 3, int: 4, integer: 4, int4: 4, bigint: 8, int8: 8,
}
const texts: readonly [name: string, length: number][] = [['tinytext', 255], ['text', 65535], ['mediumtext', 16777215], ['longtext', 4294967295]]
const blobs: readonly [name: string, length: number][] = [['tinyblob', 255], ['blob', 65535], ['mediumblob', 16777215], ['longblob', 4294967295]]
const geometries = ['geometry', 'point', 'linestring', 'polygon', 'multipoint', 'multilinestring', 'multipolygon', 'geometrycollection']

/** The type of the name as MySQL or MariaDB writes it (`COLUMN_TYPE`), aliases accepted, without its native name */
function mySqlMariaDBFamilyOf(nativeName: string, database: MySqlMariaDB): SqlDataType {
    const parts = nativeTypeParts(nativeName)
    const words = parts.key.split(' ')
    const unsigned = words.includes('unsigned')
    const key = words.filter(word => word !== 'unsigned' && word !== 'zerofill' && word !== 'signed').join(' ')
    const { args } = parts
    const n0 = argumentNumber(args[0])
    const n1 = argumentNumber(args[1])
    const bytes = integers[key]
    if (bytes !== undefined) {
        return { family: 'exact numeric', scale: 0, bytes, unsigned: unsigned || undefined }
    }
    switch (key) {
        case 'bool': case 'boolean': return { family: 'boolean' }
        case 'decimal': case 'dec': case 'numeric': case 'fixed':
            return { family: 'exact numeric', precision: n0 ?? 10, scale: n1 ?? 0, unsigned: unsigned || undefined }
        case 'float': case 'float4': return { family: 'approximate numeric', precision: n0 !== undefined && args.length === 1 && n0 > 24 ? 53 : 24 }
        case 'double': case 'double precision': case 'real': case 'float8': return { family: 'approximate numeric', precision: 53 }
        case 'bit': return { family: 'bit string', length: n0 ?? 1, fixed: true }
        case 'char': case 'character': return { family: 'character string', length: n0 ?? 1, fixed: true }
        case 'varchar': case 'character varying': return { family: 'character string', length: n0 }
        case 'nchar': case 'national char': case 'national character': return { family: 'character string', length: n0 ?? 1, fixed: true, national: true }
        case 'nvarchar': case 'national varchar': case 'national character varying': case 'nchar varchar': return { family: 'character string', length: n0, national: true }
        case 'binary': return { family: 'binary string', length: n0 ?? 1, fixed: true }
        case 'varbinary': return { family: 'binary string', length: n0 }
        case 'date': return { family: 'datetime', fields: 'date' }
        case 'time': return { family: 'datetime', fields: 'time', precision: n0, timeZone: 'none' }
        case 'datetime': return { family: 'datetime', fields: 'timestamp', precision: n0, timeZone: 'none' }
        case 'timestamp': return { family: 'datetime', fields: 'timestamp', precision: n0, timeZone: 'session' }
        case 'year': return { family: 'datetime', fields: 'year' }
        case 'json': return { family: 'document', format: 'json' }
        case 'enum': case 'set': return { family: 'enumeration', values: args.map(unquotedArgument), multiple: key === 'set' || undefined }
        case 'geomcollection': return { family: 'spatial', model: 'geometry', subtype: 'geometrycollection' }
        case 'vector': return { family: 'vector', dimensions: n0, element: 'float32' }
    }
    for (const [name, length] of texts) {
        if (key === name || key === 'long varchar' && name === 'mediumtext') {
            return { family: 'character string', length, largeObject: true }
        }
    }
    for (const [name, length] of blobs) {
        if (key === name) {
            return { family: 'binary string', length, largeObject: true }
        }
    }
    const geometry = key.replace(/ srid \d+$/, '')
    if (geometries.includes(geometry)) {
        const srid = /srid (\d+)$/.exec(key)?.[1]
        return { family: 'spatial', model: 'geometry', subtype: geometry === 'geometry' ? undefined : geometry, srid: srid ? Number(srid) : undefined }
    }
    if (database === 'mariaDB') {
        switch (key) {
            case 'uuid': return { family: 'uuid' }
            case 'inet4': return { family: 'network address', kind: 'inet', ipFamily: 4 }
            case 'inet6': return { family: 'network address', kind: 'inet', ipFamily: 6 }
            case 'xmltype': return { family: 'document', format: 'xml' }
            case 'clob': return { family: 'character string', length: 4294967295, largeObject: true }
            case 'number': return { family: 'exact numeric', precision: n0, scale: n0 === undefined ? undefined : n1 ?? 0 }
            case 'varchar2': return { family: 'character string', length: n0 }
            case 'raw': return { family: 'binary string', length: n0 }
        }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}

export function mySqlMariaDBSqlDataTypeFrom(nativeName: string, database: MySqlMariaDB): SqlDataType {
    // A new object from the reading of the name: its native name is set on it, not on a copy
    const sqlDataType = mySqlMariaDBFamilyOf(nativeName, database) as { native?: SqlDataTypeNative }
    sqlDataType.native = database === 'mySql' ? { mySql: nativeName } : { mariaDB: nativeName }
    return sqlDataType as SqlDataType
}

function quoted(value: string): string {
    return "'" + value.split("'").join("''") + "'"
}

/**
 * The type of MySQL or MariaDB for the SQL data type, in that version, or undefined when it can't hold it; a uuid as the
 * connection stores it (uuidStrategy)
 */
export function mySqlMariaDBNativeSqlDataTypeOf(sqlDataType: SqlDataType, database: MySqlMariaDB, compatibilityVersion: number, uuidStrategy: string): string | undefined {
    const mariaDB = database === 'mariaDB'
    const native = nativeNameFor(sqlDataType, database)
    if (native !== undefined) {
        return native
    }
    switch (sqlDataType.family) {
        case 'exact numeric': {
            const { bytes, unsigned, precision: digits, scale } = sqlDataType
            const sign = unsigned ? ' unsigned' : ''
            if (bytes !== undefined) {
                const name = bytes === 1 ? 'tinyint' : bytes === 2 ? 'smallint' : bytes === 3 ? 'mediumint' : bytes === 4 ? 'int' : 'bigint'
                return name + sign
            }
            if (digits === undefined) {
                // A decimal without a limit (PostgreSQL numeric, Oracle NUMBER) doesn't fit in any decimal of MySQL
                return undefined
            }
            return digits > 65 || (scale ?? 0) > (database === 'mySql' ? 30 : 38) ? undefined : 'decimal(' + digits + ', ' + (scale ?? 0) + ')' + sign
        }
        case 'approximate numeric':
            return sqlDataType.precision !== undefined && sqlDataType.precision <= 24 ? 'float' : 'double'
        case 'boolean':
            return 'tinyint(1)'
        case 'character string': {
            const { length, fixed, largeObject } = sqlDataType
            if (fixed) {
                return (length ?? 1) <= 255 ? 'char(' + (length ?? 1) + ')' : undefined
            }
            if (length !== undefined && !largeObject && length <= 16383) {
                return 'varchar(' + length + ')'
            }
            return (texts.find(([, max]) => length !== undefined && length <= max) ?? texts[texts.length - 1]!)[0]
        }
        case 'binary string': {
            const { length, fixed, largeObject, external } = sqlDataType
            if (external) return undefined
            if (fixed) return (length ?? 1) <= 255 ? 'binary(' + (length ?? 1) + ')' : undefined
            if (length !== undefined && !largeObject && length <= 65535) return 'varbinary(' + length + ')'
            return (blobs.find(([, max]) => length !== undefined && length <= max) ?? blobs[blobs.length - 1]!)[0]
        }
        case 'datetime': {
            const { fields, timeZone } = sqlDataType
            const p = precisionSuffix(sqlDataType.precision)
            if (fields === 'date') return 'date'
            if (fields === 'year') return 'year'
            if (fields === 'time') return timeZone === undefined || timeZone === 'none' ? 'time' + p : undefined
            if (timeZone === 'session') return 'timestamp' + p
            return timeZone === undefined || timeZone === 'none' ? 'datetime' + p : undefined
        }
        case 'uuid':
            if (uuidStrategy === 'string' || uuidStrategy === 'string as sent') return 'char(36)'
            if (uuidStrategy === 'binary') return 'binary(16)'
            // MariaDB's UUID came in 10.7
            return mariaDB && compatibilityVersion >= 10_007_000 ? 'uuid' : 'char(36)'
        case 'document':
            // MySQL's JSON came in 5.7.8 (MariaDB's is an alias of longtext); MariaDB's XMLTYPE in 12.3
            if (sqlDataType.format === 'json') return mariaDB || compatibilityVersion >= 5_007_008 ? 'json' : undefined
            return sqlDataType.format === 'xml' && mariaDB && compatibilityVersion >= 12_003_000 ? 'xmltype' : undefined
        case 'spatial': {
            const { model, subtype, srid } = sqlDataType
            if (model !== 'geometry') return undefined
            return (subtype ?? 'geometry') + (srid === undefined ? '' : ' srid ' + srid)
        }
        case 'network address':
            // MariaDB's INET6 came in 10.5, INET4 in 10.10
            if (!mariaDB || sqlDataType.kind !== 'inet') return undefined
            if (sqlDataType.ipFamily === 4 && compatibilityVersion >= 10_010_000) return 'inet4'
            return compatibilityVersion >= 10_005_000 ? 'inet6' : undefined
        case 'bit string':
            return (sqlDataType.length ?? 1) <= 64 ? 'bit(' + (sqlDataType.length ?? 1) + ')' : undefined
        case 'enumeration':
            return sqlDataType.values === undefined ? undefined : (sqlDataType.multiple ? 'set' : 'enum') + '(' + sqlDataType.values.map(quoted).join(', ') + ')'
        case 'vector':
            // VECTOR came in MySQL 9.0 and MariaDB 11.7
            if (compatibilityVersion < (mariaDB ? 11_007_000 : 9_000_000)) return undefined
            return sqlDataType.element === undefined || sqlDataType.element === 'float32' ? (sqlDataType.storage === 'sparse' ? undefined : 'vector' + precisionSuffix(sqlDataType.dimensions)) : undefined
        case 'user-defined':
            return sqlDataType.name
        default:
            return undefined
    }
}

/** `(n)`, or nothing without a number */
function precisionSuffix(value: number | undefined): string {
    return value === undefined ? '' : '(' + value + ')'
}
