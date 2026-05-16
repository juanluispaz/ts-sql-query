import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { SqlServerSqlBuilder } from '../sqlBuilders/SqlServerSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'

export abstract class SqlServerConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'sqlServer', NAME>> {

    /**
     * Minimum SQL Server version the generated SQL must support, encoded as
     * `major * 1000 + minor` (e.g. `16_000` for SQL Server 2022, whose internal
     * version is 16.0). Defaults to `Number.POSITIVE_INFINITY` (latest). No
     * dialect features depend on this setting today; reserved for forward
     * compatibility — set it to your real version so future ts-sql-query releases
     * that gate features on it pick the right behavior automatically.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable'): TransactionIsolationLevel {
        return [level] as any
    }
}
