import type { QueryRunner } from "../queryRunners/QueryRunner"
import { PostgreSqlSqlBuilder } from "../sqlBuilders/PostgreSqlSqlBuilder"
import type { DB } from "../typeMarks/PostgreSqlDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"

export abstract class PostgreSqlConnection<NAME extends string> extends AbstractAdvancedConnection<DB<NAME>> {

    constructor(queryRunner: QueryRunner, sqlBuilder = new PostgreSqlSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('postgreSql')
    }

    protected transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown): string {
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
