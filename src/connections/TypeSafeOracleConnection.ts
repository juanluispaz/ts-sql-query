import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Oracle, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractOracleConnection } from "./AbstractOracleConnection"
import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"

interface DB<NAME extends string> extends TypeSafeDB, Oracle {
    [databaseName]: NAME
}

export abstract class TypeSafeOracleConnection<NAME extends string> extends AbstractOracleConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
