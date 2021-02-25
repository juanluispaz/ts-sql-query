import type { IWithView } from "../utils/ITableOrView"
import type { AliasedTableOrView, OuterJoinSourceOf, WITH_VIEW } from "../utils/tableOrViewUtils"
import type { AnyDB } from "../databases"
import type { __OptionalRule } from "../expressions/values"
import type { SelectData, WithData } from "../sqlBuilders/SqlBuilder"
import { ColumnImpl } from "../internal/ColumnImpl"
import { database, tableOrViewRef, type } from "../utils/symbols"
import { ValueSourceImpl } from "./ValueSourceImpl"

export class WithViewImpl<NAME extends string, REF extends WITH_VIEW<AnyDB, NAME>> implements IWithView<REF>, WithData {
    [database]: REF[typeof database]
    [type]: 'with'
    [tableOrViewRef]: REF
    /* implements __ITableOrViewPrivate as private members*/
    __name: string
    // @ts-ignore
    __as?: string
    // @ts-ignore
    __type: 'with' = 'with'
    __selectData: SelectData
    __optionalRule: __OptionalRule
    // @ts-ignore
    __originalWith?: WithViewImpl<any, any>

    constructor(name: string, selectData: SelectData, optionalRule: __OptionalRule) {
        this.__name = name
        this.__selectData = selectData
        this.__optionalRule = optionalRule
        
        const thiz = this as any
        const columns = selectData.__columns
        for (const property in columns) {
            const column = columns[property]
            if (!(column instanceof ValueSourceImpl)) {
                continue
            }
            const withColumn = new ColumnImpl(this, property, column.__valueType, column.__typeAdapter)
            withColumn.__isOptional = column.__isResultOptional(optionalRule)
            thiz[property] = withColumn
        }
    }

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = new WithViewImpl(this.__name, this.__selectData, this.__optionalRule)
        result.__as = as
        result.__originalWith = this as any
        return result as any
    }
    forUseInLeftJoin(): OuterJoinSourceOf<this, ''> {
        return this as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): OuterJoinSourceOf<this, ALIAS> {
        return this.as(as) as any
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        if (this.__originalWith) {
            this.__originalWith.__addWiths(withs)
        } else if (!withs.includes(this as any)) {
            withs.push(this as any)
        }
    }
}
