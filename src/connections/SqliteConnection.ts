import type { NAggregate, NConnection, NNotNestedAggregate, NSource } from '../utils/sourceName.js'
import { argumentNumber, nativeNameFor, nativeTypeParts } from '../utils/sqlDataTypeNames.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { SqliteSqlBuilder } from '../sqlBuilders/SqliteSqlBuilder.js'
import type { AggregatedArrayColumns, SourceOfAggregatedArray } from './AbstractConnection.js'
import { AbstractConnection } from './AbstractConnection.js'
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType, SqliteDecimalStrategy } from './SqliteConfiguration.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { source, valueType } from '../utils/symbols.js'
import { __createAggregateFunction1, __createAggregateFunction1or2, __createAggregateValueAsArray, __asNodeValueSource } from '../typeSystem/valueSourceFactory.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { SqlDataType, SqlDataTypeNative, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import { __isBigintClass, __isInstantClass, __isLocalDateClass, __isLocalDateTimeClass, __isLocalTimeClass, __isPlainTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { isKeptInADateClass, isPlainTemporalClass } from '../utils/plainTemporalValues.js'
import { parseInstantText, plainDateText } from '../utils/plainDateTimeText.js'
import { __temporal, type TemporalPlainDate, type TemporalPlainDateTime, type TemporalPlainTime } from '../typeSystem/temporal.js'
import { __isExactDecimalSql } from '../typeSystem/dataTypes.js'
import { isDateTimeTextOutOfCalendar } from '../utils/utcDateTimeText.js'
import type { TypedValueSource } from '../typeSystem/valueSource.js'
import type { AggregatedArrayProjectableAsNullableType, AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'
import type { IValueSource, RemapValueSourceTypeWithOptionalType, ValueSource } from '../typeSystem/base.js'
import type { StringType } from '../typeSystem/strings.js'
import { __typeClassOf } from '../typeSystem/valueSourceFactory.js'
import { __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'

export abstract class SqliteConnection<NAME extends string> extends AbstractConnection<NConnection<'sqlite', NAME>> {
    /**
     * The SQL data type of a column of SQLite, as it is declared (`pragma table_info`), with that name as its native
     * one: the six types of a STRICT table as they are (`INTEGER`, `INT`, `REAL`, `TEXT`, `BLOB`, `ANY`); in a table
     * that isn't STRICT, the common names of the other databases (`VARCHAR(n)`, `DECIMAL(p, s)`, `DATETIME`,
     * `BOOLEAN`, `UUID`, …), the intent of who wrote them; any other name, a user-defined type (override this method
     * to read a name of your own); no name, a value of any type
     */
    override sqlDataTypeFrom(nativeName: string): SqlDataType {
        // A new object from the reading of the name: its native name is set on it, not on a copy
        const sqlDataType = sqliteFamilyOf(nativeName) as { native?: SqlDataTypeNative }
        sqlDataType.native = { sqlite: nativeName }
        return sqlDataType as SqlDataType
    }
    /**
     * The type of a STRICT table of SQLite for a SQL data type: its native name of SQLite when it has one, otherwise
     * where this connection stores it (a date as its date and time format says, a uuid as its uuid strategy says, a
     * decimal as text); undefined when SQLite can't hold it (never another type)
     */
    protected override buildNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
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
            case 'document':
            case 'enumeration':
                return 'TEXT'
            case 'datetime': {
                const fields = sqlDataType.fields
                if (fields === 'year') return undefined
                const format: string = this.getDateTimeFormat(fields === 'timestamp' ? 'dateTime' : fields)
                return format.endsWith('as real number') ? 'REAL' : format.endsWith('as integer') ? 'INTEGER' : 'TEXT'
            }
            case 'binary string':
                return sqlDataType.external ? undefined : 'BLOB'
            case 'uuid':
                return this.uuidStrategy === 'uuid-extension' ? 'BLOB' : 'TEXT'
            case 'variant':
                return 'ANY'
            default:
                return undefined
        }
    }

    protected uuidStrategy: 'string' | 'string as sent' | 'uuid-extension' = 'uuid-extension'

    protected override __normalizeUuidText(value: string): string {
        // A uuid in a text column is written and read in lower case, as the other strategies and databases give it;
        // 'string as sent' keeps the text as it is
        return this.uuidStrategy === 'string' ? value.toLowerCase() : value
    }

    /**
     * How an exact decimal is stored, computed, compared and ordered. SQLite has no exact decimal type: a
     * decimal lives in a `TEXT` column (of a `STRICT` table, so SQLite doesn't turn it into a floating point
     * number). Every strategy is exact: an operation it can't do exactly is rejected when the query is built.
     *
     * - `'decimal-extension and tsq-functions'`: the functions of the `decimal` extension of SQLite (`decimal_add`,
     *   `decimal_sub`, `decimal_mul`, `decimal_sum` and `decimal_cmp`, written in C when the extension is loaded),
     *   plain SQL for the order by, `min`, `max` and the grouping, and functions of the library (`tsq_`) for what the
     *   extension doesn't have: `ceil`, `floor`, `round`, `roundn` and `modulo`.
     * - `'decimal-functions'`: the functions of the `decimal` extension and the ones of the library for the order by,
     *   the grouping, `min` and `max` (`tsq_decimal_key`, `tsq_decimal_min`, `tsq_decimal_max`).
     * - `'text'`: plain SQL, no function to register; the arithmetic, the sums and the roundings are rejected.
     *
     * Each has a canonical text variant (`'… with canonical text'`, and `'canonical text'` for `'text'`), the default
     * being `'decimal-extension and tsq-functions with canonical text'`: the library writes every value in its
     * canonical text (`007.50` as `7.5`, `-0.00` as `0`) and takes the values stored as written so, which compare,
     * group and remove duplicates as their text. The values read come back so (`1.50` is read as `1.5`).
     *
     * See the SQLite page of the documentation.
     */
    protected decimalStrategy: SqliteDecimalStrategy = 'decimal-extension and tsq-functions with canonical text'

    /**
     * Whether the functions of the library are registered in the connection of the driver (`registerSqliteFunctions`):
     * `'installed'` or `'not installed'` (the default). The ones a setting of the connection needs (of its decimal
     * strategy, of its uuid strategy) and the ones of durations are called anyway. With them registered the library also
     * calls `tsq_ci_replace` for `replaceAllInsensitive`, which ignores the case of the text; without it, SQLite's
     * `replace` distinguishes the case (SQLite has no `replace` that ignores it), `tsq_round_to` for a rounding, the functions of
     * durations that take them whole (`tsq_duration_sum`, `tsq_duration_total_of`, `tsq_duration_round_of`,
     * `tsq_duration_negated`, the ones that add a duration of the query to a value, `tsq_day_in_month_or_error`, `tsq_utc_of_epoch`, `tsq_date_with`), and
     * `tsq_zoned_wall` for the date and time and the parts of a zoned date and time kept as its text, which write the
     * value once. The connectors without functions
     * written in JavaScript (`bun:sql`) can't register it.
     */
    protected libraryFunctions: 'installed' | 'not installed' = 'not installed'

    /**
     * Says that SQLite runs in the same zone as the application, so the date functions computed
     * by the database give what JavaScript gives for the same value. SQLite reads the zone from
     * the C library, so set it when the process starts: changing `process.env.TZ` afterwards
     * doesn't reach SQLite under Bun with a native driver.
     *
     * With it, `getTime()` reads a local text in the local zone, the other getters of a time or a
     * date time in a UTC or numeric format read it in the local zone, and `currentDate()` in those
     * formats returns the local day. Those expressions run slower, and SQLite doesn't accept them
     * in a `check` or in an index. By default (`false`), those functions work in UTC.
     *
     * See the SQLite page of the documentation.
     */
    protected sqliteRunsInApplicationTimeZone: boolean = false
    /**
     * The scale of `roundn` is a whole number of decimals, and SQLite truncates a fractional one (`roundn(1.6)` rounds to
     * 1 decimal), while the other databases round it. ts-sql-query rounds it on every database: a number is sent
     * rounded, ties away from zero, and an expression that isn't an integer is written rounded (`round(<scale>)`), so
     * `roundn(1.6)` rounds to 2 decimals.
     *
     * Setting this flag to `true` sends and writes the scale as it is, and SQLite truncates it as it does natively.
     */
    protected usePlatformDependentRound: boolean = false

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlite')
    }

    aggregateAsArrayDistinct<COLUMNS extends AggregatedArrayColumns<NConnection<'sqlite', NAME>>>(columns: COLUMNS & NNotNestedAggregate<SourceOfAggregatedArray<COLUMNS>, NConnection<'sqlite', NAME>>): ValueSource<SourceOfAggregatedArray<COLUMNS> | NAggregate<NConnection<'sqlite', NAME>>, AggregatedArrayProjectableAsNullableType<Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>>, 'required'> {
        return __createAggregateValueAsArray(columns as QueryColumns, 'InnerResultObject', 'required', true)
    }
    aggregateAsArrayOfOneColumnDistinct<VALUE extends TypedValueSource<any, any, any>>(value: VALUE & NNotNestedAggregate<VALUE[typeof source], NConnection<'sqlite', NAME>>): ValueSource<VALUE[typeof source] | NAggregate<NConnection<'sqlite', NAME>>, AggregatedArrayType<Array<VALUE[typeof valueType]>>, 'required'> {
        return __createAggregateValueAsArray(value, 'InnerResultObject', 'required', true)
    }
    /**
     * SQLite's `GROUP_CONCAT` rejects `DISTINCT` together with a separator
     * argument: the engine raises `DISTINCT aggregates must have exactly one
     * argument`. This is a hard SQLite restriction (see
     * https://www.sqlite.org/lang_aggfunc.html#groupconcat), not a version
     * quirk, so the `(value, separator)` overload of `stringConcatDistinct` is
     * not exposed on `SqliteConnection`. Use `stringConcatDistinct(value)` (the
     * default separator is `,`) or `stringConcat(value, separator)` if you do
     * not need distinct.
     */
    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'sqlite', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'sqlite', NAME>>): ValueSource<SOURCE | NAggregate<NConnection<'sqlite', NAME>>, StringType, 'optional'>
    stringConcatDistinct(value: IValueSource<any, StringType, any>): ValueSource<any, StringType, 'optional'> {
        const nodeValue = __asNodeValueSource(value)
        return __createAggregateFunction1or2('_stringConcatDistinct', undefined, value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')
    }

    anyValue<TYPE extends TypedValueSource<any, any, any>>(value: TYPE & SameDB<NConnection<'sqlite', NAME>> & NNotNestedAggregate<TYPE[typeof source], NConnection<'sqlite', NAME>>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<NConnection<'sqlite', NAME>>, TYPE, 'optional'> {
        const nodeValue = __asNodeValueSource(value)
        return (__createAggregateFunction1('_anyValue', value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')) as any
    }

    /**
     * Minimum SQLite version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `3_035_000` for
     * SQLite 3.35.0, `3_029_000` for SQLite 3.29.0). Defaults to
     * `Number.POSITIVE_INFINITY` (latest).
     *
     * Recognised breakpoints:
     * - `>= 3_042_000`: the `'subsec'` modifier (added in SQLite 3.42) is used
     *   with `unixepoch()` to obtain Unix-milliseconds values without going
     *   through `julianday()` arithmetic.
     * - `>= 3_038_000`: the `unixepoch()` function (added in SQLite 3.38) is
     *   used instead of `cast(strftime('%s', ...) as integer)` to obtain
     *   Unix-seconds values.
     * - `>= 3_035_000`: the `RETURNING` clause (added in SQLite 3.35 for
     *   `DELETE`, `INSERT` and `UPDATE`) is emitted on `INSERT` to retrieve the
     *   last inserted id directly from the statement.
     * - `>= 3_030_000`: native `NULLS FIRST` / `NULLS LAST` syntax in
     *   `ORDER BY` is emitted (added in SQLite 3.30).
     * - below those breakpoints, `NULLS FIRST` / `NULLS LAST` ordering is
     *   emulated, `last_insert_rowid()` is used to retrieve the inserted id,
     *   and `strftime('%s', ...)` / `julianday()` arithmetic is used to obtain
     *   Unix timestamps.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    protected getDateTimeFormat(_type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        return 'localdate milliseconds as text'
    }
    protected treatUnexpectedIntegerDateTimeAsJulian: boolean = false
    protected treatUnexpectedStringDateTimeAsUTC: boolean = false
    protected unexpectedUnixDateTimeAreMilliseconds: boolean = false

    protected override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown {
        if (value === undefined || value == null || (value === '' && !this.allowEmptyString)) {
            return super.transformValueFromDB(value, context)
        }
        if (isPlainTemporalClass(context.requestedType)) {
            // A Temporal value without zone kept as a number (a Julian day, a Unix time) is read as the digits of the
            // UTC instant it gives; a text is read by the connection, with all its digits
            const kind: SqliteDateTimeFormatType = isKeptInADateClass(context.requestedType) ? 'date' : __isPlainTimeClass(context.requestedType) ? 'time' : 'dateTime'
            const number = typeof value === 'number' || typeof value === 'bigint' ? Number(value) : typeof value === 'string' && value.trim() !== '' && !isNaN(+value) ? +value : undefined
            if (number !== undefined) {
                return super.transformValueFromDB(new Date(this.__sqliteMillisecondsOfNumber(number, kind)), context)
            }
            return super.transformValueFromDB(value, context)
        }
        if (__isInstantClass(context.requestedType)) {
            // An instant kept as a number (a Julian day, a Unix time) is that instant; a text, with all its digits, the
            // instant of its offset, or else of the zone its format says (getDateTimeFormat('dateTime'), as a localDateTime)
            const temporal = __temporal(context.requestedType.type)
            if (value instanceof temporal.Instant) {
                return value
            }
            const number = typeof value === 'number' || typeof value === 'bigint' ? Number(value) : typeof value === 'string' && value.trim() !== '' && !isNaN(+value) ? +value : undefined
            if (number !== undefined) {
                const milliseconds = this.__sqliteMillisecondsOfNumber(number, 'dateTime')
                if (!isNaN(milliseconds)) {
                    return temporal.Instant.fromEpochMilliseconds(milliseconds)
                }
            } else if (typeof value === 'string') {
                const format = this.getDateTimeFormat('dateTime')
                const textZone = format.startsWith('UTC') || (!format.startsWith('localdate') && this.treatUnexpectedStringDateTimeAsUTC) ? 'UTC' : temporal.Now.timeZoneId()
                const received = parseInstantText(value, textZone, context.requestedType.type)
                if (received) {
                    return received
                }
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, 'Invalid instant value received from the db: ' + String(value))
        }
        if (__isLocalDateClass(context.requestedType)) {
            if (typeof value === 'string') {
                const valueAsNumber = +value
                if (!isNaN(valueAsNumber)) {
                    value = valueAsNumber
                }
            }
            const dateTimeFormat = this.getDateTimeFormat('date')
            let result: Date
            if (value instanceof Date) {
                result = new Date(utcDayOf(value.getFullYear(), value.getMonth(), value.getDate()))
            } else if (typeof value === 'string') {
                if (isDateTimeTextOutOfCalendar(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDate value received from the db: ${value} (out of the calendar)`)
                }
                if (containsTimezone(value)) {
                    result = utcDateOnly(sqliteDateOfText(value, false))
                } else switch (dateTimeFormat) {
                    case 'localdate seconds as text':
                    case 'localdate milliseconds as text':
                    case 'localdate seconds as text using T separator':
                    case 'localdate milliseconds as text using T separator':
                        if (value.length <= 10) {
                            result = sqliteDateOfText(value + ' 00:00', false) // If time is omited, UTC timezone will be used instead the local one
                        } else {
                            result = sqliteDateOfText(value, false)
                        }
                        result = new Date(utcDayOf(result.getFullYear(), result.getMonth(), result.getDate()))
                        break
                    case 'Julian day as real number':
                    case 'Unix time seconds as integer':
                    case 'Unix time milliseconds as integer':
                        if (!this.treatUnexpectedStringDateTimeAsUTC) {
                            if (value.length <= 10) {
                                result = sqliteDateOfText(value + ' 00:00', false) // If time is omited, UTC timezone will be used instead the local one
                            } else {
                                result = sqliteDateOfText(value, false)
                            }
                            result = new Date(utcDayOf(result.getFullYear(), result.getMonth(), result.getDate()))
                        } else {
                            result = utcDateOnly(sqliteDateOfText(value, true))
                        }
                        break
                    case 'UTC seconds as text':
                    case 'UTC milliseconds as text':
                    case 'UTC seconds as text using T separator':
                    case 'UTC milliseconds as text using T separator':
                    case 'UTC seconds as text using Z timezone':
                    case 'UTC milliseconds as text using Z timezone':
                    case 'UTC seconds as text using T separator and Z timezone':
                    case 'UTC milliseconds as text using T separator and Z timezone':
                        result = utcDateOnly(sqliteDateOfText(value, true))
                        break
                    default:
                        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                }
            } else if (typeof value === 'number' || typeof value === 'bigint') {
                let number: number = (typeof value === 'bigint') ? Number(value) : value;

                if (dateTimeFormat === 'Julian day as real number') {
                    result = new Date(julianToMilliseconds(number)) // Timezone is not compesated due down time is overwrited
                } else if (dateTimeFormat === 'Unix time seconds as integer') {
                    result = new Date(number * 1000)
                } else if (dateTimeFormat === 'Unix time milliseconds as integer') {
                    result = new Date(number)
                } else {
                    // Try to automatically detect if it is a julian or a unix time
                    // If it have decimal, it will be considered julian, otherwise unix time
                    if (this.treatUnexpectedIntegerDateTimeAsJulian || !Number.isInteger(value)) {
                        result = new Date(julianToMilliseconds(number))
                    } else if (this.unexpectedUnixDateTimeAreMilliseconds) {
                        result = new Date(number)
                    } else {
                        result = new Date(number * 1000)
                    }
                }
                result.setUTCHours(0, 0, 0, 0)
            } else {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDate value received from the db: ${value} (type ${typeof value})`)
            }
            if (isNaN(result.getTime())) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDate value received from the db: ${value} (.getTime() returns NaN)`)
            }
            (result as any).___type___ = 'localDate'
            // date-stability offset (see the note on AbstractConnection's 'localDate' decode)
            result.setUTCMinutes(600)
            return result
        }
        if (__isLocalTimeClass(context.requestedType)) {
            if (typeof value === 'string') {
                const valueAsNumber = +value
                if (!isNaN(valueAsNumber)) {
                    value = valueAsNumber
                }
            }
            const dateTimeFormat = this.getDateTimeFormat('time')
            let result: Date
            if (value instanceof Date) {
                result = new Date(value.getTime())
            } else if (typeof value === 'string') {
                if (isDateTimeTextOutOfCalendar(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localTime value received from the db: ${value} (out of the calendar)`)
                }
                if (containsTimezone(value)) {
                    if (containsDate(value)) {
                        result = sqliteDateOfText(value, false)
                    } else {
                        result = sqliteDateOfText('1970-01-01 ' + value, false)
                    }
                } else switch (dateTimeFormat) {
                    case 'localdate seconds as text':
                    case 'localdate milliseconds as text':
                    case 'localdate seconds as text using T separator':
                    case 'localdate milliseconds as text using T separator':
                        if (containsDate(value)) {
                            result = sqliteDateOfText(value, false)
                        } else {
                            result = sqliteDateOfText('1970-01-01 ' + value, false)
                        }
                        break
                    case 'Julian day as real number':
                    case 'Unix time seconds as integer':
                    case 'Unix time milliseconds as integer':
                        if (containsDate(value)) {
                            if (this.treatUnexpectedStringDateTimeAsUTC) {
                                result = sqliteDateOfText(value, true)
                            } else {
                                result = sqliteDateOfText(value, false)
                            }
                        } else {
                            if (this.treatUnexpectedStringDateTimeAsUTC) {
                                result = sqliteDateOfText('1970-01-01 ' + value, true)
                            } else {
                                result = sqliteDateOfText('1970-01-01 ' + value, false)
                            }
                        }
                        break
                    case 'UTC seconds as text':
                    case 'UTC milliseconds as text':
                    case 'UTC seconds as text using T separator':
                    case 'UTC milliseconds as text using T separator':
                    case 'UTC seconds as text using Z timezone':
                    case 'UTC milliseconds as text using Z timezone':
                    case 'UTC seconds as text using T separator and Z timezone':
                    case 'UTC milliseconds as text using T separator and Z timezone':
                        if (containsDate(value)) {
                            result = sqliteDateOfText(value, true)
                        } else {
                            result = sqliteDateOfText('1970-01-01 ' + value, true)
                        }
                        break
                    default:
                        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                }
            } else if (typeof value === 'number' || typeof value === 'bigint') {
                let number: number = (typeof value === 'bigint') ? Number(value) : value;

                if (dateTimeFormat === 'Julian day as real number') {
                    result = new Date(julianToMilliseconds(number + 2440587.5 /* 1970-01-01 */))
                } else if (dateTimeFormat === 'Unix time seconds as integer') {
                    result = new Date(number * 1000)
                } else if (dateTimeFormat === 'Unix time milliseconds as integer') {
                    result = new Date(number)
                } else {
                    // Try to automatically detect if it is a julian or a unix time
                    // If it have decimal, it will be considered julian, otherwise unix time
                    if (this.treatUnexpectedIntegerDateTimeAsJulian || !Number.isInteger(number)) {
                        if (number >= -1 && number <= 1) {
                            result = new Date(julianToMilliseconds(number + 2440587.5 /* 1970-01-01 */))
                        } else {
                            result = new Date(julianToMilliseconds(number))
                        }
                    } else if (this.unexpectedUnixDateTimeAreMilliseconds) {
                        result = new Date(number)
                    } else {
                        result = new Date(number * 1000)
                    }
                }
            } else {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localTime value received from the db: ${value} (type ${typeof value})`)
            }
            if (isNaN(result.getTime())) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localTime value received from the db: ${value} (.getTime() returns NaN)`)
            }
            (result as any).___type___ = 'localTime'
            result.setFullYear(1970, 0, 1)
            return result
        }
        if (__isLocalDateTimeClass(context.requestedType)) {
            if (typeof value === 'string') {
                const valueAsNumber = +value
                if (!isNaN(valueAsNumber)) {
                    value = valueAsNumber
                }
            }
            const dateTimeFormat = this.getDateTimeFormat('dateTime')
            let result: Date
            if (value instanceof Date) {
                result = value
            } else if (typeof value === 'string') {
                if (isDateTimeTextOutOfCalendar(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDateTime value received from the db: ${value} (out of the calendar)`)
                }
                if (containsTimezone(value)) {
                    result = sqliteDateOfText(value, false)
                } else switch (dateTimeFormat) {
                    case 'localdate seconds as text':
                    case 'localdate milliseconds as text':
                    case 'localdate seconds as text using T separator':
                    case 'localdate milliseconds as text using T separator':
                        result = sqliteDateOfText(value, false)
                        break
                    case 'Julian day as real number':
                    case 'Unix time seconds as integer':
                    case 'Unix time milliseconds as integer':
                        if (this.treatUnexpectedStringDateTimeAsUTC) {
                            result = sqliteDateOfText(value, true)
                        } else {
                            result = sqliteDateOfText(value, false)
                        }
                        break
                    case 'UTC seconds as text':
                    case 'UTC milliseconds as text':
                    case 'UTC seconds as text using T separator':
                    case 'UTC milliseconds as text using T separator':
                    case 'UTC seconds as text using Z timezone':
                    case 'UTC milliseconds as text using Z timezone':
                    case 'UTC seconds as text using T separator and Z timezone':
                    case 'UTC milliseconds as text using T separator and Z timezone':
                        result = sqliteDateOfText(value, true)
                        break
                    default:
                        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                }
            } else if (typeof value === 'number' || typeof value === 'bigint') {
                let number: number = (typeof value === 'bigint') ? Number(value) : value;

                if (dateTimeFormat === 'Julian day as real number') {
                    result = new Date(julianToMilliseconds(number)) // Timezone is not compesated due down time is overwrited
                } else if (dateTimeFormat === 'Unix time seconds as integer') {
                    result = new Date(number * 1000)
                } else if (dateTimeFormat === 'Unix time milliseconds as integer') {
                    result = new Date(number)
                } else {
                    // Try to automatically detect if it is a julian or a unix time
                    // If it have decimal, it will be considered julian, otherwise unix time
                    if (this.treatUnexpectedIntegerDateTimeAsJulian || !Number.isInteger(value)) {
                        result = new Date(julianToMilliseconds(number))
                    } else if (this.unexpectedUnixDateTimeAreMilliseconds) {
                        result = new Date(number)
                    } else {
                        result = new Date(number * 1000)
                    }
                }
            } else {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDateTime value received from the db: ${value} (type ${typeof value})`)
            }
            if (isNaN(result.getTime())) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDateTime value received from the db: ${value} (.getTime() returns NaN)`)
            }
            (result as any).___type___ = 'localDateTime'
            return result
        }
        return super.transformValueFromDB(value, context)
    }
    /**
     * The milliseconds since 1970-01-01 UTC of a date or a time kept as a number, as a localDate, a localTime or a
     * localDateTime reads it: a Julian day (of a time, the fraction of a day since midnight, or a Julian day near
     * 1970-01-01), or a Unix time in seconds or milliseconds, by the format of its type; with a format that isn't a
     * number, a number with a fraction is a Julian day, and an integer a Unix time (treatUnexpectedIntegerDateTimeAsJulian,
     * unexpectedUnixDateTimeAreMilliseconds)
     */
    private __sqliteMillisecondsOfNumber(number: number, kind: SqliteDateTimeFormatType): number {
        const dateTimeFormat = this.getDateTimeFormat(kind)
        if (dateTimeFormat === 'Julian day as real number') {
            return julianToMilliseconds(kind === 'time' ? number + 2440587.5 /* 1970-01-01 */ : number)
        }
        if (dateTimeFormat === 'Unix time seconds as integer') {
            return number * 1000
        }
        if (dateTimeFormat === 'Unix time milliseconds as integer') {
            return number
        }
        if (this.treatUnexpectedIntegerDateTimeAsJulian || !Number.isInteger(number)) {
            return julianToMilliseconds(kind === 'time' && number >= -1 && number <= 1 ? number + 2440587.5 /* 1970-01-01 */ : number)
        }
        return this.unexpectedUnixDateTimeAreMilliseconds ? number : number * 1000
    }
    protected override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown {
        if (value === undefined || value == null || (value === '' && !this.allowEmptyString)) {
            return super.transformValueToDB(value, context)
        }
        if (__isBigintClass(context.requestedType) && __isExactDecimalSql(context.requestedType)) {
            // An integer whose SQL data type is wider than the 64 bits of SQLite is an exact number kept as its text, as
            // an exact decimal is: the SQL of the library computes and compares it with the decimal functions
            if (typeof value === 'bigint') {
                return value.toString()
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: context.requestedType.type }, 'Invalid bigint value to send to the db: ' + String(value))
        }
        if (__isInstantClass(context.requestedType)) {
            // Checked by the connection: an instant, kept in the format of a localDateTime (getDateTimeFormat('dateTime')):
            // a text of its wall clock in UTC, or in the zone of the process for a localdate format, or its number
            const checked = super.transformValueToDB(value, context) as { toZonedDateTimeISO(zone: string): { toPlainDateTime(): TemporalPlainDateTime } }
            const format = this.getDateTimeFormat('dateTime')
            const zone = format.startsWith('localdate') ? __temporal(context.requestedType.type).Now.timeZoneId() : 'UTC'
            return sqlitePlainTemporalValue(checked.toZonedDateTimeISO(zone).toPlainDateTime(), 'dateTime', format)
        }
        if (isPlainTemporalClass(context.requestedType)) {
            // Checked by the connection: a Temporal value of the type, kept in the format of its type (getDateTimeFormat)
            const checked = super.transformValueToDB(value, context)
            const kind: SqliteDateTimeFormatType = isKeptInADateClass(context.requestedType) ? 'date' : __isPlainTimeClass(context.requestedType) ? 'time' : 'dateTime'
            return sqlitePlainTemporalValue(checked as TemporalPlainDate | TemporalPlainTime | TemporalPlainDateTime, kind, this.getDateTimeFormat(kind))
        }
        if (__isLocalDateClass(context.requestedType)) {
            if (value instanceof Date && !isNaN(value.getTime())) {
                const dateTimeFormat = this.getDateTimeFormat('date')
                switch (dateTimeFormat) {
                    case 'localdate seconds as text':
                    case 'localdate milliseconds as text':
                    case 'localdate seconds as text using T separator':
                    case 'localdate milliseconds as text using T separator':
                    case 'UTC seconds as text':
                    case 'UTC milliseconds as text':
                    case 'UTC seconds as text using T separator':
                    case 'UTC milliseconds as text using T separator':
                    case 'UTC seconds as text using Z timezone':
                    case 'UTC milliseconds as text using Z timezone':
                    case 'UTC seconds as text using T separator and Z timezone':
                    case 'UTC milliseconds as text using T separator and Z timezone':
                        return fullYearText(value.getFullYear()) + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                    case 'Julian day as real number':
                        return millisecondsToJulian(utcDayOf(value.getFullYear(), value.getMonth(), value.getDate()))
                    case 'Unix time seconds as integer':
                        return Math.trunc(utcDayOf(value.getFullYear(), value.getMonth(), value.getDate()) / 1000)
                    case 'Unix time milliseconds as integer':
                        return utcDayOf(value.getFullYear(), value.getMonth(), value.getDate())
                    default:
                        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                }
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDate value to send to the db: ${value} (type ${typeof value})`)
        }
        if (__isLocalTimeClass(context.requestedType)) {
            if (value instanceof Date && !isNaN(value.getTime())) {
                const dateTimeFormat = this.getDateTimeFormat('time')
                switch (dateTimeFormat) {
                    case 'localdate seconds as text':
                    case 'localdate seconds as text using T separator':
                        return doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds())
                    case 'localdate milliseconds as text':
                    case 'localdate milliseconds as text using T separator':
                        return doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds()) + '.' + tripleDigit(value.getMilliseconds())
                    case 'UTC seconds as text':
                    case 'UTC seconds as text using T separator':
                        return doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds())
                    case 'UTC milliseconds as text':
                    case 'UTC milliseconds as text using T separator':
                        return doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + '.' + tripleDigit(value.getUTCMilliseconds())
                    case 'UTC seconds as text using Z timezone':
                    case 'UTC seconds as text using T separator and Z timezone':
                        return doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + 'Z'
                    case 'UTC milliseconds as text using Z timezone':
                    case 'UTC milliseconds as text using T separator and Z timezone':
                        return doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + '.' + tripleDigit(value.getUTCMilliseconds()) + 'Z'
                    case 'Julian day as real number':
                        return millisecondsToJulian(Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds())) - 2440587.5 /* 1970-01-01 */
                    case 'Unix time seconds as integer':
                        return Math.trunc(Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds()) / 1000)
                    case 'Unix time milliseconds as integer':
                        return Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds())
                    default:
                        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                }
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: context.requestedType.type }, `Invalid localTime value to send to the db: ${value} (type ${typeof value})`)
        }
        if (__isLocalDateTimeClass(context.requestedType)) {
            if (value instanceof Date && !isNaN(value.getTime())) {
                const dateTimeFormat = this.getDateTimeFormat('dateTime')
                switch (dateTimeFormat) {
                    case 'localdate seconds as text':
                        return fullYearText(value.getFullYear()) + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                            + ' ' + doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds())
                    case 'localdate milliseconds as text':
                        return fullYearText(value.getFullYear()) + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                            + ' ' + doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds()) + '.' + tripleDigit(value.getMilliseconds())
                    case 'localdate seconds as text using T separator':
                        return fullYearText(value.getFullYear()) + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                            + 'T' + doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds())
                    case 'localdate milliseconds as text using T separator':
                        return fullYearText(value.getFullYear()) + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                            + 'T' + doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds()) + '.' + tripleDigit(value.getMilliseconds())
                    case 'UTC seconds as text':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + ' ' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds())
                    case 'UTC milliseconds as text':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + ' ' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + '.' + tripleDigit(value.getUTCMilliseconds())
                    case 'UTC seconds as text using Z timezone':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + ' ' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + 'Z'
                    case 'UTC milliseconds as text using Z timezone':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + ' ' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + '.' + tripleDigit(value.getUTCMilliseconds()) + 'Z'
                    case 'UTC seconds as text using T separator':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + 'T' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds())
                    case 'UTC milliseconds as text using T separator':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + 'T' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + '.' + tripleDigit(value.getUTCMilliseconds())
                    case 'UTC seconds as text using T separator and Z timezone':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + 'T' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + 'Z'
                    case 'UTC milliseconds as text using T separator and Z timezone':
                        return fullYearText(value.getUTCFullYear()) + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                            + 'T' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + '.' + tripleDigit(value.getUTCMilliseconds()) + 'Z'
                    case 'Julian day as real number':
                        return millisecondsToJulian(value.getTime())
                    case 'Unix time seconds as integer':
                        return Math.trunc(value.getTime() / 1000)
                    case 'Unix time milliseconds as integer':
                        return value.getTime()
                    default:
                        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                }
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: context.requestedType.type }, `Invalid localDateTime value to send to the db: ${value} (type ${typeof value})`)
        }
        return super.transformValueToDB(value, context)
    }
}

function doubleDigit(value: number): string {
    if (value > 9) {
        return '' + value
    } else {
        return '0' + value
    }
}

function tripleDigit(value: number): string {
    if (value > 99) {
        return '' + value
    } else if (value > 9) {
        return '0' + value
    } else {
        return '00' + value
    }
}


/**
 * The year of a date as SQLite keeps it in a text: 4 digits (its date functions read only these), and the sign of a
 * year before 0 (`-0043`)
 */
function fullYearText(year: number): string {
    return year < 0 ? '-' + String(-year).padStart(4, '0') : String(year).padStart(4, '0')
}

/** The milliseconds of 00:00 UTC of a day, also of the years 0 to 99, which Date.UTC takes as 1900 to 1999 */
function utcDayOf(year: number, month: number, day: number): number {
    const result = new Date(0)
    result.setUTCFullYear(year, month, day)
    return result.getTime()
}

// A date of SQLite as text: its date, its time and its offset (see sqliteDateOfText)
const sqliteDateTextPattern = /^([+-]?\d{1,6})-(\d\d?)-(\d\d?)(?:[T ](\d\d?):(\d\d?)(?::(\d\d?)(?:\.(\d+))?)?)?\s*(Z|[+-]\d\d?(?::?\d\d)?)?$/i

/**
 * The Date of a text of a date of SQLite: with an offset (`Z`, `+09:00`), that instant; without one, of its digits in
 * UTC (inUtc) or in the zone of the process. The year is read as it is written: a Date reads the text of the years 0
 * to 99 as 1900 to 1999 or 2000 to 2049. The fraction of a second is cut to the millisecond. A text of another form
 * is read as a Date reads it.
 */
function sqliteDateOfText(text: string, inUtc: boolean): Date {
    const match = sqliteDateTextPattern.exec(text.trim())
    if (!match) {
        return new Date(inUtc ? text + 'Z' : text)
    }
    const [, yearText, monthText, dayText, hoursText, minutesText, secondsText, fractionText, offsetText] = match
    const year = Number(yearText)
    const month = Number(monthText) - 1
    const day = Number(dayText)
    const hours = hoursText === undefined ? 0 : Number(hoursText)
    const minutes = minutesText === undefined ? 0 : Number(minutesText)
    const seconds = secondsText === undefined ? 0 : Number(secondsText)
    const milliseconds = fractionText === undefined ? 0 : Number((fractionText + '00').slice(0, 3))
    const result = new Date(0)
    if (offsetText === undefined && !inUtc) {
        result.setFullYear(year, month, day)
        result.setHours(hours, minutes, seconds, milliseconds)
        return result
    }
    result.setUTCFullYear(year, month, day)
    result.setUTCHours(hours, minutes, seconds, milliseconds)
    if (offsetText !== undefined && offsetText.toUpperCase() !== 'Z') {
        const digits = offsetText.slice(1).replace(':', '')
        const offsetMinutes = Number(digits.slice(0, digits.length > 2 ? digits.length - 2 : digits.length)) * 60 + (digits.length > 2 ? Number(digits.slice(-2)) : 0)
        result.setTime(result.getTime() - (offsetText[0] === '-' ? -offsetMinutes : offsetMinutes) * 60000)
    }
    return result
}

function millisecondsToJulian(value: number): number {
    return value / 86400000.0 + 2440587.5
}

function julianToMilliseconds(value: number): number {
    // A Julian day in a double is only exact to some microseconds, and a Date would truncate it to the previous millisecond
    return Math.round((value - 2440587.5) * 86400000.0)
}

function utcDateOnly(value: Date): Date {
    return new Date(utcDayOf(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function containsTimezone(value: string): boolean {
    return /(([\+\-]\d\d?(:\d\d?)?)|Z)$/.test(value)
}

function containsDate(value: string): boolean {
    return /^\d+-\d\d?-\d\d?(\s|T)/.test(value)
}

/** The family of a declared type of SQLite (see sqlDataTypeFrom), without its native name */
function sqliteFamilyOf(nativeName: string): SqlDataType {
    const { key, args } = nativeTypeParts(nativeName)
    const n0 = argumentNumber(args[0])
    const n1 = argumentNumber(args[1])
    switch (key) {
        case '': case 'any': return { family: 'variant' }
        case 'int': case 'integer': case 'bigint': case 'int8': return { family: 'exact numeric', scale: 0, bytes: 8 }
        case 'smallint': case 'int2': return { family: 'exact numeric', scale: 0, bytes: 2 }
        case 'tinyint': return { family: 'exact numeric', scale: 0, bytes: 1 }
        case 'mediumint': return { family: 'exact numeric', scale: 0, bytes: 3 }
        case 'int4': return { family: 'exact numeric', scale: 0, bytes: 4 }
        case 'decimal': case 'numeric': case 'dec':
            return { family: 'exact numeric', precision: n0, scale: n0 === undefined ? undefined : n1 ?? 0 }
        case 'real': case 'double': case 'double precision': case 'float': case 'float8': return { family: 'approximate numeric', precision: 53 }
        case 'float4': return { family: 'approximate numeric', precision: 24 }
        case 'boolean': case 'bool': return { family: 'boolean' }
        case 'text': case 'clob': return { family: 'character string' }
        case 'varchar': case 'character varying': case 'varchar2': return { family: 'character string', length: n0 }
        case 'char': case 'character': return { family: 'character string', length: n0 ?? 1, fixed: true }
        case 'nvarchar': case 'nvarchar2': case 'national character varying': return { family: 'character string', length: n0, national: true }
        case 'nchar': case 'national character': return { family: 'character string', length: n0 ?? 1, fixed: true, national: true }
        case 'blob': case 'bytea': return { family: 'binary string' }
        case 'binary': return { family: 'binary string', length: n0 ?? 1, fixed: true }
        case 'varbinary': return { family: 'binary string', length: n0 }
        case 'date': return { family: 'datetime', fields: 'date' }
        case 'time': return { family: 'datetime', fields: 'time', timeZone: 'none' }
        case 'datetime': case 'timestamp': return { family: 'datetime', fields: 'timestamp', timeZone: 'none' }
        case 'uuid': return { family: 'uuid' }
        case 'json': return { family: 'document', format: 'json' }
    }
    return { family: 'user-defined', name: nativeName.trim() }
}

/**
 * A Temporal value without zone in the format SQLite keeps its type in (getDateTimeFormat): its digits as text, with
 * the seconds or the milliseconds the format says (the digits below are dropped), the `T` separator and the `Z` of the
 * format (a value without zone has the same digits in every zone); or the number of the instant its digits give in UTC:
 * a Julian day (of a time, the fraction of a day since midnight), or a Unix time in seconds or milliseconds
 */
function sqlitePlainTemporalValue(value: TemporalPlainDate | TemporalPlainTime | TemporalPlainDateTime, kind: SqliteDateTimeFormatType, dateTimeFormat: SqliteDateTimeFormat): string | number {
    const dateTime: TemporalPlainDateTime = kind === 'date' ? (value as TemporalPlainDate).toPlainDateTime() : kind === 'time' ? onTheEpochDay(value as TemporalPlainTime) : value as TemporalPlainDateTime
    const milliseconds = dateTime.toZonedDateTime('UTC').epochMilliseconds
    switch (dateTimeFormat) {
        case 'Julian day as real number':
            return kind === 'time' ? millisecondsToJulian(milliseconds) - 2440587.5 /* 1970-01-01 */ : millisecondsToJulian(milliseconds)
        case 'Unix time seconds as integer':
            return Math.trunc(milliseconds / 1000)
        case 'Unix time milliseconds as integer':
            return milliseconds
        default:
    }
    const withMilliseconds = dateTimeFormat.includes('milliseconds')
    const time = doubleDigit(dateTime.hour) + ':' + doubleDigit(dateTime.minute) + ':' + doubleDigit(dateTime.second) + (withMilliseconds ? '.' + tripleDigit(dateTime.millisecond) : '')
    const zone = dateTimeFormat.includes('Z timezone') ? 'Z' : ''
    if (kind === 'date') {
        return plainDateText(dateTime)
    }
    if (kind === 'time') {
        return time + zone
    }
    return plainDateText(dateTime) + (dateTimeFormat.includes('T separator') ? 'T' : ' ') + time + zone
}

/** The time of the day on 1970-01-01, the day a time kept as a number counts from */
function onTheEpochDay(value: TemporalPlainTime): TemporalPlainDateTime {
    return (__temporal('plainTime').PlainDate.from({ year: 1970, month: 1, day: 1 })).toPlainDateTime(value)
}
