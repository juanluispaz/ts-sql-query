import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MySql, TypeUnsafeDB } from "../databases"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { typeUnsafeDBType } from "../utils/symbols"

export abstract class MySqlConnection<DB extends MySql & TypeUnsafeDB, NAME> extends AbstractMySqlConnection<DB, NAME, MySqlSqlBuilder> implements MySql, TypeUnsafeDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
