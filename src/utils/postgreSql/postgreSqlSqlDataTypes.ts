import type { SqlDataType } from '../../TypeAdapter.js'
import { argumentNumber, nativeNameFor, nativeTypeParts, withNative } from '../sqlDataTypeNames.js'

const ranges: { readonly [name: string]: SqlDataType } = {
    int4range: { family: 'exact numeric', scale: 0, bytes: 4 },
    int8range: { family: 'exact numeric', scale: 0, bytes: 8 },
    numrange: { family: 'exact numeric' },
    tsrange: { family: 'datetime', fields: 'timestamp', timeZone: 'none' },
    tstzrange: { family: 'datetime', fields: 'timestamp', timeZone: 'instant' },
    daterange: { family: 'datetime', fields: 'date' },
}

/** The type of the name as PostgreSQL writes it (`format_type`), aliases accepted, without its native name */
function postgreSqlFamilyOf(nativeName: string): SqlDataType {
    const { key, args, arrayDimensions } = nativeTypeParts(nativeName)
    if (arrayDimensions > 0) {
        const of = postgreSqlFamilyOf(nativeName.replace(/(\[\s*\d*\s*\])+$/, ''))
        return { family: 'collection', kind: 'array', of }
    }
    const n0 = argumentNumber(args[0])
    const n1 = argumentNumber(args[1])
    const time = (fields: 'time' | 'timestamp', timeZone: 'none' | 'instant' | 'kept'): SqlDataType => n0 === undefined ? { family: 'datetime', fields, timeZone } : { family: 'datetime', fields, precision: n0, timeZone }
    switch (key) {
        case 'smallint': case 'int2': return { family: 'exact numeric', scale: 0, bytes: 2 }
        case 'integer': case 'int': case 'int4': return { family: 'exact numeric', scale: 0, bytes: 4 }
        case 'bigint': case 'int8': return { family: 'exact numeric', scale: 0, bytes: 8 }
        case 'numeric': case 'decimal':
            return n0 === undefined ? { family: 'exact numeric' } : { family: 'exact numeric', precision: n0, scale: n1 ?? 0 }
        case 'real': case 'float4': return { family: 'approximate numeric', precision: 24 }
        case 'double precision': case 'float8': return { family: 'approximate numeric', precision: 53 }
        case 'float': return { family: 'approximate numeric', precision: n0 !== undefined && n0 <= 24 ? 24 : 53 }
        case 'boolean': case 'bool': return { family: 'boolean' }
        case 'character varying': case 'varchar':
            return n0 === undefined ? { family: 'character string' } : { family: 'character string', length: n0 }
        case 'character': case 'char': case 'bpchar': return { family: 'character string', length: n0 ?? 1, fixed: true }
        case 'text': case 'citext': return { family: 'character string' }
        case 'name': return { family: 'character string', length: 63, lengthUnit: 'octets' }
        case '"char"': return { family: 'character string', length: 1, lengthUnit: 'octets', fixed: true }
        case 'bytea': return { family: 'binary string' }
        case 'date': return { family: 'datetime', fields: 'date' }
        case 'time': case 'time without time zone': return time('time', 'none')
        case 'time with time zone': case 'timetz': return time('time', 'kept')
        case 'timestamp': case 'timestamp without time zone': return time('timestamp', 'none')
        case 'timestamp with time zone': case 'timestamptz': return time('timestamp', 'instant')
        case 'uuid': return { family: 'uuid' }
        case 'json': case 'jsonb': case 'xml': case 'jsonpath': return { family: 'document', format: key }
        case 'point': case 'line': case 'lseg': case 'box': case 'path': case 'polygon': case 'circle':
            return { family: 'spatial', model: 'planar', subtype: key }
        case 'geometry': case 'geography': {
            const srid = argumentNumber(args[1])
            const subtype = args[0]?.toLowerCase()
            return { family: 'spatial', model: key, ...(subtype ? { subtype } : {}), ...(srid !== undefined ? { srid } : {}) }
        }
        case 'raster': return { family: 'spatial', model: 'raster' }
        case 'inet': case 'cidr': case 'macaddr': case 'macaddr8': return { family: 'network address', kind: key }
        case 'bit': return { family: 'bit string', length: n0 ?? 1, fixed: true }
        case 'bit varying': case 'varbit': return n0 === undefined ? { family: 'bit string' } : { family: 'bit string', length: n0 }
        case 'money': return { family: 'money' }
        case 'tsvector': return { family: 'text search', kind: 'document' }
        case 'tsquery': return { family: 'text search', kind: 'query' }
        case 'tid': return { family: 'row locator', kind: 'physical' }
        case 'oid': case 'regclass': case 'regtype': case 'regproc': case 'regprocedure': case 'regoper': case 'regoperator':
        case 'regconfig': case 'regdictionary': case 'regnamespace': case 'regrole': case 'regcollation':
            return { family: 'system', kind: 'oid' }
        case 'xid': case 'xid8': case 'cid': case 'pg_lsn': case 'pg_snapshot': case 'txid_snapshot':
            return { family: 'system', kind: key }
        case 'hstore': return { family: 'collection', kind: 'map', of: { family: 'character string' } }
        case 'ltree': return { family: 'hierarchy' }
        case 'vector': return n0 === undefined ? { family: 'vector', element: 'float32' } : { family: 'vector', dimensions: n0, element: 'float32' }
        case 'halfvec': return n0 === undefined ? { family: 'vector', element: 'float16' } : { family: 'vector', dimensions: n0, element: 'float16' }
        case 'sparsevec': return n0 === undefined ? { family: 'vector', element: 'float32', storage: 'sparse' } : { family: 'vector', dimensions: n0, element: 'float32', storage: 'sparse' }
    }
    const range = ranges[key]
    if (range) {
        return { family: 'collection', kind: 'range', of: range }
    }
    const multirange = ranges[key.replace(/multirange$/, 'range')]
    if (multirange && key.endsWith('multirange')) {
        return { family: 'collection', kind: 'multirange', of: multirange }
    }
    if (key.startsWith('interval')) {
        const fields = key.slice('interval'.length).trim()
        return { family: 'interval', ...(fields ? { fields } : {}), ...(n0 !== undefined ? { precision: n0 } : {}) }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}

/** The SQL data type of a type of PostgreSQL, as its catalogue writes it (`format_type`), aliases accepted */
export function postgreSqlSqlDataTypeFrom(nativeName: string): SqlDataType {
    return withNative(postgreSqlFamilyOf(nativeName), 'postgreSql', nativeName)
}

function precisionSuffix(precision: number | undefined): string {
    return precision === undefined ? '' : '(' + precision + ')'
}

/** The type of PostgreSQL for the SQL data type, or undefined when PostgreSQL can't hold it */
export function postgreSqlNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
    const native = nativeNameFor(sqlDataType, 'postgreSql')
    if (native !== undefined) {
        return native
    }
    if (sqlDataType.domain !== undefined) {
        return sqlDataType.domain
    }
    switch (sqlDataType.family) {
        case 'exact numeric': {
            const { bytes, unsigned, precision, scale } = sqlDataType
            if (bytes !== undefined) {
                const size = unsigned ? (bytes === 8 ? 16 : bytes * 2) : bytes
                if (size <= 2) return 'smallint'
                if (size <= 4) return 'integer'
                if (size <= 8) return 'bigint'
                return 'numeric(20, 0)'
            }
            if (precision === undefined) {
                return 'numeric'
            }
            return precision > 1000 ? undefined : 'numeric(' + precision + ', ' + (scale ?? 0) + ')'
        }
        case 'approximate numeric':
            return sqlDataType.precision !== undefined && sqlDataType.precision <= 24 ? 'real' : 'double precision'
        case 'boolean':
            return 'boolean'
        case 'character string':
            if (sqlDataType.fixed) {
                return 'character(' + (sqlDataType.length ?? 1) + ')'
            }
            return sqlDataType.length === undefined || sqlDataType.largeObject ? 'text' : 'character varying(' + sqlDataType.length + ')'
        case 'binary string':
            return sqlDataType.external ? undefined : 'bytea'
        case 'datetime': {
            const { fields, precision, timeZone } = sqlDataType
            if (fields === 'date') return 'date'
            if (fields === 'year') return undefined
            if (fields === 'time') {
                if (timeZone === 'kept') return 'time' + precisionSuffix(precision) + ' with time zone'
                return timeZone === undefined || timeZone === 'none' ? 'time' + precisionSuffix(precision) : undefined
            }
            if (timeZone === 'instant') return 'timestamp' + precisionSuffix(precision) + ' with time zone'
            return timeZone === undefined || timeZone === 'none' ? 'timestamp' + precisionSuffix(precision) : undefined
        }
        case 'interval':
            return 'interval' + (sqlDataType.fields ? ' ' + sqlDataType.fields : '') + precisionSuffix(sqlDataType.precision)
        case 'uuid':
            return 'uuid'
        case 'document':
            return sqlDataType.format
        case 'spatial': {
            const { model, subtype, srid } = sqlDataType
            if (model === 'planar') return subtype
            if (model === 'raster') return 'raster'
            if (subtype === undefined) return srid === undefined ? model : model + '(geometry, ' + srid + ')'
            return model + '(' + subtype + (srid === undefined ? '' : ', ' + srid) + ')'
        }
        case 'network address':
            return sqlDataType.kind
        case 'bit string':
            return sqlDataType.fixed ? 'bit(' + (sqlDataType.length ?? 1) + ')' : 'bit varying' + precisionSuffix(sqlDataType.length)
        case 'collection': {
            const of = sqlDataType.of
            if (sqlDataType.kind === 'array') {
                const element = of === undefined ? undefined : postgreSqlNativeSqlDataTypeOf(of)
                return element === undefined ? undefined : element + '[]'
            }
            if (sqlDataType.kind === 'map') {
                return of === undefined || of.family === 'character string' ? 'hstore' : undefined
            }
            if (sqlDataType.kind === 'range' || sqlDataType.kind === 'multirange') {
                const range = of === undefined ? undefined : rangeNameOf(of)
                return range === undefined ? undefined : sqlDataType.kind === 'range' ? range : range.replace(/range$/, 'multirange')
            }
            return undefined
        }
        case 'vector': {
            const { dimensions, element, storage } = sqlDataType
            const name = storage === 'sparse' ? 'sparsevec' : element === 'float16' ? 'halfvec' : element === undefined || element === 'float32' ? 'vector' : undefined
            return name === undefined ? undefined : name + precisionSuffix(dimensions)
        }
        case 'money':
            return 'money'
        case 'text search':
            return sqlDataType.kind === 'document' ? 'tsvector' : 'tsquery'
        case 'row locator':
            return sqlDataType.kind === 'physical' ? 'tid' : undefined
        case 'hierarchy':
            return 'ltree'
        case 'system':
            return sqlDataType.kind
        case 'enumeration':
            return sqlDataType.multiple ? undefined : sqlDataType.name
        case 'structured':
            return sqlDataType.reference ? undefined : sqlDataType.name
        case 'user-defined':
            return sqlDataType.name
        case 'row version':
        case 'variant':
            return undefined
    }
}

function rangeNameOf(of: SqlDataType): string | undefined {
    if (of.family === 'exact numeric') {
        if (of.bytes === 4) return 'int4range'
        if (of.bytes === 8) return 'int8range'
        return of.bytes === undefined ? 'numrange' : undefined
    }
    if (of.family === 'datetime') {
        if (of.fields === 'date') return 'daterange'
        if (of.fields === 'timestamp') return of.timeZone === 'instant' ? 'tstzrange' : of.timeZone === undefined || of.timeZone === 'none' ? 'tsrange' : undefined
    }
    return undefined
}
