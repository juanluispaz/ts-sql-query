import type { NAggregate, NConnection, NNotNestedAggregate, NSource } from '../utils/sourceName.js'
import { argumentNumber, nativeNameFor, nativeTypeParts } from '../utils/sqlDataTypeNames.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { PostgreSqlSqlBuilder, postgreSqlZonedValueSql } from '../sqlBuilders/PostgreSqlSqlBuilder.js'
import type { IntervalSqlDataTypeFields, SqlDataType, SqlDataTypeNative, TypeAdapterProjectionContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import { __isInstantClass, __isLocalDateTimeClass, __isLocalTimeClass, __isZonedDateTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { AggregatedArrayColumns, SourceOfAggregatedArray, TransactionIsolationLevel } from './AbstractConnection.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { source, valueType } from '../utils/symbols.js'
import { __createAggregateFunction1, __createAggregateFunction1or2, __createAggregateValueAsArray, __asNodeValueSource } from '../typeSystem/valueSourceFactory.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'
import { postgreSqlZonedParam } from '../utils/metadataSymbols.js'
import type { ValueSourceOf, TypedValueSource } from '../typeSystem/valueSource.js'
import type { AggregatedArrayProjectableAsNullableType, AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'
import type { IValueSource, RemapValueSourceTypeWithOptionalType, ValueSource } from '../typeSystem/base.js'
import type { StringType } from '../typeSystem/strings.js'
import { __typeClassOf } from '../typeSystem/valueSourceFactory.js'
import { __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'

export abstract class PostgreSqlConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'postgreSql', NAME>> {
    /**
     * The SQL data type of a type of PostgreSQL, written as `format_type` (`numeric(18,4)`, `character varying(20)`, `timestamp(3) with time zone`, `integer[]`), aliases
     * accepted, with that name as its native one: for `withSqlDataType`, or a generator that reads the catalogue
     */
    override sqlDataTypeFrom(nativeName: string): SqlDataType {
        // A new object from the reading of the name: its native name is set on it, not on a copy
        const sqlDataType = postgreSqlFamilyOf(nativeName) as { native?: SqlDataTypeNative }
        sqlDataType.native = { postgreSql: nativeName }
        return sqlDataType as SqlDataType
    }
    /**
     * The type of PostgreSQL for a SQL data type: its native name of PostgreSQL when it has one, otherwise from its family and
     * its properties; undefined when PostgreSQL can't hold it (never another type)
     */
    protected override buildNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
        return postgreSqlNativeSqlDataTypeOf(sqlDataType, this.compatibilityVersion)
    }

    /**
     * Minimum PostgreSQL version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `18_000_000` for
     * PostgreSQL 18). Defaults to `Number.POSITIVE_INFINITY` (latest).
     *
     * Recognised breakpoints:
     * - `>= 18_000_000`: target PostgreSQL 18+. `UPDATE ... RETURNING` references
     *   on a table-or-view returned by `.oldValues()` are emitted as `old.col`
     *   directly (added in PostgreSQL 18 as native `OLD`/`NEW` qualifiers for
     *   `RETURNING` in `INSERT`/`UPDATE`/`DELETE`/`MERGE`), and the legacy
     *   `FROM (subquery FOR NO KEY UPDATE) AS _old_` trick is no longer emitted.
     *   Below this breakpoint, the FROM-subquery is used to capture pre-update
     *   values and the updated table is aliased as `_new_`.
     */
    /** Durations are kept in the intervals of the database */
    protected override hasNativeDurations(): boolean {
        return true
    }
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    /**
     * With a databaseTimeZone other than UTC, a localDateTime, a localTime or an instant parameter goes as a timestamptz of its
     * instant, which the database converts with its session (the zone of the database) into the wall clock it stores
     * or compares with
     */
    protected override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown {
        if (this.isDatabaseOutsideUtc()) {
            if (__isLocalDateTimeClass(context.requestedType) || __isLocalTimeClass(context.requestedType) || __isInstantClass(context.requestedType)) {
                context.setMetadata(postgreSqlZonedParam, true)
            }
        }
        return super.transformValueToDB(value, context)
    }
    /**
     * With a databaseTimeZone other than UTC, a localDateTime or a localTime leaves the database as the instant the
     * database completes with its session, `(<sql>)::timestamptz` (see postgreSqlZonedValueSql), and as its text inside
     * the JSON of an aggregated array
     */
    protected override transformProjection(sql: string, context: TypeAdapterProjectionContext): string {
        if (__isZonedDateTimeClass(context.requestedType)) {
            // A zoned date and time leaves the database as a text of its instant and its zone, also inside the JSON of an
            // aggregated array, which the SQL builder writes with the zone the query knows (it compares as equal for the
            // same instant and zone)
            context.comparison = 'equality'
            return sql
        }
        if (this.isDatabaseOutsideUtc()) {
            const zoned = postgreSqlZonedValueSql(sql, context.requestedType, this.dateToConvertTimesBetweenZones)
            if (zoned) {
                return context.output === 'aggregatedArrayValue' ? zoned + '::text' : zoned
            }
        }
        return super.transformProjection(sql, context)
    }

    /**
     * Use PostgreSQL's native, platform-dependent `round(double precision)`
     * when applying `.round()` to a `double precision` expression (most
     * commonly anything that flows through `.divide(...)`, which the
     * SqlBuilder always casts to `::float`).
     *
     * Per the PostgreSQL manual, `round(numeric)` breaks ties by rounding
     * **away from zero** (so `round(0.5) → 1`), while `round(double
     * precision)` defers to libm — *"the tie-breaking behavior is platform
     * dependent, but 'round to nearest even' is the most common rule"* (so
     * `round(0.5) → 0` on most systems). ts-sql-query rounds away from zero on
     * every dialect, so by default the library casts the operand of `.round()`
     * to `numeric` on PostgreSQL to make the behavior portable and predictable
     * across dialects. MySQL / MariaDB draw the same distinction between exact
     * and approximate operands and carry the same flag.
     *
     * Setting this flag to `true` opts out of the cast: the result of
     * `.round()` then follows whatever `round(double precision)` does on the
     * underlying libm. Use it when you want PostgreSQL's native
     * `round(double precision)` semantics — typically because the
     * application is single-dialect and prefers the IEEE 754 round-to-even
     * tie-breaking common on modern systems, or because existing queries
     * depend on it.
     */
    protected usePlatformDependentRound: boolean = false

    /**
     * Whether the functions of the library are in the database (its file of SQL, tsq-functions.sql): `'installed'` or
     * `'not installed'` (the default). The ones a query always needs, of durations and of differences of zoned dates and
     * times in days, are called anyway. With them installed the library also calls:
     * - `tsq_zoned_of_wall`, to take a wall clock to its zone (`toZonedDateTime`, and the arithmetic of a zoned date and
     *   time) as Temporal disambiguates it. Without it, a wall clock the zone repeats is the later instant PostgreSQL
     *   gives, where Temporal's default `'compatible'` takes the earlier one, and a disambiguation `'earlier'` or
     *   `'reject'` is rejected when the query is built.
     * - `tsq_zone`, a zone of a value of the query (like the zone of a zoned date and time kept as its text) as
     *   `at time zone` takes it, and `tsq_zoned_offset`, for `offset()`, which write the zone once; without them, a
     *   `CASE` repeats it.
     * - `tsq_greatest_strict` and `tsq_least_strict`, for `minValue` and `maxValue`, which give null for a null operand
     *   writing each operand once; without them, a `CASE` repeats them.
     */
    protected libraryFunctions: 'installed' | 'not installed' = 'not installed'

    /**
     * Writes the insensitive operations with a pattern (`likeInsensitive`, `containsInsensitive`...) with `like` instead
     * of `ilike`. By default they use `ilike`. What they do depends on `insensitiveCollation`:
     * - A name: `x like y collate "name"`. The collation decides, so one that distinguishes case distinguishes it here too.
     * - `''`: `x like y`. The collation of the column decides.
     * - Unset: `lower(x) like lower(y)`. They still ignore case.
     *
     * PostgreSQL rejects `ilike` with a nondeterministic collation, and accepts `like` with one from PostgreSQL 18.
     */
    protected useLikeInsteadOfIlike: boolean = false

    /**
     * Keep PostgreSQL's native NULL handling for `.minValue(x)` / `.maxValue(x)`.
     *
     * PostgreSQL's `least(a, b)` / `greatest(a, b)` **ignore** a NULL operand and
     * return the present value, whereas the library's type declares the result
     * optional whenever either operand is optional (the same OR rule `add` /
     * `subtract` / `concat` use) — i.e. a NULL operand should propagate to a NULL
     * result. By default (`false`) the library wraps `least` / `greatest` in a
     * `CASE` so a NULL operand poisons the result, matching the declared type and
     * the other dialects (MySQL / MariaDB / Oracle / SQLite already propagate).
     *
     * Setting this flag to `true` keeps the bare native `least` / `greatest`, which
     * ignores NULL. With {@link libraryFunctions} installed, the NULL propagation calls
     * functions of the library instead of the operand-repeating `CASE`.
     */
    protected ignoreNullInMinAndMaxValue: boolean = false



    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
    }

    aggregateAsArrayDistinct<COLUMNS extends AggregatedArrayColumns<NConnection<'postgreSql', NAME>>>(columns: COLUMNS & NNotNestedAggregate<SourceOfAggregatedArray<COLUMNS>, NConnection<'postgreSql', NAME>>): ValueSource<SourceOfAggregatedArray<COLUMNS> | NAggregate<NConnection<'postgreSql', NAME>>, AggregatedArrayProjectableAsNullableType<Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>>, 'required'> {
        return __createAggregateValueAsArray(columns as QueryColumns, 'InnerResultObject', 'required', true)
    }
    aggregateAsArrayOfOneColumnDistinct<VALUE extends TypedValueSource<any, any, any>>(value: VALUE & NNotNestedAggregate<VALUE[typeof source], NConnection<'postgreSql', NAME>>): ValueSource<VALUE[typeof source] | NAggregate<NConnection<'postgreSql', NAME>>, AggregatedArrayType<Array<VALUE[typeof valueType]>>, 'required'> {
        return __createAggregateValueAsArray(value, 'InnerResultObject', 'required', true)
    }
    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'postgreSql', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'postgreSql', NAME>>): ValueSource<SOURCE | NAggregate<NConnection<'postgreSql', NAME>>, StringType, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'postgreSql', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'postgreSql', NAME>>, separator: string): ValueSource<SOURCE | NAggregate<NConnection<'postgreSql', NAME>>, StringType, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const nodeValue = __asNodeValueSource(value)
        return __createAggregateFunction1or2('_stringConcatDistinct', separator, value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')
    }

    anyValue<TYPE extends TypedValueSource<any, any, any>>(value: TYPE & SameDB<NConnection<'postgreSql', NAME>> & NNotNestedAggregate<TYPE[typeof source], NConnection<'postgreSql', NAME>>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<NConnection<'postgreSql', NAME>>, TYPE, 'optional'> {
        const nodeValue = __asNodeValueSource(value)
        return (__createAggregateFunction1('_anyValue', value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')) as any
    }

    default(): Default {
        return new DefaultImpl()
    }

    isolationLevel(level: 'read committed' | 'snapshot' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'postgreSql', NAME>>
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'postgreSql', NAME>>
    isolationLevel(level: 'read committed' | 'snapshot' | 'serializable' | 'read write' | 'read only', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'postgreSql', NAME>> {
        if (level === 'read write' || level === 'read only') {
            return [undefined, level] as any
        }
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
    }

}

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
    switch (key) {
        case 'smallint': case 'int2': return { family: 'exact numeric', scale: 0, bytes: 2 }
        case 'integer': case 'int': case 'int4': return { family: 'exact numeric', scale: 0, bytes: 4 }
        case 'bigint': case 'int8': return { family: 'exact numeric', scale: 0, bytes: 8 }
        case 'numeric': case 'decimal':
            return { family: 'exact numeric', precision: n0, scale: n0 === undefined ? undefined : n1 ?? 0 }
        case 'real': case 'float4': return { family: 'approximate numeric', precision: 24 }
        case 'double precision': case 'float8': return { family: 'approximate numeric', precision: 53 }
        case 'float': return { family: 'approximate numeric', precision: n0 !== undefined && n0 <= 24 ? 24 : 53 }
        case 'boolean': case 'bool': return { family: 'boolean' }
        case 'character varying': case 'varchar':
            return { family: 'character string', length: n0 }
        case 'character': case 'char': case 'bpchar': return { family: 'character string', length: n0 ?? 1, fixed: true }
        case 'text': case 'citext': return { family: 'character string' }
        case 'name': return { family: 'character string', length: 63, lengthUnit: 'octets' }
        case '"char"': return { family: 'character string', length: 1, lengthUnit: 'octets', fixed: true }
        case 'bytea': return { family: 'binary string' }
        case 'date': return { family: 'datetime', fields: 'date' }
        case 'time': case 'time without time zone': return { family: 'datetime', fields: 'time', precision: n0, timeZone: 'none' }
        case 'time with time zone': case 'timetz': return { family: 'datetime', fields: 'time', precision: n0, timeZone: 'kept' }
        case 'timestamp': case 'timestamp without time zone': return { family: 'datetime', fields: 'timestamp', precision: n0, timeZone: 'none' }
        case 'timestamp with time zone': case 'timestamptz': return { family: 'datetime', fields: 'timestamp', precision: n0, timeZone: 'instant' }
        case 'uuid': return { family: 'uuid' }
        case 'json': case 'jsonb': case 'xml': case 'jsonpath': return { family: 'document', format: key }
        case 'point': case 'line': case 'lseg': case 'box': case 'path': case 'polygon': case 'circle':
            return { family: 'spatial', model: 'planar', subtype: key }
        case 'geometry': case 'geography': {
            const srid = argumentNumber(args[1])
            const subtype = args[0]?.toLowerCase()
            return { family: 'spatial', model: key, subtype: subtype || undefined, srid }
        }
        case 'raster': return { family: 'spatial', model: 'raster' }
        case 'inet': case 'cidr': case 'macaddr': case 'macaddr8': return { family: 'network address', kind: key }
        case 'bit': return { family: 'bit string', length: n0 ?? 1, fixed: true }
        case 'bit varying': case 'varbit': return { family: 'bit string', length: n0 }
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
        case 'vector': return { family: 'vector', dimensions: n0, element: 'float32' }
        case 'halfvec': return { family: 'vector', dimensions: n0, element: 'float16' }
        case 'sparsevec': return { family: 'vector', dimensions: n0, element: 'float32', storage: 'sparse' }
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
        const known = intervalFields.find(field => field === fields)
        if (fields === '' || known) {
            return { family: 'interval', fields: known, precision: n0 }
        }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}

/** The SQL data type of a type of PostgreSQL, as its catalogue writes it (`format_type`), aliases accepted */

function precisionSuffix(precision: number | undefined): string {
    return precision === undefined ? '' : '(' + precision + ')'
}

/**
 * The type of PostgreSQL for the SQL data type, in that version, or undefined when PostgreSQL can't hold it, by the
 * names best known in PostgreSQL: `int2`, `int4`, `int8`, `float4`, `float8`, `varchar(n)`, `char(n)`, `timestamptz`,
 * `timetz`; a boolean is a `boolean`, as in TypeScript
 */
function postgreSqlNativeSqlDataTypeOf(sqlDataType: SqlDataType, compatibilityVersion: number): string | undefined {
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
                if (size <= 2) return 'int2'
                if (size <= 4) return 'int4'
                if (size <= 8) return 'int8'
                return 'numeric(20, 0)'
            }
            if (precision === undefined) {
                return 'numeric'
            }
            return precision > 1000 ? undefined : 'numeric(' + precision + ', ' + (scale ?? 0) + ')'
        }
        case 'approximate numeric':
            return sqlDataType.precision !== undefined && sqlDataType.precision <= 24 ? 'float4' : 'float8'
        case 'boolean':
            return 'boolean'
        case 'character string':
            if (sqlDataType.fixed) {
                return 'char(' + (sqlDataType.length ?? 1) + ')'
            }
            return sqlDataType.length === undefined || sqlDataType.largeObject ? 'text' : 'varchar(' + sqlDataType.length + ')'
        case 'binary string':
            return sqlDataType.external ? undefined : 'bytea'
        case 'datetime': {
            const { fields, precision, timeZone } = sqlDataType
            if (fields === 'date') return 'date'
            if (fields === 'year') return undefined
            if (fields === 'time') {
                if (timeZone === 'kept') return 'timetz' + precisionSuffix(precision)
                return timeZone === undefined || timeZone === 'none' ? 'time' + precisionSuffix(precision) : undefined
            }
            if (timeZone === 'instant') return 'timestamptz' + precisionSuffix(precision)
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
                const element = of === undefined ? undefined : postgreSqlNativeSqlDataTypeOf(of, compatibilityVersion)
                return element === undefined ? undefined : element + '[]'
            }
            if (sqlDataType.kind === 'map') {
                return of === undefined || of.family === 'character string' ? 'hstore' : undefined
            }
            if (sqlDataType.kind === 'range' || sqlDataType.kind === 'multirange') {
                const range = of === undefined ? undefined : rangeNameOf(of)
                if (range === undefined) return undefined
                // The multiranges came in PostgreSQL 14
                return sqlDataType.kind === 'range' ? range : compatibilityVersion >= 14_000_000 ? range.replace(/range$/, 'multirange') : undefined
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
            // xid8 and pg_snapshot came in PostgreSQL 13
            return (sqlDataType.kind === 'xid8' || sqlDataType.kind === 'pg_snapshot') && compatibilityVersion < 13_000_000 ? undefined : sqlDataType.kind
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

const intervalFields: readonly IntervalSqlDataTypeFields[] = ['year', 'month', 'day', 'hour', 'minute', 'second', 'year to month',
    'day to hour', 'day to minute', 'day to second', 'hour to minute', 'hour to second', 'minute to second']
