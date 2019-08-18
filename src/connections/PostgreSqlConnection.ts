import { PostgreSql } from "../databases/PostgreSql"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class PostgreSqlConnection<DB extends PostgreSql & TypeUnsafeDB, NAME> extends AbstractPostgreSqlConnection<DB, NAME, PostgreSqlSqlBuilder> implements PostgreSql, TypeUnsafeDB {
    __TypeUnsafe : 'TypeUnsafe' = 'TypeUnsafe'
    constructor(queryRunner: QueryRunner & {postgreSql: true}, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
