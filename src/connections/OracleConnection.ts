import type { NConnection, NSource } from '../utils/sourceName.js'
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

    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'oracle', NAME>>): StringValueSource<SOURCE, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'oracle', NAME>>, separator: string): StringValueSource<SOURCE, 'optional'>
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
        return super.transformValueToDB(value, type)
    }
}
