import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import type { DB } from "../typeMarks/SqliteDB"

export abstract class SqliteConnection<NAME extends string> extends AbstractSqliteConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
