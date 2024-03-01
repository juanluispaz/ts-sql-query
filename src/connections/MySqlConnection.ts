import type { QueryRunner } from "../queryRunners/QueryRunner"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import type { DB } from "../typeMarks/MySqlDB"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"

export abstract class MySqlConnection<NAME extends string> extends AbstractMySqlMariaDBConnection<DB<NAME>> {

    protected uuidStrategy: 'string' | 'binary' = 'binary'

    /**
     * The compatibility mode try to maximize the compatibility with older versions of MySQL (MySQL 5)
     *
     * The syntax avoided are:
     * - With clause, instead the query is directly included in the from
     * 
     * Note: Recursive queries are not supported
     */
    protected compatibilityMode: boolean = false

    constructor(queryRunner: QueryRunner, sqlBuilder: MySqlSqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mySql')
    }
}
