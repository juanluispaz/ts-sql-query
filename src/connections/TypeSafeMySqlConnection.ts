import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import type { DB } from "../typeMarks/TypeSafeMySqlDB"

export abstract class TypeSafeMySqlConnection<NAME extends string> extends AbstractMySqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
