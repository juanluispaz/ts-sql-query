import type { QueryRunner } from "../queryRunners/QueryRunner"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import type { DB } from "../typeMarks/MariaDBDB"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"

export abstract class MariaDBConnection<NAME extends string> extends AbstractMySqlMariaDBConnection<DB<NAME>> {
 
    protected uuidStrategy: 'string' | 'uuid' = 'uuid'

    /**
     * MariaBD 10.5 added support to the returning clause when insert or delete.
     * If you set this flag to true, the insert returning last inserted id will
     * generate the returning clause instead of use the last inserted id provided
     * by the connector after the execution of the query.
     */
    protected alwaysUseReturningClauseWhenInsert: boolean = false

    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mariaDB')
    }
}
