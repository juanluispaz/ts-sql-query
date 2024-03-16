import type { NConnection } from "../utils/sourceName"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import { MySqlSqlBuilder } from "../sqlBuilders/MySqlSqlBuilder"
import { AbstractConnection, TransactionIsolationLevel } from "./AbstractConnection"

export abstract class MySqlConnection</*in|out*/ NAME extends string> extends AbstractConnection<NConnection<'mySql', NAME>> {

    protected uuidStrategy: 'string' | 'binary' = 'binary'

    /**
     * The compatibility mode try to maximize the compatibility with older versions of MySQL (MySQL 5)
     *
     * The syntax avoided are:
     * - With clause, instead the query is directly included in the from
     * 
     * Note: Recursive queries are not supported
     */
    protected compatibilityMode: boolean = false

    constructor(queryRunner: QueryRunner, sqlBuilder: MySqlSqlBuilder = new MySqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('mySql')
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
