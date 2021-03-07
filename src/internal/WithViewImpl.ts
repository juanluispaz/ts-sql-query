import type { IWithView } from "../utils/ITableOrView"
import type { AliasedTableOrView, OuterJoinSourceOf, WITH_VIEW } from "../utils/tableOrViewUtils"
import type { AnyDB } from "../databases"
import type { SelectData, WithData } from "../sqlBuilders/SqlBuilder"
import { ColumnImpl } from "../internal/ColumnImpl"
import { database, tableOrViewRef, type } from "../utils/symbols"
import { CustomBooleanTypeAdapter, DefaultTypeAdapter, TypeAdapter } from "../TypeAdapter"
import { __getValueSourcePrivate, __OptionalRule } from "../expressions/values"

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
            const column = columns[property]!
            const columnPrivate = __getValueSourcePrivate(column)
            let valueType = columnPrivate.__valueType
            let typeAdapter = columnPrivate.__typeAdapter
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                // Avoid treat the column as a custom boolean
                typeAdapter = new ProxyTypeAdapter(typeAdapter)
            }
            const withColumn = new ColumnImpl(this, property, valueType, typeAdapter)
            withColumn.__isOptional = columnPrivate.__isResultOptional(optionalRule)
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

export class ProxyTypeAdapter implements TypeAdapter {
    typeAdapter: TypeAdapter

    constructor(typeAdapter: TypeAdapter) {
        this.typeAdapter = typeAdapter
    }

    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueFromDB(value, type, next)
    }

    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueToDB(value, type, next)
    }
}
