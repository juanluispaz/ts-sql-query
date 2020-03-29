import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import { SqlServer } from "../databases/SqlServer"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class AbstractSqlServerConnection<DB extends SqlServer & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends SqlServerSqlBuilder> extends AbstractAdvancedConnection<DB & SqlServer, NAME, SQL_BUILDER> implements SqlServer {
    __SqlServer: 'SqlServer' = 'SqlServer'

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

}
