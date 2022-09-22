import { HasIsValue, ITableOrView, IWithView, __addWiths, __getTableOrViewPrivate, __ITableOrViewPrivate, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import type { AliasedTableOrView, OuterJoinSourceOf, WITH_VIEW } from "../utils/tableOrViewUtils"
import type { AnyDB } from "../databases"
import type { SelectData, SqlBuilder, WithData } from "../sqlBuilders/SqlBuilder"
import { createColumnsFrom } from "../internal/ColumnImpl"
import { database, tableOrViewRef, type } from "../utils/symbols"
import { __getValueSourceOfObject, __getValueSourcePrivate } from "../expressions/values"
import { RawFragment } from "../utils/RawFragment"
import { Column } from "../utils/Column"

export class WithViewImpl<NAME extends string, REF extends WITH_VIEW<AnyDB, NAME>> implements IWithView<REF>, WithData, __ITableOrViewPrivate {
    [database]!: REF[typeof database]
    [type]!: 'with'
    [tableOrViewRef]!: REF
    __sqlBuilder: SqlBuilder

    /* implements __ITableOrViewPrivate as private members*/
    __name: string
    // @ts-ignore
    __as?: string
    // @ts-ignore
    __forUseInLeftJoin?: boolean
    // @ts-ignore
    __type: 'with' = 'with'
    __selectData: SelectData
    // @ts-ignore
    __originalWith?: WithViewImpl<any, any>
    __ignoreWith?: boolean
    __recursive?: boolean
    // @ts-ignore
    __template?: RawFragment<any>
    __hasExternalDependencies?: boolean

    constructor(sqlBuilder: SqlBuilder, name: string, selectData: SelectData) {
        this.__sqlBuilder = sqlBuilder
        this.__name = name
        this.__selectData = selectData
        if (selectData.__subSelectUsing) {
            this.__hasExternalDependencies = selectData.__subSelectUsing.length > 0
        }

        const columns = selectData.__columns
        createColumnsFrom(sqlBuilder, columns, this as any, this)
    }
    [type]!: "with"
    [tableOrViewRef]!: REF
    [database]!: REF[typeof database]

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = new WithViewImpl(this.__sqlBuilder, this.__name, this.__selectData)
        result.__as = as
        result.__originalWith = this as any
        return result as any
    }
    forUseInLeftJoin(): OuterJoinSourceOf<this, ''> {
        return this.forUseInLeftJoinAs('')
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): OuterJoinSourceOf<this, ALIAS> {
        const result = new WithViewImpl(this.__sqlBuilder, this.__name, this.__selectData)
        result.__as = as
        result.__forUseInLeftJoin = true
        result.__originalWith = this as any
        for (const prop in result) {
            const column = __getValueSourceOfObject(result, prop)
            if (column) {
                const columnPrivate = __getValueSourcePrivate(column)
                if (columnPrivate.__optionalType === 'required') {
                    columnPrivate.__optionalType = 'originallyRequired'
                }
            }
        }
        return result as any
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        if (this.__ignoreWith) {
            return
        }

        if (this.__originalWith) {
            this.__originalWith.__addWiths(sqlBuilder, withs)
        } else if (!withs.includes(this as any)) {
            const withViews = this.__selectData.__withs
            for (let i = 0, length = withViews.length; i < length; i++) {
                const withView = withViews[i]!
                __getTableOrViewPrivate(withView).__addWiths(sqlBuilder, withs)
            }
            withs.push(this as any)
        }
        __addWiths(this.__template, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        requiredTablesOrViews.add(this)
        __registerTableOrView(this.__template, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__template, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }
}
