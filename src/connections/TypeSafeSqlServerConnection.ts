import { SqlServer } from "../databases/SqlServer"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { AbstractSqlServerConnection } from "./AbstractSqlServerConnection"
import { SqlServerSqlBuilder } from "../sqlBuilders/SqlServerSqlBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"

export abstract class TypeSafeSqlServerConnection<DB extends SqlServer & TypeSafeDB, NAME> extends AbstractSqlServerConnection<DB, NAME, SqlServerSqlBuilder> implements SqlServer, TypeSafeDB {
    __TypeSafe : 'TypeSafe' = 'TypeSafe'
    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
    }
}
