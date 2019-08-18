import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import { Oracle } from "../databases/Oracle"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class AbstractOracleConnection<DB extends Oracle & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends OracleSqlBuilder> extends AbstractAdvancedConnection<DB & Oracle, NAME, SQL_BUILDER> implements Oracle {
    __Oracle: 'Oracle' = 'Oracle'

    constructor(queryRunner: QueryRunner & {oracle: true}, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
    }

}
