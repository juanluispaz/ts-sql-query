import { MariaDB } from "../databases/MariaDB"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { AbstractMariaDBConnection } from "./AbstractMariaDBConnection"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class TypeSafeMariaDBConnection<DB extends MariaDB & TypeSafeDB, NAME> extends AbstractMariaDBConnection<DB, NAME, MariaDBSqlBuilder> implements MariaDB, TypeSafeDB {
    __TypeSafe : 'TypeSafe' = 'TypeSafe'
    constructor(queryRunner: QueryRunner & {mariaDB: true}, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
