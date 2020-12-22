import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MySql, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"

interface DB<NAME extends string> extends TypeUnsafeDB, MySql {
    [databaseName]: NAME
}

export abstract class MySqlConnection<NAME extends string> extends AbstractMySqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
