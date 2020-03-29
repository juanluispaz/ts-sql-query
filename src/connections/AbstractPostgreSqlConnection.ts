import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import { PostgreSql } from "../databases/PostgreSql"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class AbstractPostgreSqlConnection<DB extends PostgreSql & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends PostgreSqlSqlBuilder> extends AbstractAdvancedConnection<DB & PostgreSql, NAME, SQL_BUILDER> implements PostgreSql {
    __PostgreSql: 'PostgreSql' = 'PostgreSql'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
    }

}
