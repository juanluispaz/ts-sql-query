import type { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Oracle, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { oracleType } from "../utils/symbols"

export abstract class AbstractOracleConnection<DB extends Oracle & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends OracleSqlBuilder> extends AbstractAdvancedConnection<DB & Oracle, NAME, SQL_BUILDER> implements Oracle {
    [oracleType]: 'Oracle'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('oracle')
    }

}
