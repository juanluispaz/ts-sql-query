import type { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { SqlServer, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { sqlServerType } from "../utils/symbols"

export abstract class AbstractSqlServerConnection<DB extends SqlServer & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends SqlServerSqlBuilder> extends AbstractAdvancedConnection<DB & SqlServer, NAME, SQL_BUILDER> implements SqlServer {
    [sqlServerType]: 'SqlServer'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

}
