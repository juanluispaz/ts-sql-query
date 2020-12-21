import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { SqlServer, TypeSafeDB } from "../databases"
import { typeSafeDBType } from "../utils/symbols"

export abstract class TypeSafeSqlServerConnection<DB extends SqlServer & TypeSafeDB, NAME> extends AbstractSqlServerConnection<DB, NAME, SqlServerSqlBuilder> implements SqlServer, TypeSafeDB {
    [typeSafeDBType] : 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
