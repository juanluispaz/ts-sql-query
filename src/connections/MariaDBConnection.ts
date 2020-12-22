import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MariaDB, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractMariaDBConnection } from "./AbstractMariaDBConnection"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"

interface DB<NAME extends string> extends TypeUnsafeDB, MariaDB {
    [databaseName]: NAME
}

export abstract class MariaDBConnection<NAME extends string> extends AbstractMariaDBConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
