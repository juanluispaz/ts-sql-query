import type { NConnection, NSource } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { PostgreSqlSqlBuilder } from '../sqlBuilders/PostgreSqlSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { AggregatedArrayColumns, SourceOfAggregatedArray, TransactionIsolationLevel } from './AbstractConnection.js'
import type { AggregatedArrayValueSource, AggregatedArrayValueSourceProjectableAsNullable, IStringValueSource, IValueSource, StringValueSource, ValueSourceOf } from '../expressions/values.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { source, valueType } from '../utils/symbols.js'
import { AggregateFunctions1or2ValueSource, AggregateValueAsArrayValueSource } from '../internal/ValueSourceImpl.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'

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
     * Use PostgreSQL's native, platform-dependent `round(double precision)`
     * when applying `.round()` to a `double precision` expression (most
     * commonly anything that flows through `.divide(...)`, which the
     * SqlBuilder always casts to `::float`).
     *
     * Per the PostgreSQL manual, `round(numeric)` breaks ties by rounding
     * **away from zero** (so `round(0.5) → 1`), while `round(double
     * precision)` defers to libm — *"the tie-breaking behavior is platform
     * dependent, but 'round to nearest even' is the most common rule"* (so
     * `round(0.5) → 0` on most systems). Every other dialect ts-sql-query
     * supports rounds away from zero, so by default the library casts the
     * operand of `.round()` to `numeric` on PostgreSQL to make the behavior
     * portable and predictable across dialects.
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

    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
    }

    aggregateAsArrayDistinct<COLUMNS extends AggregatedArrayColumns<NConnection<'postgreSql', NAME>>>(columns: COLUMNS): AggregatedArrayValueSourceProjectableAsNullable<SourceOfAggregatedArray<COLUMNS>, Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>, 'required'> {
        return new AggregateValueAsArrayValueSource(columns as QueryColumns, 'InnerResultObject', 'required', true)
    }
    aggregateAsArrayOfOneColumnDistinct<VALUE extends IValueSource<any, any, any, any>>(value: VALUE): AggregatedArrayValueSource<VALUE[typeof source], Array<VALUE[typeof valueType]>, 'required'> {
        return new AggregateValueAsArrayValueSource(value, 'InnerResultObject', 'required', true)
    }
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'postgreSql', NAME>>): StringValueSource<SOURCE, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'postgreSql', NAME>>, separator: string): StringValueSource<SOURCE, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcatDistinct', separator, value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }

    default(): Default {
        return new DefaultImpl()
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable' | 'read write' | 'read only', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel {
        if (level === 'read write' || level === 'read only') {
            return [undefined, level] as any
        }
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
    }

    protected override transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown): string {
        if (!forceTypeCast) {
            return super.transformPlaceholder(placeholder, type, forceTypeCast, valueSentToDB)
        }

        switch (type) {
            case 'boolean':
                return placeholder + '::bool'
            case 'int':
                return placeholder + '::int4'
            case 'bigint':
                return placeholder + '::int8'
            case 'stringInt':
                return placeholder + '::int8'
            case 'double':
                return placeholder + '::float8'
            case 'stringDouble':
                return placeholder + '::float8'
            case 'string':
                return placeholder + '::text'
            case 'uuid':
                return placeholder + '::uuid'
            case 'localDate':
                return placeholder + '::date'
            case 'localTime':
                return placeholder + '::timestamp::time'
            case 'localDateTime':
                return placeholder + '::timestamp'
        }

        if (typeof valueSentToDB === 'bigint') {
            return placeholder + '::int8'
        }
        if (typeof valueSentToDB === 'number') {
            if (Number.isInteger(valueSentToDB)) {
                if (valueSentToDB >= -2147483648 && valueSentToDB <= 2147483647) {
                    // Int32 number
                    return placeholder + '::int4'
                } else {
                    return placeholder + '::int8'
                }
            } else {
                return placeholder + '::float8'
            }
        }

        return placeholder
    }
}
