import { AnyValueSource, IExecutableDeleteQuery, IExecutableInsertQuery, IExecutableSelectQuery, IExecutableUpdateQuery } from "../expressions/values"
import { SqlBuilder, ToSql } from "../sqlBuilders/SqlBuilder"
import { Column } from "../utils/Column"
import { AnyTableOrView, HasAddWiths, HasIsValue, IWithView, __addWiths, __getOldValues, __getValuesForInsert, __isAllowed, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import type { RawFragment } from "../utils/RawFragment"
import { source, type } from "../utils/symbols"

export class RawFragmentImpl implements RawFragment<any>, HasAddWiths, ToSql {
    [type]!: "rawFragment"
    [source]: any

    __template: TemplateStringsArray
    __params: Array<AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>>

    constructor(template: TemplateStringsArray, params: Array<AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>>) {
        this.__template = template
        this.__params = params
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._rawFragment(params, this.__template, this.__params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }

    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            __addWiths(params[i], sqlBuilder, withs)
        }
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            __registerTableOrView(params[i], sqlBuilder, requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            __registerRequiredColumn(params[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            const result = __getOldValues(params[i], sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            const result = __getValuesForInsert(params[i], sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        const params = this.__params
        for (let i = 0, length = params.length; i < length; i++) {
            const result = __isAllowed(params[i], sqlBuilder)
            if (!result) {
                return false
            }
        }
        return true
    }
}
