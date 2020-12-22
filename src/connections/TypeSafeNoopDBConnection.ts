import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { NoopDB, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"

interface DB<NAME extends string> extends TypeSafeDB, NoopDB {
    [databaseName]: NAME
}

export abstract class TypeSafeNoopDBConnection<NAME extends string> extends AbstractNoopDBConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
