import type { SqlDataType } from '../../TypeAdapter.js'
import { argumentNumber, nativeNameFor, nativeTypeParts, unquotedArgument, withNative } from '../sqlDataTypeNames.js'

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
        return unsigned ? { family: 'exact numeric', scale: 0, bytes, unsigned } : { family: 'exact numeric', scale: 0, bytes }
    }
    const sized = (length: number | undefined): { length?: number } => length === undefined ? {} : { length }
    switch (key) {
        case 'bool': case 'boolean': return { family: 'boolean' }
        case 'decimal': case 'dec': case 'numeric': case 'fixed':
            return { family: 'exact numeric', precision: n0 ?? 10, scale: n1 ?? 0, ...(unsigned ? { unsigned } : {}) }
        case 'float': case 'float4': return { family: 'approximate numeric', precision: n0 !== undefined && args.length === 1 && n0 > 24 ? 53 : 24 }
        case 'double': case 'double precision': case 'real': case 'float8': return { family: 'approximate numeric', precision: 53 }
        case 'bit': return { family: 'bit string', length: n0 ?? 1, fixed: true }
        case 'char': case 'character': return { family: 'character string', length: n0 ?? 1, fixed: true }
        case 'varchar': case 'character varying': return { family: 'character string', ...sized(n0) }
        case 'nchar': case 'national char': case 'national character': return { family: 'character string', length: n0 ?? 1, fixed: true, national: true }
        case 'nvarchar': case 'national varchar': case 'national character varying': case 'nchar varchar': return { family: 'character string', ...sized(n0), national: true }
        case 'binary': return { family: 'binary string', length: n0 ?? 1, fixed: true }
        case 'varbinary': return { family: 'binary string', ...sized(n0) }
        case 'date': return { family: 'datetime', fields: 'date' }
        case 'time': return { family: 'datetime', fields: 'time', ...(n0 !== undefined ? { precision: n0 } : {}), timeZone: 'none' }
        case 'datetime': return { family: 'datetime', fields: 'timestamp', ...(n0 !== undefined ? { precision: n0 } : {}), timeZone: 'none' }
        case 'timestamp': return { family: 'datetime', fields: 'timestamp', ...(n0 !== undefined ? { precision: n0 } : {}), timeZone: 'session' }
        case 'year': return { family: 'datetime', fields: 'year' }
        case 'json': return { family: 'document', format: 'json' }
        case 'enum': case 'set': return { family: 'enumeration', values: args.map(unquotedArgument), ...(key === 'set' ? { multiple: true } : {}) }
        case 'geomcollection': return { family: 'spatial', model: 'geometry', subtype: 'geometrycollection' }
        case 'vector': return n0 === undefined ? { family: 'vector', element: 'float32' } : { family: 'vector', dimensions: n0, element: 'float32' }
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
        return { family: 'spatial', model: 'geometry', ...(geometry === 'geometry' ? {} : { subtype: geometry }), ...(srid ? { srid: Number(srid) } : {}) }
    }
    if (database === 'mariaDB') {
        switch (key) {
            case 'uuid': return { family: 'uuid' }
            case 'inet4': return { family: 'network address', kind: 'inet', ipFamily: 4 }
            case 'inet6': return { family: 'network address', kind: 'inet', ipFamily: 6 }
            case 'xmltype': return { family: 'document', format: 'xml' }
            case 'clob': return { family: 'character string', length: 4294967295, largeObject: true }
            case 'number': return n0 === undefined ? { family: 'exact numeric' } : { family: 'exact numeric', precision: n0, scale: n1 ?? 0 }
            case 'varchar2': return { family: 'character string', ...sized(n0) }
            case 'raw': return { family: 'binary string', ...sized(n0) }
        }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}

export function mySqlMariaDBSqlDataTypeFrom(nativeName: string, database: MySqlMariaDB): SqlDataType {
    return withNative(mySqlMariaDBFamilyOf(nativeName, database), database, nativeName)
}

function quoted(value: string): string {
    return "'" + value.split("'").join("''") + "'"
}

/** The type of MySQL or MariaDB for the SQL data type, or undefined when it can't hold it */
export function mySqlMariaDBNativeSqlDataTypeOf(sqlDataType: SqlDataType, database: MySqlMariaDB): string | undefined {
    const native = nativeNameFor(sqlDataType, database)
    if (native !== undefined) {
        return native
    }
    const precision = (value: number | undefined): string => value === undefined ? '' : '(' + value + ')'
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
            const p = precision(sqlDataType.precision)
            if (fields === 'date') return 'date'
            if (fields === 'year') return 'year'
            if (fields === 'time') return timeZone === undefined || timeZone === 'none' ? 'time' + p : undefined
            if (timeZone === 'session') return 'timestamp' + p
            return timeZone === undefined || timeZone === 'none' ? 'datetime' + p : undefined
        }
        case 'uuid':
            return database === 'mariaDB' ? 'uuid' : undefined
        case 'document':
            if (sqlDataType.format === 'json') return 'json'
            return sqlDataType.format === 'xml' && database === 'mariaDB' ? 'xmltype' : undefined
        case 'spatial': {
            const { model, subtype, srid } = sqlDataType
            if (model !== 'geometry') return undefined
            return (subtype ?? 'geometry') + (srid === undefined ? '' : ' srid ' + srid)
        }
        case 'network address':
            if (database !== 'mariaDB' || sqlDataType.kind !== 'inet') return undefined
            return sqlDataType.ipFamily === 4 ? 'inet4' : 'inet6'
        case 'bit string':
            return (sqlDataType.length ?? 1) <= 64 ? 'bit(' + (sqlDataType.length ?? 1) + ')' : undefined
        case 'enumeration':
            return sqlDataType.values === undefined ? undefined : (sqlDataType.multiple ? 'set' : 'enum') + '(' + sqlDataType.values.map(quoted).join(', ') + ')'
        case 'vector':
            return sqlDataType.element === undefined || sqlDataType.element === 'float32' ? (sqlDataType.storage === 'sparse' ? undefined : 'vector' + precision(sqlDataType.dimensions)) : undefined
        case 'user-defined':
            return sqlDataType.name
        default:
            return undefined
    }
}
