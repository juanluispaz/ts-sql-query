import type { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { AnyDB } from "../databases"
import { AbstractConnection } from "./AbstractConnection"

export abstract class AbstractMySqlMariaDBConnection<DB extends AnyDB, NAME, SQL_BUILDER extends SqlBuilder> extends AbstractConnection<DB, NAME, SQL_BUILDER> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
    }

}
