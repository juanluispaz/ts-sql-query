import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import type { DB } from "../typeMarks/TypeSafeSqlServerDB"

/**
 * @deprecated Use custom types instead
 */
export abstract class TypeSafeSqlServerConnection<NAME extends string> extends AbstractSqlServerConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
