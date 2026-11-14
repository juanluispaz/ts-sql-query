import type { SqlDataType } from '../../TypeAdapter.js'
import { argumentNumber, nativeNameFor, nativeTypeParts, withNative } from '../sqlDataTypeNames.js'

/** The length of a type of SQL Server: a number, or undefined for `max` (and when it has none) */
function lengthOf(arg: string | undefined): number | undefined {
    return argumentNumber(arg)
}

/** The type of the name as SQL Server writes it (`varchar(50)`, `nvarchar(max)`, `datetime2(3)`), aliases accepted */
function sqlServerFamilyOf(nativeName: string): SqlDataType {
    const { key, args } = nativeTypeParts(nativeName)
    const n0 = argumentNumber(args[0])
    const n1 = argumentNumber(args[1])
    const isMax = args[0]?.trim().toLowerCase() === 'max'
    const text = (fixed: boolean, national: boolean): SqlDataType => {
        if (fixed) return { family: 'character string', length: n0 ?? 1, fixed: true, national }
        if (isMax) return { family: 'character string', national, largeObject: true }
        return { family: 'character string', length: lengthOf(args[0]) ?? 1, national }
    }
    switch (key) {
        case 'tinyint': return { family: 'exact numeric', scale: 0, bytes: 1, unsigned: true }
        case 'smallint': return { family: 'exact numeric', scale: 0, bytes: 2 }
        case 'int': case 'integer': return { family: 'exact numeric', scale: 0, bytes: 4 }
        case 'bigint': return { family: 'exact numeric', scale: 0, bytes: 8 }
        case 'decimal': case 'dec': case 'numeric': return { family: 'exact numeric', precision: n0 ?? 18, scale: n1 ?? 0 }
        case 'money': return { family: 'money', scale: 4 }
        case 'smallmoney': return { family: 'money', scale: 4 }
        case 'real': return { family: 'approximate numeric', precision: 24 }
        case 'float': case 'double precision': return { family: 'approximate numeric', precision: n0 !== undefined && n0 <= 24 ? 24 : 53 }
        case 'bit': return { family: 'boolean' }
        case 'char': case 'character': return text(true, false)
        case 'varchar': case 'char varying': case 'character varying': return text(false, false)
        case 'nchar': case 'national char': case 'national character': return text(true, true)
        case 'nvarchar': case 'national char varying': case 'national character varying': return text(false, true)
        case 'text': return { family: 'character string', national: false, largeObject: true }
        case 'ntext': case 'national text': return { family: 'character string', national: true, largeObject: true }
        case 'binary': return { family: 'binary string', length: n0 ?? 1, fixed: true }
        case 'varbinary': case 'binary varying':
            return isMax ? { family: 'binary string', largeObject: true } : { family: 'binary string', length: n0 ?? 1 }
        case 'image': return { family: 'binary string', largeObject: true }
        case 'date': return { family: 'datetime', fields: 'date' }
        case 'time': return { family: 'datetime', fields: 'time', precision: n0 ?? 7, timeZone: 'none' }
        case 'datetime2': return { family: 'datetime', fields: 'timestamp', precision: n0 ?? 7, timeZone: 'none' }
        case 'datetime': return { family: 'datetime', fields: 'timestamp', precision: 3, timeZone: 'none' }
        case 'smalldatetime': return { family: 'datetime', fields: 'timestamp', precision: 0, timeZone: 'none' }
        case 'datetimeoffset': return { family: 'datetime', fields: 'timestamp', precision: n0 ?? 7, timeZone: 'kept' }
        case 'uniqueidentifier': return { family: 'uuid' }
        case 'xml': return { family: 'document', format: 'xml' }
        case 'json': return { family: 'document', format: 'json' }
        case 'geometry': case 'geography': return { family: 'spatial', model: key }
        case 'rowversion': case 'timestamp': return { family: 'row version' }
        case 'sql_variant': return { family: 'variant' }
        case 'hierarchyid': return { family: 'hierarchy' }
        case 'vector': {
            const element = args[1]?.trim().toLowerCase() === 'float16' ? 'float16' : 'float32'
            return n0 === undefined ? { family: 'vector', element } : { family: 'vector', dimensions: n0, element }
        }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}

export function sqlServerSqlDataTypeFrom(nativeName: string): SqlDataType {
    return withNative(sqlServerFamilyOf(nativeName), 'sqlServer', nativeName)
}

/** The type of SQL Server for the SQL data type, or undefined when SQL Server can't hold it */
export function sqlServerNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
    const native = nativeNameFor(sqlDataType, 'sqlServer')
    if (native !== undefined) {
        return native
    }
    if (sqlDataType.domain !== undefined) {
        return sqlDataType.domain
    }
    const fraction = (precision: number | undefined): string | undefined => precision === undefined ? '' : precision <= 7 ? '(' + precision + ')' : undefined
    switch (sqlDataType.family) {
        case 'exact numeric': {
            const { bytes, unsigned, precision, scale } = sqlDataType
            if (bytes !== undefined) {
                if (bytes === 1) return unsigned ? 'tinyint' : 'smallint'
                if (bytes === 2) return unsigned ? 'int' : 'smallint'
                if (bytes === 3 || bytes === 4) return unsigned && bytes === 4 ? 'bigint' : 'int'
                return unsigned ? 'decimal(20, 0)' : 'bigint'
            }
            if (precision === undefined || precision > 38) return undefined
            return 'decimal(' + precision + ', ' + (scale ?? 0) + ')'
        }
        case 'approximate numeric':
            return sqlDataType.precision !== undefined && sqlDataType.precision <= 24 ? 'real' : 'float'
        case 'boolean':
            return 'bit'
        case 'character string': {
            // Not stated national is nvarchar, which keeps every character
            const national = sqlDataType.national !== false
            const prefix = national ? 'n' : ''
            const limit = national ? 4000 : 8000
            const { length, fixed, largeObject } = sqlDataType
            if (fixed) return (length ?? 1) <= limit ? prefix + 'char(' + (length ?? 1) + ')' : undefined
            if (length === undefined || largeObject || length > limit) return prefix + 'varchar(max)'
            return prefix + 'varchar(' + length + ')'
        }
        case 'binary string': {
            const { length, fixed, largeObject, external } = sqlDataType
            if (external) return undefined
            if (fixed) return (length ?? 1) <= 8000 ? 'binary(' + (length ?? 1) + ')' : undefined
            if (length === undefined || largeObject || length > 8000) return 'varbinary(max)'
            return 'varbinary(' + length + ')'
        }
        case 'datetime': {
            const { fields, timeZone } = sqlDataType
            const p = fraction(sqlDataType.precision)
            if (p === undefined) return undefined
            if (fields === 'date') return 'date'
            if (fields === 'year') return undefined
            if (fields === 'time') return timeZone === undefined || timeZone === 'none' ? 'time' + p : undefined
            if (timeZone === 'kept') return 'datetimeoffset' + p
            return timeZone === undefined || timeZone === 'none' ? 'datetime2' + p : undefined
        }
        case 'uuid':
            return 'uniqueidentifier'
        case 'document':
            return sqlDataType.format === 'xml' ? 'xml' : sqlDataType.format === 'json' ? 'json' : undefined
        case 'spatial':
            return sqlDataType.model === 'geometry' || sqlDataType.model === 'geography' ? sqlDataType.model : undefined
        case 'money':
            return 'money'
        case 'row version':
            return 'rowversion'
        case 'variant':
            return 'sql_variant'
        case 'hierarchy':
            return 'hierarchyid'
        case 'vector': {
            const { dimensions, element, storage } = sqlDataType
            if (dimensions === undefined || storage === 'sparse') return undefined
            if (element === 'float16') return 'vector(' + dimensions + ', float16)'
            return element === undefined || element === 'float32' ? 'vector(' + dimensions + ')' : undefined
        }
        case 'user-defined':
            return sqlDataType.name
        default:
            return undefined
    }
}
