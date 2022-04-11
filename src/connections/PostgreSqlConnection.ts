import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { PostgreSql, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"

export interface DB<NAME extends string> extends TypeUnsafeDB, PostgreSql {
    [databaseName]: NAME
}

export abstract class PostgreSqlConnection<NAME extends string> extends AbstractPostgreSqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
