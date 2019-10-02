import { ToSql, SqlBuilder } from "../sqlBuilders/SqlBuilder"

export abstract class Default  {
    // @ts-ignore
    protected ___default: 'default'
}

export class DefaultImpl extends Default implements ToSql {
    __toSql(SqlBuilder: SqlBuilder, params: any[]): string {
        return SqlBuilder._default(params)
    }
    constructor() {
        super()
    }
}