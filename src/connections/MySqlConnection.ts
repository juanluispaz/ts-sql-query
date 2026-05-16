import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { MySqlSqlBuilder } from '../sqlBuilders/MySqlSqlBuilder.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import { AbstractConnection } from './AbstractConnection.js'

export abstract class MySqlConnection</*in|out*/ NAME extends string> extends AbstractConnection<NConnection<'mySql', NAME>> {

    protected uuidStrategy: 'string' | 'binary' = 'binary'

    /**
     * Minimum MySQL version the generated SQL must support, encoded as
     * `major * 1000 + minor` (e.g. `8_000` for MySQL 8, `5_007` for MySQL 5.7).
     * Defaults to `Number.POSITIVE_INFINITY` (latest).
     *
     * Recognised breakpoints:
     * - `>= 8_000`: target MySQL 8+. The `WITH` clause is used (recursive queries
     *   supported), and the row alias syntax
     *   `INSERT ... AS _new_ ON DUPLICATE KEY UPDATE col = _new_.col` is emitted
     *   instead of the legacy `values(col)` reference — the alias was added in
     *   MySQL 8.0.19 and `VALUES()` was deprecated in 8.0.20, so this only fails
     *   on the very first stable 8.0 patches (8.0.0–8.0.18, released Apr 2018 –
     *   Oct 2019). Set a value below `8_000` if you really need to target one
     *   of those.
     * - `< 8_000`: target MySQL 5. The `WITH` clause is not emitted (the inner
     *   query is inlined inside the `FROM` instead) and recursive queries throw
     *   at query-build time; the legacy `values(col)` reference is used inside
     *   `ON DUPLICATE KEY UPDATE`.
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
