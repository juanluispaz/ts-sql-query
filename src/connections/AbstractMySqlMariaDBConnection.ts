import { AnyDB } from "../databases/AnyDB"
import { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import { AbstractConnection } from "./AbstractConnection"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class AbstractMySqlMariaDBConnection<DB extends AnyDB, NAME, SQL_BUILDER extends SqlBuilder> extends AbstractConnection<DB, NAME, SQL_BUILDER> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
    }

}
