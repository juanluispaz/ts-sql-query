import type { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Oracle, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"

export abstract class AbstractOracleConnection<DB extends Oracle & (TypeUnsafeDB | TypeSafeDB)> extends AbstractAdvancedConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: OracleSqlBuilder) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('oracle')
    }

}
