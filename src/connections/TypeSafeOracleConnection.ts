import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Oracle, TypeSafeDB } from "../databases"
import { AbstractOracleConnection } from "./AbstractOracleConnection"
import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import { typeSafeDBType } from "../utils/symbols"

export abstract class TypeSafeOracleConnection<DB extends Oracle & TypeSafeDB, NAME> extends AbstractOracleConnection<DB, NAME, OracleSqlBuilder> implements Oracle, TypeSafeDB {
    [typeSafeDBType] : 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
