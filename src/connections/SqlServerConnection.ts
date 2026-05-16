import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { SqlServerSqlBuilder } from '../sqlBuilders/SqlServerSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'

export abstract class SqlServerConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'sqlServer', NAME>> {

    /**
     * Minimum SQL Server version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `16_000_000` for SQL
     * Server 2022, whose internal version is 16.0). Defaults to
     * `Number.POSITIVE_INFINITY` (latest). When this value is at least
     * `17_000_000` (SQL Server 2025), `aggregateAsArray` and
     * `aggregateAsArrayOfOneColumn` emit the native `json_arrayagg` /
     * `json_object` aggregates; older versions fall back to a `string_agg`-
     * based emulation. The `Distinct` variants always use the emulation
     * because `json_arrayagg` does not accept `DISTINCT`.
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
