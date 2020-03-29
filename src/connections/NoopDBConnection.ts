import { NoopDB } from "../databases/NoopDB"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"

export abstract class NoopDBConnection<DB extends NoopDB & TypeUnsafeDB, NAME> extends AbstractNoopDBConnection<DB, NAME, NoopDBSqlBuilder> implements NoopDB, TypeUnsafeDB {
    __TypeUnsafe : 'TypeUnsafe' = 'TypeUnsafe'
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
