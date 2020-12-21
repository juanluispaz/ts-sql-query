import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Oracle, TypeUnsafeDB } from "../databases"
import { AbstractOracleConnection } from "./AbstractOracleConnection"
import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import { typeUnsafeDBType } from "../utils/symbols"

export abstract class OracleConnection<DB extends Oracle & TypeUnsafeDB, NAME> extends AbstractOracleConnection<DB, NAME, OracleSqlBuilder> implements Oracle, TypeUnsafeDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
