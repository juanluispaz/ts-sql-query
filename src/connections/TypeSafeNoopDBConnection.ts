import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"
import type { DB } from "../typeMarks/TypeSafeNoopDBDB"

/**
 * @deprecated Use custom types instead
 */
export abstract class TypeSafeNoopDBConnection<NAME extends string> extends AbstractNoopDBConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
