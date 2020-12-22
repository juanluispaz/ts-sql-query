import type { SqliteSqlBuilder } from "../sqlBuilders/SqliteSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Sqlite, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractConnection } from "./AbstractConnection"

export abstract class AbstractSqliteConnection<DB extends Sqlite & (TypeUnsafeDB | TypeSafeDB)> extends AbstractConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SqliteSqlBuilder) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlite')
    }

}
