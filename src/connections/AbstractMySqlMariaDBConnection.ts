import type { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { AnyDB } from "../databases"
import { AbstractConnection } from "./AbstractConnection"

export abstract class AbstractMySqlMariaDBConnection<DB extends AnyDB> extends AbstractConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        super(queryRunner, sqlBuilder)
    }

}
