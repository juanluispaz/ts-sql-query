import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { MySql, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractMySqlConnection } from "./AbstractMySqlConnection"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"

interface DB<NAME extends string> extends TypeSafeDB, MySql {
    [databaseName]: NAME
}

export abstract class TypeSafeMySqlConnection<NAME extends string> extends AbstractMySqlConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
