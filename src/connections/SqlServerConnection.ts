import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { SqlServer, TypeUnsafeDB } from "../databases"
import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import { typeUnsafeDBType } from "../utils/symbols"

export abstract class SqlServerConnection<DB extends SqlServer & TypeUnsafeDB, NAME> extends AbstractSqlServerConnection<DB, NAME, SqlServerSqlBuilder> implements SqlServer, TypeUnsafeDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
