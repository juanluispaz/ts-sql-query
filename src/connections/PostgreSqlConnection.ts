import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { PostgreSqlSqlBuilder } from '../sqlBuilders/PostgreSqlSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'

export abstract class PostgreSqlConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'postgreSql', NAME>> {

    /**
     * Minimum PostgreSQL version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `18_000_000` for
     * PostgreSQL 18). Defaults to `Number.POSITIVE_INFINITY` (latest). No
     * dialect features depend on this setting today; reserved for forward
     * compatibility — set it to your real version so future ts-sql-query
     * releases that gate features on it pick the right behavior automatically.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
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

    protected override transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown): string {
        if (!forceTypeCast) {
            return super.transformPlaceholder(placeholder, type, forceTypeCast, valueSentToDB)
        }

        switch (type) {
            case 'boolean':
                return placeholder + '::bool'
            case 'int':
                return placeholder + '::int4'
            case 'bigint':
                return placeholder + '::int8'
            case 'stringInt':
                return placeholder + '::int8'
            case 'double':
                return placeholder + '::float8'
            case 'stringDouble':
                return placeholder + '::float8'
            case 'string':
                return placeholder + '::text'
            case 'uuid':
                return placeholder + '::uuid'
            case 'localDate':
                return placeholder + '::date'
            case 'localTime':
                return placeholder + '::timestamp::time'
            case 'localDateTime':
                return placeholder + '::timestamp'
        }

        if (typeof valueSentToDB === 'bigint') {
            return placeholder + '::int8'
        }
        if (typeof valueSentToDB === 'number') {
            if (Number.isInteger(valueSentToDB)) {
                if (valueSentToDB >= -2147483648 && valueSentToDB <= 2147483647) {
                    // Int32 number
                    return placeholder + '::int4'
                } else {
                    return placeholder + '::int8'
                }
            } else {
                return placeholder + '::float8'
            }
        }

        return placeholder
    }
}
