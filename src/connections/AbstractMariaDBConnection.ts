import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import type { MariaDB, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"

export abstract class AbstractMariaDBConnection<DB extends MariaDB & (TypeUnsafeDB | TypeSafeDB)> extends AbstractMySqlMariaDBConnection<DB> {
 
    protected uuidStrategy: 'string' | 'uuid' = 'uuid'

    constructor(queryRunner: QueryRunner, sqlBuilder: MariaDBSqlBuilder) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mariaDB')
    }

}
