import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MariaDB, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractMariaDBConnection } from "./AbstractMariaDBConnection"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"

interface DB<NAME extends string> extends TypeSafeDB, MariaDB {
    [databaseName]: NAME
}

export abstract class TypeSafeMariaDBConnection<NAME extends string> extends AbstractMariaDBConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
