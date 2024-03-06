import type { QueryRunner } from "../queryRunners/QueryRunner"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import type { DB } from "../typeMarks/SqlServerDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import type { TransactionIsolationLevel } from "./AbstractConnection"

export abstract class SqlServerConnection<NAME extends string> extends AbstractAdvancedConnection<DB<NAME>> {

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable'): TransactionIsolationLevel {
        return [level] as any
    }
}
