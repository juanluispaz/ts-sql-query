import { Oracle } from "../databases/Oracle"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractOracleConnection } from "./AbstractOracleConnection"
import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class OracleConnection<DB extends Oracle & TypeUnsafeDB, NAME> extends AbstractOracleConnection<DB, NAME, OracleSqlBuilder> implements Oracle, TypeUnsafeDB {
    __TypeUnsafe : 'TypeUnsafe' = 'TypeUnsafe'
    constructor(queryRunner: QueryRunner & {oracle: true}, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
