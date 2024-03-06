import type { QueryRunner } from "../queryRunners/QueryRunner"
import { OracleSqlBuilder } from "../sqlBuilders/OracleSqlBuilder"
import type { DB } from "../typeMarks/OracleDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { TransactionIsolationLevel } from "./AbstractConnection"

export abstract class OracleConnection<NAME extends string> extends AbstractAdvancedConnection<DB<NAME>> {

    protected uuidStrategy: 'string' | 'custom-functions' = 'custom-functions'

    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('oracle')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel {
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
    }

    protected transformValueToDB(value: unknown, type: string): unknown {
        if (type === 'boolean' && typeof value === 'boolean') {
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion
            return Number(value);
        }
        return super.transformValueToDB(value, type)
    }
}
