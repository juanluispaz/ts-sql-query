import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { SqlServerSqlBuilder } from '../sqlBuilders/SqlServerSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'

export abstract class SqlServerConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'sqlServer', NAME>> {

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable'): TransactionIsolationLevel {
        return [level] as any
    }
}
