import type { DataTypeClass } from '../TypeAdapter.js'
import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    override _appendParam(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        return super._appendParam(value, context, typeClass, forceTypeCast) + ':' + typeClass.type
    }
}
