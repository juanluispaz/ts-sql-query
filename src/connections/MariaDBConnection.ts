import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { MariaDBSqlBuilder } from '../sqlBuilders/MariaDBSqlBuilder.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import { AbstractConnection } from './AbstractConnection.js'

export abstract class MariaDBConnection</*in|out*/ NAME extends string> extends AbstractConnection<NConnection<'mariaDB', NAME>> {
 
    protected uuidStrategy: 'string' | 'uuid' = 'uuid'

    /**
     * Minimum MariaDB version the generated SQL must support, encoded as
     * `major * 1000 + minor` (e.g. `10_005` for MariaDB 10.5, `10_004` for
     * MariaDB 10.4). Defaults to `Number.POSITIVE_INFINITY` (latest).
     *
     * Recognised breakpoints:
     * - `>= 10_005`: the `RETURNING` clause (supported on `INSERT` and `DELETE`
     *   since MariaDB 10.5) is emitted on `INSERT` to retrieve the last inserted
     *   id directly from the statement. Below this breakpoint, the last inserted
     *   id reported by the underlying connector after the query execution is
     *   used instead.
     * - `>= 10_003`: the `VALUE(col)` function (added in MariaDB 10.3 as part
     *   of MDEV-12172, renaming `VALUES(col)` to avoid the clash with the
     *   standard Table Value Constructors syntax introduced in the same
     *   release) is emitted inside `ON DUPLICATE KEY UPDATE` to reference the
     *   values being inserted. Below this breakpoint the legacy `VALUES(col)`
     *   name is emitted instead.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mariaDB')
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
