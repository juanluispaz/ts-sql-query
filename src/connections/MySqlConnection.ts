import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import type { DB } from "../typeMarks/MySqlDB"

export abstract class MySqlConnection<NAME extends string> extends AbstractMySqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
