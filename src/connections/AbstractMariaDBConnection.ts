import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { MariaDB } from "../databases/MariaDB"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import { AbstractMySqlMariaDBConnection } from "./AbstractMySqlMariaDBConnection"

export abstract class AbstractMariaDBConnection<DB extends MariaDB & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends MariaDBSqlBuilder> extends AbstractMySqlMariaDBConnection<DB & MariaDB, NAME, SQL_BUILDER> implements MariaDB {
    __MariaDB: 'MariaDB' = 'MariaDB'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mariaDB')
    }

}
