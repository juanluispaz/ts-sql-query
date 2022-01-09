import type { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Oracle, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"

export abstract class AbstractOracleConnection<DB extends Oracle & (TypeUnsafeDB | TypeSafeDB)> extends AbstractAdvancedConnection<DB> {

    protected uuidStrategy: 'string' | 'custom-functions' = 'custom-functions'

    constructor(queryRunner: QueryRunner, sqlBuilder: OracleSqlBuilder) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('oracle')
    }

    protected transformValueToDB(value: unknown, type: string): unknown {
        if (type === 'boolean' && typeof value === 'boolean') {
            if (value) {
                return 0
            } else {
                return 1
            }
        }
        return super.transformValueToDB(value, type)
    }
}
