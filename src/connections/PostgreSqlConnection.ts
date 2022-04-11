import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import type { DB } from "../typeMarks/PostgreSqlDB"

export abstract class PostgreSqlConnection<NAME extends string> extends AbstractPostgreSqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
