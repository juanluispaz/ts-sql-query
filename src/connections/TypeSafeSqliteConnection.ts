import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Sqlite, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"

export interface DB<NAME extends string> extends TypeSafeDB, Sqlite {
    [databaseName]: NAME
}

export abstract class TypeSafeSqliteConnection<NAME extends string> extends AbstractSqliteConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
