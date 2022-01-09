import type { MySql, TypeSafeDB, TypeUnsafeDB } from "../databases"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"

export abstract class AbstractMySqlConnection<DB extends MySql & (TypeUnsafeDB | TypeSafeDB)> extends AbstractMySqlMariaDBConnection<DB> {

    protected uuidStrategy: 'string' | 'binary' = 'binary'

    constructor(queryRunner: QueryRunner, sqlBuilder: MySqlSqlBuilder) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mySql')
    }

}
