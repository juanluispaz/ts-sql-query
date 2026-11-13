import type { NAggregate, NConnection, NNotNestedAggregate, NSource } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { PostgreSqlSqlBuilder, postgreSqlZonedValueSql } from '../sqlBuilders/PostgreSqlSqlBuilder.js'
import type { TypeAdapterProjectionContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import { __isLocalDateTime, __isLocalTime } from '../utils/dataTypes.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { AggregatedArrayColumns, SourceOfAggregatedArray, TransactionIsolationLevel } from './AbstractConnection.js'
import type { AggregatedArrayValueSource, AggregatedArrayValueSourceProjectableAsNullable, IStringValueSource, IValueSource, StringValueSource, ValueSourceOf , RemapValueSourceTypeWithOptionalType} from '../expressions/values.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { source, valueType } from '../utils/symbols.js'
import { AggregateFunctions1ValueSource, AggregateFunctions1or2ValueSource, AggregateValueAsArrayValueSource } from '../internal/ValueSourceImpl.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'
import { postgreSqlZonedParam } from '../utils/metadataSymbols.js'

export abstract class PostgreSqlConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'postgreSql', NAME>> {

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
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    /**
     * With a databaseTimeZone other than UTC, a localDateTime or a localTime parameter goes as a timestamptz of its
     * instant, which the database converts with its session (the zone of the database) into the wall clock it stores
     * or compares with
     */
    protected override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown {
        if (this.isDatabaseOutsideUtc()) {
            if (__isLocalDateTime(context.requestedType, context.requestedCustomType) || __isLocalTime(context.requestedType, context.requestedCustomType)) {
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
        if (this.isDatabaseOutsideUtc()) {
            const zoned = postgreSqlZonedValueSql(sql, context.requestedType, context.requestedCustomType, this.localTimeReferenceDate)
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
     * ignores NULL. Prefer {@link minValueFunction} / {@link maxValueFunction} if you
     * want NULL propagation without the operand-repeating `CASE`.
     */
    protected ignoreNullInMinAndMaxValue: boolean = false

    /**
     * Name of a user-defined SQL function that returns the **larger** of two values
     * and propagates NULL, used to emit `.minValue(x)` as `func(a, b)` instead of the
     * default NULL-poisoning `CASE`. Avoids repeating the operand (the
     * {@link OracleConnection.concatFunction} pattern). Preferred over the `CASE` when set.
     */
    protected minValueFunction?: string

    /**
     * Name of a user-defined SQL function that returns the **smaller** of two values
     * and propagates NULL, used to emit `.maxValue(x)` as `func(a, b)` instead of the
     * default NULL-poisoning `CASE`. Avoids repeating the operand. Preferred over the
     * `CASE` when set.
     */
    protected maxValueFunction?: string

    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
    }

    aggregateAsArrayDistinct<COLUMNS extends AggregatedArrayColumns<NConnection<'postgreSql', NAME>>>(columns: COLUMNS & NNotNestedAggregate<SourceOfAggregatedArray<COLUMNS>, NConnection<'postgreSql', NAME>>): AggregatedArrayValueSourceProjectableAsNullable<SourceOfAggregatedArray<COLUMNS> | NAggregate<NConnection<'postgreSql', NAME>>, Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>, 'required'> {
        return new AggregateValueAsArrayValueSource(columns as QueryColumns, 'InnerResultObject', 'required', true)
    }
    aggregateAsArrayOfOneColumnDistinct<VALUE extends IValueSource<any, any, any, any>>(value: VALUE & NNotNestedAggregate<VALUE[typeof source], NConnection<'postgreSql', NAME>>): AggregatedArrayValueSource<VALUE[typeof source] | NAggregate<NConnection<'postgreSql', NAME>>, Array<VALUE[typeof valueType]>, 'required'> {
        return new AggregateValueAsArrayValueSource(value, 'InnerResultObject', 'required', true)
    }
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'postgreSql', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'postgreSql', NAME>>): StringValueSource<SOURCE | NAggregate<NConnection<'postgreSql', NAME>>, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'postgreSql', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'postgreSql', NAME>>, separator: string): StringValueSource<SOURCE | NAggregate<NConnection<'postgreSql', NAME>>, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcatDistinct', separator, value, valuePrivate.__type, valuePrivate.__customType, 'optional', valuePrivate.__typeAdapter)
    }

    anyValue<TYPE extends IValueSource<any, any, any, any>>(value: TYPE & SameDB<NConnection<'postgreSql', NAME>> & NNotNestedAggregate<TYPE[typeof source], NConnection<'postgreSql', NAME>>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<NConnection<'postgreSql', NAME>>, TYPE, 'optional'> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_anyValue', value, valuePrivate.__type, valuePrivate.__customType, 'optional', valuePrivate.__typeAdapter)) as any
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
