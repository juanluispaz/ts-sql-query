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
     * - `>= 8_000`: the `WITH` clause is used; recursive queries are supported.
     * - `< 8_000`: the `WITH` clause is not emitted (the inner query is inlined
     *   inside the `FROM` instead) and recursive queries throw at query-build
     *   time.
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
