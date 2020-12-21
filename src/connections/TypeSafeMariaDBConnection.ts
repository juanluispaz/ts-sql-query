import { AbstractMariaDBConnection } from "./AbstractMariaDBConnection"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { MariaDB, TypeSafeDB } from "../databases"
import { typeSafeDBType } from "../utils/symbols"

export abstract class TypeSafeMariaDBConnection<DB extends MariaDB & TypeSafeDB, NAME> extends AbstractMariaDBConnection<DB, NAME, MariaDBSqlBuilder> implements MariaDB, TypeSafeDB {
    [typeSafeDBType] : 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
