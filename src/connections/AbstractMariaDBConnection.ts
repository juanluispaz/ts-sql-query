import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import type { MariaDB, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"
import { mariaDBType } from "../utils/symbols"

export abstract class AbstractMariaDBConnection<DB extends MariaDB & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends MariaDBSqlBuilder> extends AbstractMySqlMariaDBConnection<DB & MariaDB, NAME, SQL_BUILDER> implements MariaDB {
    [mariaDBType]: 'MariaDB'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mariaDB')
    }

}
