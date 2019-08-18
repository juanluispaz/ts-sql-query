import { SqlServer } from "../databases/SqlServer"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class SqlServerConnection<DB extends SqlServer & TypeUnsafeDB, NAME> extends AbstractSqlServerConnection<DB, NAME, SqlServerSqlBuilder> implements SqlServer, TypeUnsafeDB {
    __TypeUnsafe : 'TypeUnsafe' = 'TypeUnsafe'
    constructor(queryRunner: QueryRunner & {sqlServer: true}, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
