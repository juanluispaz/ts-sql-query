import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { NoopDB, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"

export interface DB<NAME extends string> extends TypeUnsafeDB, NoopDB {
    [databaseName]: NAME
}

export abstract class NoopDBConnection<NAME extends string> extends AbstractNoopDBConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
