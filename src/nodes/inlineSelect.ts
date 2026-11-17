import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, HasOperation, SelectData } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, IQueryDataDiscovery, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { isSelectQueryObject } from '../utils/symbols.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, __asNodeValueSource, isValueSource, __keepAggregatedArrayShape } from './NodeStrategy.js'
import { type ValueSourceConstructor } from './dataTypeClassOf.js'

export type InlineSelectData = SelectData & IQueryDataDiscovery

export interface InlineSelectValueSource extends NodeValueSource, HasOperation {
    __operation: '_inlineSelectAsValue'
    __selectData: InlineSelectData
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
    const vs = new (typeClass as unknown as ValueSourceConstructor)(required ? 'required' : 'optional') as InlineSelectValueSource
    vs.__node = inlineSelectValueSourceNode
    // A select of one column used as a value is that column: an aggregated array keeps its shape
    __keepAggregatedArrayShape(vs, resultColumnOfInlineSelect(selectData))
    vs.__operation = '_inlineSelectAsValue'

    vs.__selectData = selectData
    return vs
}

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
        const withViewPrivate = __getTableOrViewPrivate(withView)
        if (withViewPrivate.__hasExternalDependencies) {
            continue
        }
        withViewPrivate.__addWiths(sqlBuilder, withs)
    }
}

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
