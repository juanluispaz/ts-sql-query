import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { Sqlite, TypeUnsafeDB } from "../databases"
import { typeUnsafeDBType } from "../utils/symbols"

export abstract class SqliteConnection<DB extends Sqlite & TypeUnsafeDB, NAME> extends AbstractSqliteConnection<DB, NAME, SqliteSqlBuilder> implements Sqlite, TypeUnsafeDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
