import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { NoopDB, TypeUnsafeDB } from "../databases"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"
import { typeUnsafeDBType } from "../utils/symbols"

export abstract class NoopDBConnection<DB extends NoopDB & TypeUnsafeDB, NAME> extends AbstractNoopDBConnection<DB, NAME, NoopDBSqlBuilder> implements NoopDB, TypeUnsafeDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
