import type { MySql, TypeSafeDB, TypeUnsafeDB } from "../databases"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { mySqlType } from "../utils/symbols"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"

export abstract class AbstractMySqlConnection<DB extends MySql & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends MySqlSqlBuilder> extends AbstractMySqlMariaDBConnection<DB & MySql, NAME, SQL_BUILDER> implements MySql {
    [mySqlType]: 'MySql'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mySql')
    }

}
