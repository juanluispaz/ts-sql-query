import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { ToSql, SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import { type } from '../utils/symbols.js'

export interface Default {
    [type]: 'default'
}

export class DefaultImpl implements Default, ToSql {
    [type]!: 'default'
    __toSql(SqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return SqlBuilder._default(context)
    }
    __toSqlForCondition(SqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return SqlBuilder._default(context)
    }
}

export function isDefault(value: any): value is Default {
    return value instanceof DefaultImpl
}
