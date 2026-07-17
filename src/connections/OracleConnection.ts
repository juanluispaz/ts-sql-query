import type { NAggregate, NConnection, NSource } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { OracleSqlBuilder } from '../sqlBuilders/OracleSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import type { IStringValueSource, StringValueSource, ValueSourceOf } from '../expressions/values.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import { AggregateFunctions1or2ValueSource } from '../internal/ValueSourceImpl.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'

export abstract class OracleConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'oracle', NAME>> {

    protected uuidStrategy: 'string' | 'custom-functions' | 'built-in' = 'built-in'

    /**
     * Name of a null-propagating concatenation function to emit instead of `||`.
     *
     * Oracle's `||` treats NULL as the empty string, so `'x' || null` is `'x'` where every
     * other supported database answers NULL. That makes `concat` return a present string
     * where its declared type says the result is optional, and — worse — it makes an affix
     * predicate built on a NULL term (`startsWith` / `endsWith` / `contains`) collapse to
     * `like '%'` and match the whole table instead of nothing.
     *
     * Left unset (the default) the builder emits Oracle's own `||` and its own semantics:
     * an Oracle developer expects them, and nothing is paid for a case most applications
     * never hit. Set it to the name of a function you created and every concatenation the
     * builder emits — `concat` and the affix patterns alike — goes through it, which is
     * what makes the behaviour match the other databases. The two always move together.
     *
     * The name is yours: pass whatever you called it, package-qualified if it lives in a
     * package (which it must, if you want the overloads that keep CLOB values from being
     * truncated). See the Oracle page of the documentation for an implementation.
     */
    protected concatFunction?: string

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
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('oracle')
    }

    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'oracle', NAME>>): StringValueSource<SOURCE | NAggregate<NConnection<'oracle', NAME>>, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'oracle', NAME>>, separator: string): StringValueSource<SOURCE | NAggregate<NConnection<'oracle', NAME>>, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcatDistinct', separator, value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }

    default(): Default {
        return new DefaultImpl()
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable' | 'read write' | 'read only'): TransactionIsolationLevel {
        if (level === 'read write' || level === 'read only') {
            return [undefined, level] as any
        }
        return [level] as any
    }

    protected override transformValueToDB(value: unknown, type: string): unknown {
        if (type === 'boolean' && typeof value === 'boolean') {
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion
            return Number(value);
        }
        if (type === 'localTime' && value instanceof Date && !isNaN(value.getTime())) {
            // Oracle has no TIME type, so a localTime is carried in a TIMESTAMP
            // anchored at 1970-01-01 (the same anchor used when reading it back).
            // The default marshalling sends a bare 'HH24:MI:SS' string, which
            // Oracle feeds through its implicit string→DATE conversion — that has
            // no month component and raises ORA-01843. Binding a Date instead lets
            // oracledb send it as a TIMESTAMP, exactly like localDateTime already does.
            return new Date(1970, 0, 1, value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds())
        }
        return super.transformValueToDB(value, type)
    }
}
