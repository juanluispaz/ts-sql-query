import type { NConnection } from '../utils/sourceName.js'
import { argumentNumber, nativeNameFor, nativeTypeParts } from '../utils/sqlDataTypeNames.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { SqlServerSqlBuilder } from '../sqlBuilders/SqlServerSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import type { Default } from '../expressions/Default.js'
import type { SqlDataType, SqlDataTypeNative, TypeAdapterProjectionContext } from '../TypeAdapter.js'
import { __sqlDataTypeDescribes, __typeSqlDataTypeOf } from '../typeSystem/dataTypes.js'
import { DefaultImpl } from '../expressions/Default.js'

export abstract class SqlServerConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'sqlServer', NAME>> {
    /**
     * The SQL data type of a type of SQL Server, written as in a declaration (`decimal(18,4)`, `nvarchar(max)`, `datetime2(3)`), aliases
     * accepted, with that name as its native one: for `withSqlDataType`, or a generator that reads the catalogue
     */
    override sqlDataTypeFrom(nativeName: string): SqlDataType {
        // A new object from the reading of the name: its native name is set on it, not on a copy
        const sqlDataType = sqlServerFamilyOf(nativeName) as { native?: SqlDataTypeNative }
        sqlDataType.native = { sqlServer: nativeName }
        return sqlDataType as SqlDataType
    }
    /**
     * The type of SQL Server for a SQL data type: its native name of SQL Server when it has one, otherwise from its family and
     * its properties; undefined when SQL Server can't hold it (never another type)
     */
    protected override buildNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
        return sqlServerNativeSqlDataTypeOf(sqlDataType, this.compatibilityVersion)
    }

    /**
     * The driver gives a decimal as a JavaScript number, which loses digits and the scale; the text of a decimal in a
     * column of the result keeps every digit of a decimal(38): 38 digits, the sign and the point. A decimal is an exact
     * number of its SQL data type that isn't an integer of a fixed size (the driver gives a bigint as its text)
     */
    protected override transformProjection(sql: string, context: TypeAdapterProjectionContext): string {
        const declared = context.requestedSqlDataType
        const sqlDataType = declared !== undefined && __sqlDataTypeDescribes(declared, context.requestedType) ? declared : __typeSqlDataTypeOf(context.requestedType)
        if (context.output === 'resultColumn' && sqlDataType?.family === 'exact numeric' && !(sqlDataType.scale === 0 && sqlDataType.bytes !== undefined)) {
            // The text of a decimal orders as a text, not as the number; two equal decimals of a column give the same
            // text, but of two columns of different scales (in the arms of a compound query) not, 1.5 and 1.50
            context.comparison = 'columnEquality'
            return 'convert(nvarchar(41), ' + sql + ')'
        }
        return super.transformProjection(sql, context)
    }


    /**
     * Minimum SQL Server version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `16_000_000` for SQL
     * Server 2022, whose internal version is 16.0). Defaults to
     * `Number.POSITIVE_INFINITY` (latest). Recognized breakpoints:
     *   - `>= 16_000_000` (SQL Server 2022) — `minValue` / `maxValue` use the
     *     native `LEAST(a, b)` / `GREATEST(a, b)` as the inner expression instead
     *     of a double-evaluating `IIF(a < b, a, b)` emulation. Both are wrapped in
     *     a NULL-poisoning `CASE` (see `ignoreNullInMinAndMaxValue`), so the NULL
     *     semantics are identical across versions and only the inner form differs.
     *   - `>= 17_000_000` (SQL Server 2025) — `aggregateAsArray` and
     *     `aggregateAsArrayOfOneColumn` emit the native `json_arrayagg` /
     *     `json_object` aggregates instead of a `string_agg`-based emulation
     *     (the `Distinct` variants still use the emulation because
     *     `json_arrayagg` does not accept `DISTINCT`); `substring(...)` with
     *     no end argument emits `substring(x, start + 1)` instead of
     *     `substring(x, start + 1, len(x) - start)`; `currentDate()` emits
     *     the native `current_date` keyword instead of `cast(getdate() as
     *     date)`.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    /**
     * Controls whether `.length()` counts trailing blanks on SQL Server.
     *
     * `.length()` mirrors JavaScript's `String.length`, which counts trailing
     * blanks; T-SQL's `LEN()` excludes them (`len('Draft  ')` is 5, not 7). By
     * default (`false`) the builder bridges the gap with a sentinel —
     * `len(<x> + '.') - 1` — so trailing blanks are counted, character-correct
     * for every string shorter than its column's declared maximum. It fails at
     * one exact extreme: a value whose length already equals the column's
     * maximum, because T-SQL string `+` on two non-`max` character types caps the
     * result at the type's maximum and silently drops the appended sentinel, so
     * `len` returns the maximum and the `- 1` yields **maximum − 1**.
     *
     * Setting this flag to `true` drops the sentinel and emits a bare `len(<x>)`,
     * which **excludes trailing blanks** (`len('Draft  ')` = 5, T-SQL's native
     * semantics, diverging from JS `String.length`). The max-length edge then
     * disappears (`len(REPLICATE('a', 8000))` = 8000, correct) and the query is
     * lighter. It is a genuine trade, not a strict improvement — the right choice
     * for an application whose SQL Server columns hold max-length values and whose
     * data does not depend on trailing blanks.
     */
    protected excludeTrailingBlanksInLength: boolean = false
    /**
     * The scale of `roundn` is a whole number of decimals, and SQL Server truncates a fractional one (`roundn(1.6)` rounds to
     * 1 decimal), while the other databases round it. ts-sql-query rounds it on every database: a number is sent
     * rounded, ties away from zero, and an expression that isn't an integer is written rounded (`round(<scale>, 0)`), so
     * `roundn(1.6)` rounds to 2 decimals.
     *
     * Setting this flag to `true` sends and writes the scale as it is, and SQL Server truncates it as it does natively.
     */
    protected usePlatformDependentRound: boolean = false

    /**
     * SQL Server gives a `uniqueidentifier`, and its text (`asString()`), in upper case. By default the library gives it
     * in lower case, as the other databases: it lowers a uuid read, and writes `lower(...)` where the text of a uuid is
     * transformed in the query (concatenated, cut, trimmed, aggregated...). Set it to `true` to keep the upper case of
     * SQL Server.
     */
    protected useUpperCaseUuid: boolean = false

    protected override __normalizeUuidText(value: string): string {
        return this.useUpperCaseUuid ? value : value.toLowerCase()
    }

    /**
     * Keep SQL Server's native NULL handling for `.minValue(x)` / `.maxValue(x)`.
     *
     * SQL Server's `least(a, b)` / `greatest(a, b)` (2022+) and the `iif(a < b, a, b)`
     * emulation (older) both **ignore** a NULL operand and return the present value,
     * whereas the library's type declares the result optional whenever either operand
     * is optional (the same OR rule `add` / `subtract` / `concat` use) — i.e. a NULL
     * operand should propagate to a NULL result. By default (`false`) the library wraps
     * the version-appropriate inner expression in a `CASE` so a NULL operand poisons the
     * result, matching the declared type and the other dialects (MySQL / MariaDB / Oracle
     * / SQLite already propagate).
     *
     * Setting this flag to `true` keeps the bare native form, which ignores NULL. With
     * {@link libraryFunctions} installed, the NULL propagation calls functions of the library
     * instead of the operand-repeating `CASE`.
     */
    protected ignoreNullInMinAndMaxValue: boolean = false

    /**
     * Whether the functions of the library are in the database (its file of SQL, tsq-functions.sql): `'installed'` or
     * `'not installed'` (the default). The ones a query always needs, of durations, are called anyway. With them
     * installed the library also calls `dbo.tsq_greatest_strict` and `dbo.tsq_least_strict`, for `minValue` and
     * `maxValue`, which give null for a null operand writing each operand once; without them, a `CASE` repeats them; and
     * `dbo.tsq_round_to`, `dbo.tsq_ticks_between`, `dbo.tsq_time_of_ticks` and `dbo.tsq_datetime_of_ticks`, for a rounding
     * and the difference of two dates and times, writing each value once; `dbo.tsq_duration_sum`,
     * `dbo.tsq_duration_total_of`, `dbo.tsq_duration_round_of`, `dbo.tsq_duration_negated`,
     * `dbo.tsq_datetime_plus_duration`, `dbo.tsq_instant_plus_duration` and `dbo.tsq_day_in_month_or_error`, which take a
     * duration or a date whole.
     */
    protected libraryFunctions: 'installed' | 'not installed' = 'not installed'



    /**
     * Collation forced on the **match** operands of `.replaceAll(...)`.
     *
     * SQL Server's `REPLACE` honours the column/database collation, so on a
     * case-insensitive database (the default `..._CI_AS` collation) `'ABCabc'.replaceAll('abc', 'X')`
     * matches **both** cases and returns `'XX'`, corrupting the value. By default the library
     * pins a **binary/code-point** collation (`Latin1_General_BIN2`, which compares raw code
     * points for `varchar` and `nvarchar` alike despite the culture prefix) so `replaceAll` is
     * case-sensitive whichever collation the database uses, and resets the result with
     * `collate DATABASE_DEFAULT` so the forced collation does not leak into a chained comparison:
     *
     * ```sql
     * replace(<src> collate Latin1_General_BIN2, <from> collate Latin1_General_BIN2, <to>) collate DATABASE_DEFAULT
     * ```
     *
     * Set it to another collation name to force a different one, or to the **empty string**
     * `''` to opt out entirely and emit the bare native `replace(<src>, <from>, <to>)` (which
     * follows the database collation — case-insensitive by default on SQL Server).
     */
    protected replaceCollation: string = 'Latin1_General_BIN2'

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable'): TransactionIsolationLevel<NConnection<'sqlServer', NAME>> {
        return [level] as any
    }

    default(): Default {
        return new DefaultImpl()
    }
}


/** The type of the name as SQL Server writes it (`varchar(50)`, `nvarchar(max)`, `datetime2(3)`), aliases accepted */
function sqlServerFamilyOf(nativeName: string): SqlDataType {
    const { key, args } = nativeTypeParts(nativeName)
    const n0 = argumentNumber(args[0])
    const n1 = argumentNumber(args[1])
    const isMax = args[0]?.trim().toLowerCase() === 'max'
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
        case 'char': case 'character': return { family: 'character string', length: n0 ?? 1, fixed: true, national: false }
        case 'varchar': case 'char varying': case 'character varying': return isMax ? { family: 'character string', national: false, largeObject: true } : { family: 'character string', length: n0 ?? 1, national: false }
        case 'nchar': case 'national char': case 'national character': return { family: 'character string', length: n0 ?? 1, fixed: true, national: true }
        case 'nvarchar': case 'national char varying': case 'national character varying': return isMax ? { family: 'character string', national: true, largeObject: true } : { family: 'character string', length: n0 ?? 1, national: true }
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
            return { family: 'vector', dimensions: n0, element }
        }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}


/** The type of SQL Server for the SQL data type, in that version, or undefined when SQL Server can't hold it */
function sqlServerNativeSqlDataTypeOf(sqlDataType: SqlDataType, compatibilityVersion: number): string | undefined {
    // json and vector came in SQL Server 2025 (17)
    const since2025 = compatibilityVersion >= 17_000_000
    const native = nativeNameFor(sqlDataType, 'sqlServer')
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
            const p = fractionSuffix(sqlDataType.precision, 7)
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
            return sqlDataType.format === 'xml' ? 'xml' : sqlDataType.format === 'json' && since2025 ? 'json' : undefined
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
            if (!since2025 || dimensions === undefined || storage === 'sparse') return undefined
            if (element === 'float16') return 'vector(' + dimensions + ', float16)'
            return element === undefined || element === 'float32' ? 'vector(' + dimensions + ')' : undefined
        }
        case 'user-defined':
            return sqlDataType.name
        default:
            return undefined
    }
}

/** `(n)` of the digits of the fraction of the seconds, nothing without them, or undefined beyond the maximum */
function fractionSuffix(precision: number | undefined, maximum: number): string | undefined {
    return precision === undefined ? '' : precision <= maximum ? '(' + precision + ')' : undefined
}
