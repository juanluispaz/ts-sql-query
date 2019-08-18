import { MySql } from "../databases/MySql"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class TypeSafeMySqlConnection<DB extends MySql & TypeSafeDB, NAME> extends AbstractMySqlConnection<DB, NAME, MySqlSqlBuilder> implements MySql, TypeSafeDB {
    __TypeSafe : 'TypeSafe' = 'TypeSafe'
    constructor(queryRunner: QueryRunner & {mySql: true}, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
