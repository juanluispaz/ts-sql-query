import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MariaDB, TypeUnsafeDB } from "../databases"
import { AbstractMariaDBConnection } from "./AbstractMariaDBConnection"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import { typeUnsafeDBType } from "../utils/symbols"

export abstract class MariaDBConnection<DB extends MariaDB & TypeUnsafeDB, NAME> extends AbstractMariaDBConnection<DB, NAME, MariaDBSqlBuilder> implements MariaDB, TypeUnsafeDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
