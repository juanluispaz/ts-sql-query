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

    /**
     * The compatibility mode try to maximize the compatibility with older versions of MySQL (MySQL 5)
     *
     * The syntax avoided are:
     * - With clause, instead the query is directly included in the from
     * 
     * Note: Recursive queries are not supported
     */
    protected compatibilityMode: boolean = false

}
