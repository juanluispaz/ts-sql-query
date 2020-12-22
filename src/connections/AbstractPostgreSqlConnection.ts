import type { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { PostgreSql, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"

export abstract class AbstractPostgreSqlConnection<DB extends PostgreSql & (TypeUnsafeDB | TypeSafeDB)> extends AbstractAdvancedConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: PostgreSqlSqlBuilder) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
    }

}
