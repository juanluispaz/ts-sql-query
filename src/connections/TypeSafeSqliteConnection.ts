import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import type { DB } from "../typeMarks/TypeSafeSqliteDB"

/**
 * @deprecated Use custom types instead
 */
export abstract class TypeSafeSqliteConnection<NAME extends string> extends AbstractSqliteConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
