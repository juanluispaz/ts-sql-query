import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Sqlite, TypeSafeDB } from "../databases"
import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import { typeSafeDBType } from "../utils/symbols"

export abstract class TypeSafeSqliteConnection<DB extends Sqlite & TypeSafeDB, NAME> extends AbstractSqliteConnection<DB, NAME, SqliteSqlBuilder> implements Sqlite, TypeSafeDB {
    [typeSafeDBType] : 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
