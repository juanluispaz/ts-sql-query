import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { SqlServer, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"

export interface DB<NAME extends string> extends TypeUnsafeDB, SqlServer {
    [databaseName]: NAME
}

export abstract class SqlServerConnection<NAME extends string> extends AbstractSqlServerConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
