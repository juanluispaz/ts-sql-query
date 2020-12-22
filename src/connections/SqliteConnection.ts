import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Sqlite, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"

interface DB<NAME extends string> extends TypeUnsafeDB, Sqlite {
    [databaseName]: NAME
}

export abstract class SqliteConnection<NAME extends string> extends AbstractSqliteConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
