import { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import { Sqlite } from "../databases/Sqlite"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractConnection } from "./AbstractConnection"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class AbstractSqliteConnection<DB extends Sqlite & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends SqliteSqlBuilder> extends AbstractConnection<DB & Sqlite, NAME, SQL_BUILDER> implements Sqlite {
    __Sqlite: 'Sqlite' = 'Sqlite'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlite')
    }

}
