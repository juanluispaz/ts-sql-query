import type { NConnection } from "../utils/sourceName"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import { MariaDBSqlBuilder } from "../sqlBuilders/MariaDBSqlBuilder"
import { AbstractConnection, TransactionIsolationLevel } from "./AbstractConnection"

export abstract class MariaDBConnection</*in|out*/ NAME extends string> extends AbstractConnection<NConnection<'mariaDB', NAME>> {
 
    protected uuidStrategy: 'string' | 'uuid' = 'uuid'

    /**
     * MariaBD 10.5 added support to the returning clause when insert or delete.
     * If you set this flag to true, the insert returning last inserted id will
     * generate the returning clause instead of use the last inserted id provided
     * by the connector after the execution of the query.
     */
    protected alwaysUseReturningClauseWhenInsert: boolean = false

    constructor(queryRunner: QueryRunner, sqlBuilder = new MariaDBSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mariaDB')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable' | 'read write' | 'read only', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel {
        if (level === 'read write' || level === 'read only') {
            return [undefined, accessMode] as any
        }
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
    }
}
