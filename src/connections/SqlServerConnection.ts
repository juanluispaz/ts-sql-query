import type { QueryRunner } from "../queryRunners/QueryRunner"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import type { DB } from "../typeMarks/SqlServerDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"

export abstract class SqlServerConnection<NAME extends string> extends AbstractAdvancedConnection<DB<NAME>> {

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }
}
