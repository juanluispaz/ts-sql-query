import type { NAggregate, NConnection, NSource } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { MySqlSqlBuilder } from '../sqlBuilders/MySqlSqlBuilder.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import { AbstractConnection } from './AbstractConnection.js'
import type { IStringValueSource, StringValueSource, ValueSourceOf } from '../expressions/values.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import { AggregateFunctions1or2ValueSource } from '../internal/ValueSourceImpl.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'

export abstract class MySqlConnection</*in|out*/ NAME extends string> extends AbstractConnection<NConnection<'mySql', NAME>> {

    protected uuidStrategy: 'string' | 'binary' = 'binary'

    /**
     * Minimum MySQL version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `8_000_019` for
     * MySQL 8.0.19, `8_000_000` for MySQL 8.0.0, `5_007_000` for MySQL 5.7).
     * Defaults to `Number.POSITIVE_INFINITY` (latest).
     *
     * Recognised breakpoints:
     * - `>= 8_000_019`: target MySQL 8.0.19+. The row alias syntax
     *   `INSERT ... AS _new_ ON DUPLICATE KEY UPDATE col = _new_.col` is emitted
     *   instead of the legacy `values(col)` reference (the alias was added in
     *   8.0.19; `VALUES()` was deprecated in 8.0.20).
     * - `>= 8_000_000`: target MySQL 8.0+. The `WITH` clause is used and
     *   recursive queries are supported.
     * - `< 8_000_000`: target MySQL 5. The `WITH` clause is not emitted (the
     *   inner query is inlined inside the `FROM` instead), recursive queries
     *   throw at query-build time, and the legacy `values(col)` reference is
     *   used inside `ON DUPLICATE KEY UPDATE`.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    /**
     * Use MySQL's native, platform-dependent `round(<double>)` when applying
     * `.round()` / `.roundn(n)` to a `DOUBLE` expression (most commonly anything
     * that flows through `.divide(...)` or `.asDouble()`, which the SqlBuilder
     * casts to `DOUBLE`).
     *
     * Per the MySQL manual, `ROUND()` over an exact-value number (DECIMAL) breaks
     * ties by rounding **away from zero** (so `round(0.5) → 1`), while over an
     * approximate-value number (DOUBLE) the result *"depends on the C library; on
     * many systems this means that ROUND() uses the 'round half to even' rule"*
     * (so `round(0.5) → 0` and `round(2.5) → 2`). ts-sql-query rounds away from
     * zero on every dialect, so by default the library casts the operand of
     * `.round()` back to an exact type to make the behavior portable and
     * predictable across dialects.
     *
     * Setting this flag to `true` opts out of the cast: the result of `.round()`
     * then follows whatever `round(<double>)` does on the underlying C library.
     * Use it when you want MySQL's native semantics — typically because the
     * application is single-dialect and prefers the IEEE 754 round-to-even
     * tie-breaking common on modern systems, or because existing queries depend
     * on it.
     */
    protected usePlatformDependentRound: boolean = false

    constructor(queryRunner: QueryRunner, sqlBuilder: MySqlSqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mySql')
    }

    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'mySql', NAME>>): StringValueSource<SOURCE | NAggregate<NConnection<'mySql', NAME>>, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'mySql', NAME>>, separator: string): StringValueSource<SOURCE | NAggregate<NConnection<'mySql', NAME>>, 'optional'>
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
}
