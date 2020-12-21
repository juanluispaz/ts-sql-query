import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { PostgreSql, TypeSafeDB } from "../databases"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import { typeSafeDBType } from "../utils/symbols"

export abstract class TypeSafePostgreSqlConnection<DB extends PostgreSql & TypeSafeDB, NAME> extends AbstractPostgreSqlConnection<DB, NAME, PostgreSqlSqlBuilder> implements PostgreSql, TypeSafeDB {
    [typeSafeDBType] : 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
