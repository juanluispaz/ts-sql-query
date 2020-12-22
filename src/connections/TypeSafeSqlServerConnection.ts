import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { SqlServer, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"
import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"

interface DB<NAME extends string> extends TypeSafeDB, SqlServer {
    [databaseName]: NAME
}

export abstract class TypeSafeSqlServerConnection<NAME extends string> extends AbstractSqlServerConnection<DB<NAME>> {
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
