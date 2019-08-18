import { PostgreSql } from "../databases/PostgreSql"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { AbstractPostgreSqlConnection } from "./AbstractPostgreSqlConnection"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class TypeSafePostgreSqlConnection<DB extends PostgreSql & TypeSafeDB, NAME> extends AbstractPostgreSqlConnection<DB, NAME, PostgreSqlSqlBuilder> implements PostgreSql, TypeSafeDB {
    __TypeSafe : 'TypeSafe' = 'TypeSafe'
    constructor(queryRunner: QueryRunner & {postgreSql: true}, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
