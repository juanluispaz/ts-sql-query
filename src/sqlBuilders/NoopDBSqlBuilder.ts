import type { TypeAdapter } from '../TypeAdapter.js'
import type { ValueType } from '../expressions/values.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    _appendParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ':' + columnTypeName
    }
}
