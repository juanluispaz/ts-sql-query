import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { MySqlSqlBuilder } from '../sqlBuilders/MySqlSqlBuilder.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import { AbstractConnection } from './AbstractConnection.js'

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

    constructor(queryRunner: QueryRunner, sqlBuilder: MySqlSqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mySql')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable' | 'read write' | 'read only', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel {
        if (level === 'read write' || level === 'read only') {
            return [undefined, accessMode] as any
        }
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
    }
}
