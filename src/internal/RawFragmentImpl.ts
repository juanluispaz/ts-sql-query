import { AnyValueSource, IExecutableSelectQuery } from "../expressions/values"
import { SqlBuilder, ToSql } from "../sqlBuilders/SqlBuilder"
import { Column } from "../utils/Column"
import { HasAddWiths, ITableOrView, IWithView, __addWiths, __getOldValues, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import { RawFragment } from "../utils/RawFragment"
import { database, rawFragment } from "../utils/symbols"

export class RawFragmentImpl implements RawFragment<any>, HasAddWiths, ToSql {
    [rawFragment]: "rawFragment"
    [database]: any
    
    __template: TemplateStringsArray
    __params: Array<AnyValueSource | IExecutableSelectQuery<any, any, any, any>>

    constructor(template: TemplateStringsArray, params: Array<AnyValueSource | IExecutableSelectQuery<any, any, any, any>>) {
        this.__template = template
        this.__params = params
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._rawFragment(params, this.__template, this.__params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }

    __addWiths(withs: Array<IWithView<any>>): void {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            __addWiths(params[i], withs)
        }
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            __registerTableOrView(params[i], requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            __registerRequiredColumn(params[i], requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(): ITableOrView<any> | undefined {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            const result = __getOldValues(params[i])
            if (result) {
                return result
            }
        }
        return undefined
    }
}