import type { HasIsValue, IWithView } from '../utils/ITableOrView.js'
import type { AliasedTableOrView, AsAliasedForUseInLeftJoin, AsForUseInLeftJoin } from '../utils/tableOrViewUtils.js'
import type { SelectData, SqlBuilder, WithSelectData } from '../sqlBuilders/SqlBuilder.js'
import { createColumnsFrom, __asNodeValueSource } from '../typeSystem/valueSourceFactory.js'
import type { source, type } from '../utils/symbols.js'
import { __setColumnsForLeftJoin } from '../utils/leftJoinUtils.js'
import { TableOrViewRoot, __asTableOrViewRoot } from './TableOrViewRoot.js'
import { __inCreation } from '../utils/inCreation.js'

/** A `with` of a select (`forUseInQueryAs`): a TableOrViewRoot with the select it writes */
export class WithViewImpl extends TableOrViewRoot implements IWithView<any>, WithSelectData {
    /** For TypeScript only: its source and its kind */
    declare [source]: any
    declare [type]: 'with'

    readonly __sqlBuilder: SqlBuilder
    readonly __selectData: SelectData
    /** The `with` a copy (`as`, `forUseInLeftJoinAs`) was made from: the one the query writes */
    declare readonly __originalWith?: WithViewImpl | undefined
    /** The view of a recursive select used inside its own recursive member: it writes no `with` of its own */
    declare readonly __ignoreWith?: boolean | undefined
    declare readonly __recursive?: boolean | undefined

    constructor(sqlBuilder: SqlBuilder, name: string, selectData: SelectData) {
        super(name)
        this.__sqlBuilder = sqlBuilder
        this.__selectData = selectData
        if (selectData.__subSelectUsing) {
            __inCreation(this).__hasExternalDependencies = selectData.__subSelectUsing.length > 0
        }

        const columns = selectData.__columns
        createColumnsFrom(sqlBuilder, columns, this as any, this, true)
    }
    // Already defined in IWithView
    // [type]!: "with"
    // [tableOrViewRef]!: REF
    // [database]!: REF[typeof database]

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = __inCreation(new WithViewImpl(this.__sqlBuilder, this.__name, this.__selectData))
        if (this.__generatedName !== undefined) {
            result.__generatedName = this.__generatedName
        }
        result.__as = as
        result.__originalWith = this as any
        return result as any
    }
    forUseInLeftJoin(): AsForUseInLeftJoin<this> {
        return this.forUseInLeftJoinAs('') as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): AsAliasedForUseInLeftJoin<this, ALIAS> {
        const result = __inCreation(new WithViewImpl(this.__sqlBuilder, this.__name, this.__selectData))
        if (this.__generatedName !== undefined) {
            result.__generatedName = this.__generatedName
        }
        result.__as = as
        result.__forUseInLeftJoin = true
        result.__originalWith = this as any
        __setColumnsForLeftJoin(result as any)
        return result as any
    }
    override __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        if (this.__ignoreWith) {
            return
        }

        if (this.__originalWith) {
            this.__originalWith.__addWiths(sqlBuilder, withs)
        } else if (!withs.includes(this as any)) {
            const withViews = this.__selectData.__withs
            for (let i = 0, length = withViews.length; i < length; i++) {
                const withView = withViews[i]!
                __asTableOrViewRoot(withView).__addWiths(sqlBuilder, withs)
            }
            withs.push(this as any)
        }
        super.__addWiths(sqlBuilder, withs)
    }
    override __isAllowed(sqlBuilder: HasIsValue): boolean {
        // Mirror `__toSql` rendering: the WITH clause emits the CTE's
        // inner select via `_buildSelect(this.__selectData, ...)`, so
        // a gate inside the CTE body must propagate up. `SelectData`
        // does not declare `__isAllowed` on the interface, but the
        // runtime instance is always a PlainSelectQueryBuilder /
        // CompoundSelectQueryBuilder, which do.
        return (this.__selectData as unknown as { __isAllowed(sqlBuilder: HasIsValue): boolean }).__isAllowed(sqlBuilder)
    }
    override __hasAggregation(sqlBuilder: HasIsValue): boolean {
        // Mirror `__isAllowed`: an aggregate inside the CTE body propagates up.
        return (this.__selectData as unknown as { __hasAggregation(sqlBuilder: HasIsValue): boolean }).__hasAggregation(sqlBuilder)
    }
}
