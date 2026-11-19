import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, HasOperation, SelectData } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, IQueryDataDiscovery, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { isSelectQueryObject } from '../utils/symbols.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, __asNodeValueSource, isValueSource, __keepAggregatedArrayShape, type InCreation } from './NodeStrategy.js'
import { type ValueSourceConstructor } from './dataTypeClassOf.js'
import { __asTableOrViewRoot } from '../internal/TableOrViewRoot.js'

// The node of a select used as a value, and the withs it brings to the query that holds it.

/** What a select used as a value, or as the operand of an `in`, gives the node: the data of the select, which says its SQL and what it reaches */
export type InlineSelectData = SelectData & IQueryDataDiscovery

/** A select of one column used as a value */
export interface InlineSelectValueSource extends NodeValueSource, HasOperation {
    readonly __operation: '_inlineSelectAsValue'
    readonly __selectData: InlineSelectData
}

export const inlineSelectValueSourceNode: NodeStrategy<InlineSelectValueSource> = {
    ...valueSourceNode,
    __toSql(vs: InlineSelectValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._inlineSelectAsValue(vs.__selectData, context)
    },
    __toSqlForCondition(vs: InlineSelectValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._inlineSelectAsValueForCondition(vs.__selectData, context)
    },
    __addWiths(vs: InlineSelectValueSource, sqlBuilder: HasIsValue, withs: IWithView<any>[]): void {
        __addInlineQueryWiths(sqlBuilder, withs, vs.__selectData)
    },
    __registerTableOrView(vs: InlineSelectValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__selectData.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: InlineSelectValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__selectData.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__selectData.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__selectData.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__selectData.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__selectData.__hasAggregation(sqlBuilder)
    },
}

export function __newInlineSelectValueSource(selectData: InlineSelectData, required: boolean, typeClass: DataTypeClass): InlineSelectValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(required ? 'required' : 'optional') as InCreation<InlineSelectValueSource>
    vs.__node = inlineSelectValueSourceNode
    // A select of one column used as a value is that column: an aggregated array keeps its shape
    __keepAggregatedArrayShape(vs, resultColumnOfInlineSelect(selectData))
    vs.__operation = '_inlineSelectAsValue'

    vs.__selectData = selectData
    return vs
}

/**
 * The withs a select used as a value brings to the query that holds it: the ones it uses, except the ones it takes from
 * the outer query (subSelectUsing), the ones already there, and the ones that depend on the outer query
 * (__hasExternalDependencies), which stay inside the select
 */
export function __addInlineQueryWiths(sqlBuilder: HasIsValue, withs: IWithView<any>[], selectData: InlineSelectData): void {
    const withViews: IWithView<any>[] = []
    const subSelectUsing = selectData.__subSelectUsing || []
    selectData.__addWiths(sqlBuilder, withViews)
    for (let i = 0, length = withViews.length; i < length; i++) {
        const withView = withViews[i]!
        if (subSelectUsing.includes(withView)) {
            continue
        }
        if (withs.includes(withView)) {
            continue
        }
        const withViewRoot = __asTableOrViewRoot(withView)
        if (withViewRoot.__hasExternalDependencies) {
            continue
        }
        withViewRoot.__addWiths(sqlBuilder, withs)
    }
}

/** Whether a value is a select (the data of one): the operand of an `in` can be one */
export function isSelectQuery(value: any): value is InlineSelectData {
    if (value === undefined || value === null) {
        return false
    }
    if (typeof value === 'object') {
        return !!value[isSelectQueryObject]
    }
    return false
}

function resultColumnOfInlineSelect(selectData: SelectData): NodeValueSource {
    if (selectData.__asInlineAggregatedArrayValue) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unexpected inline aggregated array vaule')
    } else if (selectData.__oneColumn) {
        const result = selectData.__columns['result']
        if (!isValueSource(result)) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid result column' }, 'Result column for a select one column not found')
        }
        return __asNodeValueSource(result)
    } else {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unexpected inline select')
    }
}
