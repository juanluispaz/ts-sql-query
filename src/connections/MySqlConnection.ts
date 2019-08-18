import { MySql } from "../databases/MySql"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class MySqlConnection<DB extends MySql & TypeUnsafeDB, NAME> extends AbstractMySqlConnection<DB, NAME, MySqlSqlBuilder> implements MySql, TypeUnsafeDB {
    __TypeUnsafe : 'TypeUnsafe' = 'TypeUnsafe'
    constructor(queryRunner: QueryRunner & {mySql: true}, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
