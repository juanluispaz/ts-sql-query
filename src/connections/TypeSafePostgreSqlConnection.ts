import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import type { DB } from "../typeMarks/TypeSafePostgreSqlDB"

export abstract class TypeSafePostgreSqlConnection<NAME extends string> extends AbstractPostgreSqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
