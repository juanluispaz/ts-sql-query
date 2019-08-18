import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { MySql } from "../databases/MySql"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"

export abstract class AbstractMySqlConnection<DB extends MySql & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends MySqlSqlBuilder> extends AbstractMySqlMariaDBConnection<DB & MySql, NAME, SQL_BUILDER> implements MySql {
    __MySql: 'MySql' = 'MySql'

    constructor(queryRunner: QueryRunner & {mySql: true}, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
    }

}
