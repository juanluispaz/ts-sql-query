import { dateOfStoredTimesOf } from '../utils/temporalReference.js'
import { isKeptInADateClass } from '../utils/plainTemporalValues.js'
import type { NAggregate, NConnection, NSource } from '../utils/sourceName.js'
import { argumentNumber, integerDigits, nativeNameFor, nativeTypeParts } from '../utils/sqlDataTypeNames.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { OracleSqlBuilder, oracleZonedValueSql } from '../sqlBuilders/OracleSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import type { source } from '../utils/symbols.js'
import { __createAggregateFunction1, __createAggregateFunction1or2, __asNodeValueSource } from '../typeSystem/valueSourceFactory.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'
import type { SqlDataType, SqlDataTypeNative, TypeAdapterProjectionContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import { __isBooleanClass, __isDurationClass, __isInstantClass, __isLocalDateTimeClass, __isLocalTimeClass, __isPlainDateTimeClass, __isPlainTimeClass, __isZonedDateTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { __durationSqlDataTypeOf } from '../typeSystem/dataTypes.js'
import { isDurationValue } from '../utils/durationValues.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { oracleZonedParam } from '../utils/metadataSymbols.js'
import type { ValueSourceOf, TypedValueSource } from '../typeSystem/valueSource.js'
import type { IValueSource, RemapValueSourceTypeWithOptionalType, ValueSource } from '../typeSystem/base.js'
import type { StringType } from '../typeSystem/strings.js'
import { __typeClassOf } from '../typeSystem/valueSourceFactory.js'
import { __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'

export abstract class OracleConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'oracle', NAME>> {
    /**
     * The SQL data type of a type of Oracle, written as in a declaration (`NUMBER(18,4)`, `VARCHAR2(50 CHAR)`, `TIMESTAMP(6) WITH TIME ZONE`), aliases
     * accepted, with that name as its native one: for `withSqlDataType`, or a generator that reads the catalogue
     */
    override sqlDataTypeFrom(nativeName: string): SqlDataType {
        // A new object from the reading of the name: its native name is set on it, not on a copy
        const sqlDataType = oracleFamilyOf(nativeName) as { native?: SqlDataTypeNative }
        sqlDataType.native = { oracle: nativeName }
        return sqlDataType as SqlDataType
    }
    /**
     * The type of Oracle for a SQL data type: its native name of Oracle when it has one, otherwise from its family and
     * its properties; undefined when Oracle can't hold it (never another type)
     */
    protected override buildNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
        return oracleNativeSqlDataTypeOf(sqlDataType, this.compatibilityVersion, this.booleanStorage, this.uuidStrategy)
    }

    protected uuidStrategy: 'string' | 'string as sent' | 'custom-functions' | 'built-in' = 'built-in'

    protected override __normalizeUuidText(value: string): string {
        // A uuid in a text column is written and read in lower case, as the other strategies and databases give it;
        // 'string as sent' keeps the text as it is
        return this.uuidStrategy === 'string' ? value.toLowerCase() : value
    }

    /**
     * How a boolean is stored: `'number'` (the default), a `NUMBER(1)` with 1 / 0, the form every version of Oracle
     * has; or `'boolean'`, the `BOOLEAN` type of Oracle 23ai (it needs Oracle 23.4 or later). The SQL is written for
     * the one chosen; a column of the other form is declared with a `CustomBooleanTypeAdapter` (with `'boolean'`, a
     * `NUMBER(1)` column takes `new CustomBooleanTypeAdapter(1, 0)`).
     */
    protected booleanStorage: 'number' | 'boolean' = 'number'

    /**
     * Keep Oracle's native NULL handling for concatenation (`.concat(...)` and the affix
     * predicates `startsWith` / `endsWith` / `contains` and their `Insensitive` variants).
     *
     * Oracle's `||` treats NULL as the empty string, so `'x' || null` is `'x'` where every
     * other supported database answers NULL. That makes `concat` return a present string
     * where its declared type says the result is optional, and — worse — it makes an affix
     * predicate built on a NULL term collapse to `like '%'` and match the whole table
     * instead of nothing. By default (`false`) the library wraps the concatenation in a
     * `CASE` so a NULL operand poisons the result, matching the declared type and the other
     * dialects (MySQL / MariaDB propagate through `concat(...)`, PostgreSQL / SQLite through
     * `||`, SQL Server through `+`). Only operands that can be NULL at build time are
     * null-checked, so a concatenation of required operands is still the bare `||`.
     *
     * Setting this flag to `true` keeps the bare native `||`, which reads NULL as the empty
     * string. With {@link libraryFunctions} installed, the NULL propagation calls a function of the
     * library instead of the operand-repeating `CASE`.
     */
    protected ignoreNullInConcat: boolean = false
    /**
     * Whether the functions of the library are in the database (its file of SQL, tsq-functions.sql): `'installed'` or
     * `'not installed'` (the default). The ones a query always needs, of durations and of differences of zoned dates and
     * times in days, are called anyway. With them installed the library also calls:
     * - `tsq_zoned_of_wall`, to take a wall clock to its zone (`toZonedDateTime`, and the arithmetic of a zoned date and
     *   time) as Temporal disambiguates it. Without it, a wall clock the zone repeats is the later instant Oracle gives,
     *   where Temporal's default `'compatible'` takes the earlier one, a wall clock the zone skips makes the query fail
     *   (ORA-01878), and a disambiguation `'earlier'` or `'reject'` is rejected when the query is built.
     * - `tsq_string_util.concat_strict`, for a concatenation (`concat` and the patterns of `startsWith`, `endsWith` and
     *   `contains`) that gives null for a null operand writing each operand once; without it, a `CASE` repeats them.
     */
    protected libraryFunctions: 'installed' | 'not installed' = 'not installed'
    /**
     * The date of a column of a date (DATE, TIMESTAMP) that stores only a time of the day (a localTime, a plainTime):
     * Oracle has no type of a time alone. A date `'YYYY-MM-DD'`, `'1972-01-01'` by default; the date of a time read is
     * ignored. A column whose times were stored on another date (`'1970-01-01'` by version 1 of the library) compares
     * and orders as a time of the day only with this date
     */
    protected dateOfStoredTimes: string = '1972-01-01'
    /**
     * The scale of `roundn` is a whole number of decimals, and Oracle truncates a fractional one (`roundn(1.6)` rounds to
     * 1 decimal), while the other databases round it. ts-sql-query rounds it on every database: a number is sent
     * rounded, ties away from zero, and an expression that isn't an integer is written rounded (`round(<scale>)`), so
     * `roundn(1.6)` rounds to 2 decimals.
     *
     * Setting this flag to `true` sends and writes the scale as it is, and Oracle truncates it as it does natively.
     */
    protected usePlatformDependentRound: boolean = false


    /**
     * Collation forced on the **match** operands of `.replaceAll(...)`.
     *
     * Oracle's `REPLACE` honours the session collation, so on a database configured
     * case-insensitive (`NLS_COMP=LINGUISTIC` with a `..._CI` / `..._AI` sort)
     * `'ABCabc'.replaceAll('abc', 'X')` matches **both** cases and returns `'XX'`, corrupting the
     * value. By default the library pins the **binary/code-point** collation (`BINARY`) so
     * `replaceAll` is case-sensitive whichever collation the session uses, and resets the result
     * with `collate USING_NLS_COMP` so the forced collation does not leak into a chained comparison:
     *
     * ```sql
     * replace(<src> collate BINARY, <from> collate BINARY, <to>) collate USING_NLS_COMP
     * ```
     *
     * Set it to another collation name to force a different one, or to the **empty string**
     * `''` to opt out entirely and emit the bare native `replace(<src>, <from>, <to>)` (which
     * follows the session collation — case-sensitive by default, `BINARY`, on Oracle).
     */
    protected replaceCollation: string = 'BINARY'

    /**
     * Collation forced on the **match** operands of `.replaceAllInsensitive(...)`.
     *
     * Oracle's default collation is case-sensitive (`BINARY`), so a bare `replace()` would not
     * fold case — `.replaceAllInsensitive(...)` needs a case-insensitive collation forced on the
     * operands. When {@link insensitiveCollation} names a collation, that one is used (so a shared
     * language collation carries over); otherwise this value is forced, defaulting to Oracle's
     * neutral case-insensitive `BINARY_CI`, with a `USING_NLS_COMP` reset so it does not leak
     * downstream:
     *
     * ```sql
     * replace(<src> collate BINARY_CI, <from> collate BINARY_CI, <to>) collate USING_NLS_COMP
     * ```
     *
     * Set it to another collation name to force a different one (e.g. `BINARY_AI` to also fold
     * accents), or to the **empty string** `''` to opt out and emit the bare native
     * `replace(<src>, <from>, <to>)` (which follows the session collation — case-sensitive by
     * default on Oracle). Setting {@link insensitiveCollation} to `''` opts out the same way.
     */
    protected replaceInsensitiveCollation: string = 'BINARY_CI'

    /**
     * Minimum Oracle Database version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `23_009_000` for Oracle
     * Database 23.9). Defaults to `Number.POSITIVE_INFINITY` (latest). Recognized
     * breakpoints:
     *   - `>= 23_004_000` (Oracle Database 23ai) — the [[Values]] feature emits
     *     the SQL-standard `WITH name(cols) AS (VALUES (…), …)` table constructor
     *     introduced in 23ai. On older Oracle versions ts-sql-query emulates it
     *     as `WITH name(cols) AS (SELECT … FROM dual UNION ALL SELECT … FROM
     *     dual)` so the feature still works.
     *
     * Independent of `compatibilityVersion`, `stringConcatDistinct` emits
     * `LISTAGG(DISTINCT …)`, which requires Oracle Database 19c or later (the
     * `DISTINCT` keyword inside `LISTAGG` was added in 19c).
     */
    /** Durations are kept in the intervals of the database */
    protected override hasNativeDurations(): boolean {
        return true
    }
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('oracle')
    }

    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'oracle', NAME>>): ValueSource<SOURCE | NAggregate<NConnection<'oracle', NAME>>, StringType, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'oracle', NAME>>, separator: string): ValueSource<SOURCE | NAggregate<NConnection<'oracle', NAME>>, StringType, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const nodeValue = __asNodeValueSource(value)
        return __createAggregateFunction1or2('_stringConcatDistinct', separator, value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')
    }

    anyValue<TYPE extends TypedValueSource<any, any, any>>(value: TYPE & SameDB<NConnection<'oracle', NAME>>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<NConnection<'oracle', NAME>>, TYPE, 'optional'> {
        const nodeValue = __asNodeValueSource(value)
        return (__createAggregateFunction1('_anyValue', value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')) as any
    }

    default(): Default {
        return new DefaultImpl()
    }

    isolationLevel(level: 'read committed' | 'snapshot'): TransactionIsolationLevel<NConnection<'oracle', NAME>>
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'oracle', NAME>>
    isolationLevel(level: 'read committed' | 'snapshot' | 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'oracle', NAME>> {
        if (level === 'read write' || level === 'read only') {
            return [undefined, level] as any
        }
        return [level] as any
    }

    /**
     * A boolean is sent as 1 or 0 unless it is stored as a BOOLEAN. With a databaseTimeZone other than UTC, a
     * localDateTime or a localTime parameter goes as a TIMESTAMP WITH LOCAL TIME ZONE of its instant, which the database
     * converts with its session (the zone of the database) into the wall clock it stores or compares with
     */
    protected override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown {
        if ((__isLocalDateTimeClass(context.requestedType) || __isLocalTimeClass(context.requestedType) || __isInstantClass(context.requestedType)) && this.isDatabaseOutsideUtc()) {
            context.setMetadata(oracleZonedParam, true)
        }
        const durationSqlDataType = __isDurationClass(context.requestedType) ? __durationSqlDataTypeOf(context.requestedSqlDataType, context.requestedType) : undefined
        if (__isDurationClass(context.requestedType) && isDurationValue(value) && this.isDurationKeptAsInterval(durationSqlDataType)) {
            // An interval of Oracle holds years and months, or days to seconds, never both: a duration that doesn't fit
            // the one of its column (days to seconds unless it says years to month) would lose a part
            const yearToMonth = durationSqlDataType?.family === 'interval' && durationSqlDataType.fields === 'year to month'
            const fits = yearToMonth
                ? value.weeks === 0 && value.days === 0 && value.hours === 0 && value.minutes === 0 && value.seconds === 0 && value.milliseconds === 0 && value.microseconds === 0 && value.nanoseconds === 0
                : value.years === 0 && value.months === 0
            if (!fits) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: context.requestedType.type }, 'Invalid duration value to send to the db: ' + String(value) + ' doesn\'t fit an interval ' + (yearToMonth ? 'year to month' : 'day to second'))
            }
        }
        if (__isBooleanClass(context.requestedType) && typeof value === 'boolean' && this.booleanStorage !== 'boolean') {
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion
            return Number(value);
        }
        const result = super.transformValueToDB(value, context)
        if (__isLocalTimeClass(context.requestedType) && result instanceof Date && !this.isDatabaseOutsideUtc()) {
            // A time of the day is stored on dateOfStoredTimes (its placeholder takes it there outside UTC)
            const date = dateOfStoredTimesOf(this.dateOfStoredTimes)
            return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), result.getUTCHours(), result.getUTCMinutes(), result.getUTCSeconds(), result.getUTCMilliseconds()))
        }
        return result
    }

    /**
     * With a databaseTimeZone other than UTC, a localDateTime or a localTime leaves the database as the instant the
     * database completes with its session, `cast(<sql> as timestamp with time zone)` (see oracleZonedValueSql), also
     * inside the JSON of an aggregated array, where Oracle writes it as a text with its zone
     */
    protected override transformProjection(sql: string, context: TypeAdapterProjectionContext): string {
        if ((context.output === 'resultColumn' || context.output === 'aggregatedArrayValue') && __isZonedDateTimeClass(context.requestedType)) {
            // A zoned date and time leaves the database as its wall clock with its offset, which give its instant, with all
            // its digits and the era always written, followed by the region of its zone in brackets (Temporal reads its
            // name whatever its case): the value written once; also inside the JSON of an aggregated array, which would
            // write it with its offset only
            context.comparison = 'equality'
            return "to_char(" + sql + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF9TZH:TZM BC\"[\"TZR\"]\"', 'NLS_DATE_LANGUAGE=AMERICAN')"
        }
        if (context.output === 'resultColumn' && __isInstantClass(context.requestedType)) {
            // oracledb delivers a date and a time as a Date, which drops the digits below the millisecond: an instant
            // leaves the database as the text of its wall clock in UTC, with all its digits and the era always written.
            // A value without zone is completed with the zone of the session (the zone of the database). It compares
            // like the value but doesn't order like it (a year BC)
            context.comparison = 'equality'
            return "to_char(sys_extract_utc(cast(" + sql + " as timestamp(9) with time zone)), 'YYYY-MM-DD\"T\"HH24:MI:SS.FF9\"Z\" BC', 'NLS_DATE_LANGUAGE=AMERICAN')"
        }
        if (this.isDatabaseOutsideUtc()) {
            const zoned = oracleZonedValueSql(sql, context.requestedType, this.dateToConvertTimesBetweenZones)
            if (zoned) {
                return zoned
            }
        }
        if (context.output === 'resultColumn') {
            // oracledb delivers a DATE or a TIMESTAMP as a Date, which drops the digits below the millisecond: a
            // Temporal value without zone leaves the database as its text, with the era always written (Oracle has no
            // year 0), in English whatever the language of the session. It compares like the value but doesn't order like it (a year BC)
            if (isKeptInADateClass(context.requestedType)) {
                context.comparison = 'equality'
                return "to_char(" + sql + ", 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')"
            }
            if (__isPlainTimeClass(context.requestedType) || __isPlainDateTimeClass(context.requestedType)) {
                context.comparison = 'equality'
                // A DATE has no fraction of a second for 'FF9' (ORA-01821): it is cast to a timestamp, unless it already
                // is one (the result of toPlainDateTime, or the current date and time)
                const timestamp = sql === 'localtimestamp' || (sql.startsWith('cast(') && sql.endsWith(' as timestamp(9))')) ? sql : 'cast(' + sql + ' as timestamp(9))'
                return "to_char(" + timestamp + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')"
            }
        }
        return super.transformProjection(sql, context)
    }
}

/** The length of a text of Oracle, `50`, `50 byte` or `50 char`: the number, and the unit */
const oracleTextLength = /^(\d+)\s*(byte|char)?$/i
function oracleTextLengthUnit(match: RegExpExecArray | null): 'characters' | 'octets' | undefined {
    const unit = match?.[2]?.toLowerCase()
    return unit === 'char' ? 'characters' : unit === 'byte' ? 'octets' : undefined
}

/** The type of the name as Oracle writes it (`NUMBER(18,4)`, `VARCHAR2(50 CHAR)`, `TIMESTAMP(6) WITH TIME ZONE`), aliases accepted */
function oracleFamilyOf(nativeName: string): SqlDataType {
    const { key: fullKey, args } = nativeTypeParts(nativeName)
    // A type of a schema, like SYS.XMLTYPE or MDSYS.SDO_GEOMETRY
    const key = fullKey.replace(/^(sys|mdsys|public)\./, '')
    const n0 = argumentNumber(args[0])
    const n1 = argumentNumber(args[1])
    switch (key) {
        case 'number': case 'numeric': case 'decimal': case 'dec':
            return { family: 'exact numeric', precision: n0, scale: n0 === undefined ? undefined : n1 ?? 0 }
        case 'integer': case 'int': case 'smallint': return { family: 'exact numeric', precision: 38, scale: 0 }
        case 'float': return { family: 'approximate numeric', precision: n0 ?? 126 }
        case 'real': return { family: 'approximate numeric', precision: 63 }
        case 'double precision': return { family: 'approximate numeric', precision: 126 }
        case 'binary_float': return { family: 'approximate numeric', precision: 24 }
        case 'binary_double': return { family: 'approximate numeric', precision: 53 }
        case 'boolean': case 'bool': return { family: 'boolean' }
        case 'char': case 'character': {
            const length = oracleTextLength.exec((args[0] ?? '1').trim())
            return { family: 'character string', length: length ? Number(length[1]) : undefined, lengthUnit: oracleTextLengthUnit(length), fixed: true }
        }
        case 'varchar2': case 'varchar': case 'character varying': case 'char varying': {
            const length = args[0] === undefined ? null : oracleTextLength.exec(args[0].trim())
            return { family: 'character string', length: length ? Number(length[1]) : undefined, lengthUnit: oracleTextLengthUnit(length) }
        }
        case 'nchar': case 'national character': case 'national char': return { family: 'character string', length: n0 ?? 1, fixed: true, national: true }
        case 'nvarchar2': case 'national character varying': case 'national char varying': case 'nchar varying':
        {
            const length = args[0] === undefined ? null : oracleTextLength.exec(args[0].trim())
            return { family: 'character string', length: length ? Number(length[1]) : undefined, lengthUnit: oracleTextLengthUnit(length), national: true }
        }
        case 'clob': case 'long': return { family: 'character string', largeObject: true }
        case 'nclob': return { family: 'character string', national: true, largeObject: true }
        case 'raw': return { family: 'binary string', length: n0 }
        case 'blob': case 'long raw': return { family: 'binary string', largeObject: true }
        case 'bfile': return { family: 'binary string', largeObject: true, external: true }
        case 'date': return { family: 'datetime', fields: 'timestamp', precision: 0, timeZone: 'none' }
        case 'timestamp': return { family: 'datetime', fields: 'timestamp', precision: n0 ?? 6, timeZone: 'none' }
        case 'timestamp with local time zone': return { family: 'datetime', fields: 'timestamp', precision: n0 ?? 6, timeZone: 'session' }
        case 'timestamp with time zone': return { family: 'datetime', fields: 'timestamp', precision: n0 ?? 6, timeZone: 'kept' }
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
            return { family: 'vector', dimensions: n0, element, storage }
        }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}


/**
 * The type of Oracle for the SQL data type, in that version, or undefined when Oracle can't hold it; a boolean, a uuid
 * and a time of the day as the connection stores them (booleanStorage, uuidStrategy, a time of the day on dateOfStoredTimes)
 */
function oracleNativeSqlDataTypeOf(sqlDataType: SqlDataType, compatibilityVersion: number, booleanStorage: string, uuidStrategy: string): string | undefined {
    const native = nativeNameFor(sqlDataType, 'oracle')
    if (native !== undefined) {
        return native
    }
    if (sqlDataType.domain !== undefined) {
        return sqlDataType.domain
    }
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
            return booleanStorage === 'boolean' ? 'BOOLEAN' : 'NUMBER(1)'
        case 'uuid':
            return uuidStrategy === 'string' || uuidStrategy === 'string as sent' ? 'VARCHAR2(36)' : 'RAW(16)'
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
            const p = oracleFractionSuffix(sqlDataType.precision)
            if (p === undefined) return undefined
            if (fields === 'date') return 'DATE'
            // A time of the day is kept on dateOfStoredTimes
            if (fields === 'time') return timeZone === undefined || timeZone === 'none' ? 'TIMESTAMP' + p : undefined
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
            // JSON came in Oracle 21
            return sqlDataType.format === 'json' ? (compatibilityVersion >= 21_000_000 ? 'JSON' : undefined) : sqlDataType.format === 'xml' ? 'XMLTYPE' : undefined
        case 'spatial':
            return sqlDataType.model === 'geometry' ? 'SDO_GEOMETRY' : undefined
        case 'row locator':
            return sqlDataType.kind === 'physical' ? 'ROWID' : 'UROWID'
        case 'variant':
            return 'ANYDATA'
        case 'vector': {
            const { dimensions, element, storage } = sqlDataType
            // VECTOR came in Oracle 23.4
            if (element === 'float16' || compatibilityVersion < 23_004_000) return undefined
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

/** `(n)` of the digits of the fraction of the seconds, nothing without them, or undefined beyond 9 */
function oracleFractionSuffix(precision: number | undefined): string | undefined {
    return precision === undefined ? '' : precision <= 9 ? '(' + precision + ')' : undefined
}
