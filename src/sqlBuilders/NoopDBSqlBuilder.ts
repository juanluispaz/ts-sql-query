import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'
import type { CustomType } from '../TypeAdapter.js'

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    override _appendParam(value: any, context: SqlBuildContext, type: string, customType: CustomType | undefined, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return super._appendParam(value, context, type, customType, typeAdapter, forceTypeCast) + ':' + type
    }
}
