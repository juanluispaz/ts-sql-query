import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import type { DB } from "../typeMarks/SqlServerDB"

export abstract class SqlServerConnection<NAME extends string> extends AbstractSqlServerConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
