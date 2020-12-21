import type { ToSql, SqlBuilder } from "../sqlBuilders/SqlBuilder"
import { type } from "../utils/symbols"

export interface Default {
    [type]: 'default'
}

export class DefaultImpl implements Default, ToSql {
    [type]: 'default'
    __toSql(SqlBuilder: SqlBuilder, params: any[]): string {
        return SqlBuilder._default(params)
    }
}
