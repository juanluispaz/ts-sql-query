import { NoopDB } from "../databases/NoopDB"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"

export abstract class TypeSafeNoopDBConnection<DB extends NoopDB & TypeSafeDB, NAME> extends AbstractNoopDBConnection<DB, NAME, NoopDBSqlBuilder> implements NoopDB, TypeSafeDB {
    __TypeSafe : 'TypeSafe' = 'TypeSafe'
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
