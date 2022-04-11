import type { QueryRunner } from "../queryRunners/QueryRunner"
import { AbstractNoopDBConnection } from "./AbstractNoopDBConnection"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"
import type { DB } from "../typeMarks/NoopDBDB"

export abstract class NoopDBConnection<NAME extends string> extends AbstractNoopDBConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
