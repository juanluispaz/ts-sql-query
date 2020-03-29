import { Oracle } from "../databases/Oracle"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { AbstractOracleConnection } from "./AbstractOracleConnection"
import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class TypeSafeOracleConnection<DB extends Oracle & TypeSafeDB, NAME> extends AbstractOracleConnection<DB, NAME, OracleSqlBuilder> implements Oracle, TypeSafeDB {
    __TypeSafe : 'TypeSafe' = 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
