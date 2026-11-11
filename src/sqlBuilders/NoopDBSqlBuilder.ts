import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { ValueType } from '../expressions/values.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    override _appendParam(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return super._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ':' + columnTypeName
    }
}
