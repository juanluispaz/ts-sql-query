import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractMariaDBConnection } from "./AbstractMariaDBConnection"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import type { DB } from "../typeMarks/TypeSafeMariaDBDB"

export abstract class TypeSafeMariaDBConnection<NAME extends string> extends AbstractMariaDBConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
