import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractOracleConnection } from "./AbstractOracleConnection"
import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import type { DB } from "../typeMarks/TypeSafeOracleDB"

/**
 * @deprecated Use custom types instead
 */
export abstract class TypeSafeOracleConnection<NAME extends string> extends AbstractOracleConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
