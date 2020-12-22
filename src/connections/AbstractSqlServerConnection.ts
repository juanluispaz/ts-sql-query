import type { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { SqlServer, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"

export abstract class AbstractSqlServerConnection<DB extends SqlServer & (TypeUnsafeDB | TypeSafeDB)> extends AbstractAdvancedConnection<DB & SqlServer> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlServerSqlBuilder) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

}
