import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MySql, TypeSafeDB } from "../databases"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { typeSafeDBType } from "../utils/symbols"

export abstract class TypeSafeMySqlConnection<DB extends MySql & TypeSafeDB, NAME> extends AbstractMySqlConnection<DB, NAME, MySqlSqlBuilder> implements MySql, TypeSafeDB {
    [typeSafeDBType] : 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
