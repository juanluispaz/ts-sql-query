import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { PostgreSql, TypeUnsafeDB } from "../databases"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import { typeUnsafeDBType } from "../utils/symbols"

export abstract class PostgreSqlConnection<DB extends PostgreSql & TypeUnsafeDB, NAME> extends AbstractPostgreSqlConnection<DB, NAME, PostgreSqlSqlBuilder> implements PostgreSql, TypeUnsafeDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
