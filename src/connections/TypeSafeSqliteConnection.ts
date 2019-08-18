import { Sqlite } from "../databases/Sqlite"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { AbstractSqliteConnection } from "./AbstractSqliteConnection"
import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class TypeSafeSqliteConnection<DB extends Sqlite & TypeSafeDB, NAME> extends AbstractSqliteConnection<DB, NAME, SqliteSqlBuilder> implements Sqlite, TypeSafeDB {
    __TypeSafe : 'TypeSafe' = 'TypeSafe'
    constructor(queryRunner: QueryRunner & {sqlite: true}, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
