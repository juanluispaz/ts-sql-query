import type { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { PostgreSql, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { postgreSqlType } from "../utils/symbols"

export abstract class AbstractPostgreSqlConnection<DB extends PostgreSql & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends PostgreSqlSqlBuilder> extends AbstractAdvancedConnection<DB & PostgreSql, NAME, SQL_BUILDER> implements PostgreSql {
    [postgreSqlType]: 'PostgreSql'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
    }

}
