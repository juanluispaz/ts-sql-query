import type { NAggregate, NConnection, NNotNestedAggregate, NSource } from '../utils/sourceName.js'
import type { SqlDataType } from '../TypeAdapter.js'
import { mySqlMariaDBSqlDataTypeFrom, mySqlMariaDBNativeSqlDataTypeOf } from '../utils/mySqlMariaDB/mySqlMariaDBSqlDataTypes.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { MySqlSqlBuilder } from '../sqlBuilders/MySqlSqlBuilder.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import { AbstractConnection } from './AbstractConnection.js'
import type { source } from '../utils/symbols.js'
import { __createAggregateFunction1, __createAggregateFunction1or2, __asNodeValueSource } from '../typeSystem/valueSourceFactory.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'
import type { ValueSourceOf, TypedValueSource } from '../typeSystem/valueSource.js'
import type { IValueSource, RemapValueSourceTypeWithOptionalType, ValueSource } from '../typeSystem/base.js'
import type { StringType } from '../typeSystem/strings.js'
import { __typeClassOf } from '../typeSystem/valueSourceFactory.js'
import { __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'

export abstract class MySqlConnection</*in|out*/ NAME extends string> extends AbstractConnection<NConnection<'mySql', NAME>> {
    /**
     * The SQL data type of a type of MySQL, written as the `COLUMN_TYPE` of `information_schema.columns` (`decimal(18,4) unsigned`, `varchar(20)`, `enum('a','b')`), aliases
     * accepted, with that name as its native one: for `withSqlDataType`, or a generator that reads the catalogue
     */
    override sqlDataTypeFrom(nativeName: string): SqlDataType {
        return mySqlMariaDBSqlDataTypeFrom(nativeName, 'mySql')
    }
    /**
     * The type of MySQL for a SQL data type: its native name of MySQL when it has one, otherwise from its family and
     * its properties; undefined when MySQL can't hold it (never another type)
     */
    protected override buildNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
        return mySqlMariaDBNativeSqlDataTypeOf(sqlDataType, 'mySql', this.compatibilityVersion, this.uuidStrategy)
    }

    protected uuidStrategy: 'string' | 'string as sent' | 'binary' = 'binary'

    protected override __normalizeUuidText(value: string): string {
        // A uuid in a text column is written and read in lower case, as the other strategies and databases give it;
        // 'string as sent' keeps the text as it is
        return this.uuidStrategy === 'string' ? value.toLowerCase() : value
    }

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
    /**
     * Whether the functions of the library are in the database (its file of SQL, tsq-functions.sql): `'installed'` or
     * `'not installed'` (the default). The ones a query always needs, of durations, are called anyway. With them
     * installed the library also calls `tsq_zoned_wall` and `tsq_zoned_utc`, which read the date and time and the instant
     * of the text of a zoned date and time writing the text once; without them, the query reads it inline.
     */
    protected libraryFunctions: 'installed' | 'not installed' = 'not installed'

    constructor(queryRunner: QueryRunner, sqlBuilder: MySqlSqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mySql')
    }

    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'mySql', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'mySql', NAME>>): ValueSource<SOURCE | NAggregate<NConnection<'mySql', NAME>>, StringType, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'mySql', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'mySql', NAME>>, separator: string): ValueSource<SOURCE | NAggregate<NConnection<'mySql', NAME>>, StringType, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const nodeValue = __asNodeValueSource(value)
        return __createAggregateFunction1or2('_stringConcatDistinct', separator, value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')
    }

    anyValue<TYPE extends TypedValueSource<any, any, any>>(value: TYPE & SameDB<NConnection<'mySql', NAME>> & NNotNestedAggregate<TYPE[typeof source], NConnection<'mySql', NAME>>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<NConnection<'mySql', NAME>>, TYPE, 'optional'> {
        const nodeValue = __asNodeValueSource(value)
        return (__createAggregateFunction1('_anyValue', value, __adaptedTypeClassOf(__typeClassOf(nodeValue), nodeValue.__typeAdapter), 'optional')) as any
    }

    default(): Default {
        return new DefaultImpl()
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'snapshot' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'mySql', NAME>>
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'mySql', NAME>>
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'snapshot' | 'serializable' | 'read write' | 'read only', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'mySql', NAME>> {
        if (level === 'read write' || level === 'read only') {
            return [undefined, level] as any
        }
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
    }
}
