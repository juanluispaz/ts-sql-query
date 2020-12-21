import type { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Sqlite, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractConnection } from "./AbstractConnection"
import { sqliteType } from "../utils/symbols"

export abstract class AbstractSqliteConnection<DB extends Sqlite & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends SqliteSqlBuilder> extends AbstractConnection<DB & Sqlite, NAME, SQL_BUILDER> implements Sqlite {
    [sqliteType]: 'Sqlite'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlite')
    }

}
