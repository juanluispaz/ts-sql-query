import { MariaDB } from "../databases/MariaDB"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractMariaDBConnection } from "./AbstractMariaDBConnection"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class MariaDBConnection<DB extends MariaDB & TypeUnsafeDB, NAME> extends AbstractMariaDBConnection<DB, NAME, MariaDBSqlBuilder> implements MariaDB, TypeUnsafeDB {
    __TypeUnsafe : 'TypeUnsafe' = 'TypeUnsafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
