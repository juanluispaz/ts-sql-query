import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { NoopDB, TypeSafeDB } from "../databases"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"
import { typeSafeDBType } from "../utils/symbols"

export abstract class TypeSafeNoopDBConnection<DB extends NoopDB & TypeSafeDB, NAME> extends AbstractNoopDBConnection<DB, NAME, NoopDBSqlBuilder> implements NoopDB, TypeSafeDB {
    [typeSafeDBType] : 'TypeSafe'
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
