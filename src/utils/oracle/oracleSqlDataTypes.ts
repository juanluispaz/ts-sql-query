import type { SqlDataType } from '../../TypeAdapter.js'
import { argumentNumber, integerDigits, nativeNameFor, nativeTypeParts, withNative } from '../sqlDataTypeNames.js'

/** The length of a text of Oracle, `50`, `50 byte` or `50 char` */
function textLength(arg: string | undefined): { length?: number, lengthUnit?: 'characters' | 'octets' } {
    const match = arg === undefined ? null : /^(\d+)\s*(byte|char)?$/i.exec(arg.trim())
    if (!match) return {}
    const unit = match[2]?.toLowerCase()
    return { length: Number(match[1]), ...(unit === 'char' ? { lengthUnit: 'characters' as const } : unit === 'byte' ? { lengthUnit: 'octets' as const } : {}) }
}

/** The type of the name as Oracle writes it (`NUMBER(18,4)`, `VARCHAR2(50 CHAR)`, `TIMESTAMP(6) WITH TIME ZONE`), aliases accepted */
function oracleFamilyOf(nativeName: string): SqlDataType {
    const { key: fullKey, args } = nativeTypeParts(nativeName)
    // A type of a schema, like SYS.XMLTYPE or MDSYS.SDO_GEOMETRY
    const key = fullKey.replace(/^(sys|mdsys|public)\./, '')
    const n0 = argumentNumber(args[0])
    const n1 = argumentNumber(args[1])
    const time = (timeZone: 'none' | 'session' | 'kept'): SqlDataType => ({ family: 'datetime', fields: 'timestamp', precision: n0 ?? 6, timeZone })
    switch (key) {
        case 'number': case 'numeric': case 'decimal': case 'dec':
            if (n0 === undefined) return { family: 'exact numeric' }
            return { family: 'exact numeric', precision: n0, scale: n1 ?? 0 }
        case 'integer': case 'int': case 'smallint': return { family: 'exact numeric', precision: 38, scale: 0 }
        case 'float': return { family: 'approximate numeric', precision: n0 ?? 126 }
        case 'real': return { family: 'approximate numeric', precision: 63 }
        case 'double precision': return { family: 'approximate numeric', precision: 126 }
        case 'binary_float': return { family: 'approximate numeric', precision: 24 }
        case 'binary_double': return { family: 'approximate numeric', precision: 53 }
        case 'boolean': case 'bool': return { family: 'boolean' }
        case 'char': case 'character': return { family: 'character string', ...textLength(args[0] ?? '1'), fixed: true }
        case 'varchar2': case 'varchar': case 'character varying': case 'char varying': return { family: 'character string', ...textLength(args[0]) }
        case 'nchar': case 'national character': case 'national char': return { family: 'character string', length: n0 ?? 1, fixed: true, national: true }
        case 'nvarchar2': case 'national character varying': case 'national char varying': case 'nchar varying':
            return { family: 'character string', ...textLength(args[0]), national: true }
        case 'clob': case 'long': return { family: 'character string', largeObject: true }
        case 'nclob': return { family: 'character string', national: true, largeObject: true }
        case 'raw': return { family: 'binary string', ...(n0 !== undefined ? { length: n0 } : {}) }
        case 'blob': case 'long raw': return { family: 'binary string', largeObject: true }
        case 'bfile': return { family: 'binary string', largeObject: true, external: true }
        case 'date': return { family: 'datetime', fields: 'timestamp', precision: 0, timeZone: 'none' }
        case 'timestamp': return time('none')
        case 'timestamp with local time zone': return time('session')
        case 'timestamp with time zone': return time('kept')
        // The leading precision (the digits of the years or the days) isn't a property of the family: the native name keeps it
        case 'interval year to month': return { family: 'interval', fields: 'year to month' }
        case 'interval day to second': {
            const fraction = /second\s*\(\s*(\d+)\s*\)/i.exec(nativeName)?.[1]
            return { family: 'interval', fields: 'day to second', precision: fraction === undefined ? 6 : Number(fraction) }
        }
        case 'json': return { family: 'document', format: 'json' }
        case 'xmltype': return { family: 'document', format: 'xml' }
        case 'sdo_geometry': return { family: 'spatial', model: 'geometry' }
        case 'rowid': return { family: 'row locator', kind: 'physical' }
        case 'urowid': return { family: 'row locator', kind: 'universal' }
        case 'anydata': return { family: 'variant' }
        case 'vector': {
            const format = args[1]?.trim().toLowerCase()
            const element = format === 'int8' ? 'int8' : format === 'float64' ? 'float64' : format === 'binary' ? 'binary' : format === 'float32' ? 'float32' : undefined
            const storage = args[2]?.trim().toLowerCase() === 'sparse' ? 'sparse' : undefined
            return { family: 'vector', ...(n0 !== undefined ? { dimensions: n0 } : {}), ...(element ? { element } : {}), ...(storage ? { storage } : {}) }
        }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}

export function oracleSqlDataTypeFrom(nativeName: string): SqlDataType {
    return withNative(oracleFamilyOf(nativeName), 'oracle', nativeName)
}

/** The type of Oracle for the SQL data type, or undefined when Oracle can't hold it */
export function oracleNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
    const native = nativeNameFor(sqlDataType, 'oracle')
    if (native !== undefined) {
        return native
    }
    if (sqlDataType.domain !== undefined) {
        return sqlDataType.domain
    }
    const fraction = (precision: number | undefined): string | undefined => precision === undefined ? '' : precision <= 9 ? '(' + precision + ')' : undefined
    switch (sqlDataType.family) {
        case 'exact numeric': {
            const { bytes, unsigned, precision, scale } = sqlDataType
            if (bytes !== undefined) return 'NUMBER(' + integerDigits(bytes, !!unsigned) + ')'
            if (precision === undefined) return 'NUMBER'
            return precision > 38 ? undefined : 'NUMBER(' + precision + ', ' + (scale ?? 0) + ')'
        }
        case 'approximate numeric':
            return sqlDataType.precision !== undefined && sqlDataType.precision <= 24 ? 'BINARY_FLOAT' : 'BINARY_DOUBLE'
        case 'boolean':
            return 'BOOLEAN'
        case 'character string': {
            const { length, lengthUnit, fixed, national, largeObject } = sqlDataType
            const unit = lengthUnit === 'characters' && !national ? ' CHAR' : lengthUnit === 'octets' && !national ? ' BYTE' : ''
            if (fixed) return (length ?? 1) <= 2000 ? (national ? 'NCHAR(' : 'CHAR(') + (length ?? 1) + unit + ')' : undefined
            if (length === undefined || largeObject || length > 32767) return national ? 'NCLOB' : 'CLOB'
            return (national ? 'NVARCHAR2(' : 'VARCHAR2(') + length + unit + ')'
        }
        case 'binary string': {
            const { length, largeObject, external } = sqlDataType
            if (external) return 'BFILE'
            if (length === undefined || largeObject || length > 32767) return 'BLOB'
            return 'RAW(' + length + ')'
        }
        case 'datetime': {
            const { fields, timeZone } = sqlDataType
            const p = fraction(sqlDataType.precision)
            if (p === undefined) return undefined
            if (fields === 'date') return 'DATE'
            if (fields !== 'timestamp') return undefined
            if (timeZone === 'session') return 'TIMESTAMP' + p + ' WITH LOCAL TIME ZONE'
            if (timeZone === 'kept') return 'TIMESTAMP' + p + ' WITH TIME ZONE'
            return timeZone === undefined || timeZone === 'none' ? 'TIMESTAMP' + p : undefined
        }
        case 'interval': {
            const { fields, precision } = sqlDataType
            if (fields === 'year to month') return 'INTERVAL YEAR TO MONTH'
            if (fields === 'day to second') return 'INTERVAL DAY TO SECOND' + (precision === undefined ? '' : '(' + precision + ')')
            return undefined
        }
        case 'document':
            return sqlDataType.format === 'json' ? 'JSON' : sqlDataType.format === 'xml' ? 'XMLTYPE' : undefined
        case 'spatial':
            return sqlDataType.model === 'geometry' ? 'SDO_GEOMETRY' : undefined
        case 'row locator':
            return sqlDataType.kind === 'physical' ? 'ROWID' : 'UROWID'
        case 'variant':
            return 'ANYDATA'
        case 'vector': {
            const { dimensions, element, storage } = sqlDataType
            if (element === 'float16') return undefined
            const format = element === undefined ? '*' : element.toUpperCase()
            return 'VECTOR(' + (dimensions ?? '*') + ', ' + format + (storage === 'sparse' ? ', SPARSE' : '') + ')'
        }
        case 'structured':
            return sqlDataType.reference ? 'REF ' + sqlDataType.name : sqlDataType.name
        case 'user-defined':
            return sqlDataType.name
        default:
            return undefined
    }
}
