import { Sqlite } from "../databases/Sqlite"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class SqliteConnection<DB extends Sqlite & TypeUnsafeDB, NAME> extends AbstractSqliteConnection<DB, NAME, SqliteSqlBuilder> implements Sqlite, TypeUnsafeDB {
    __TypeUnsafe : 'TypeUnsafe' = 'TypeUnsafe'
    constructor(queryRunner: QueryRunner & {sqlite: true}, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
