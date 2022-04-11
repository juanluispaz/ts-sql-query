import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { PostgreSql, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"

export interface DB<NAME extends string> extends TypeSafeDB, PostgreSql {
    [databaseName]: NAME
}

export abstract class TypeSafePostgreSqlConnection<NAME extends string> extends AbstractPostgreSqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
