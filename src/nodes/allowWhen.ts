import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, __keepAggregatedArrayShape, type InCreation } from './NodeStrategy.js'
import { type ValueSourceConstructor } from './dataTypeClassOf.js'

/** A value source guarded by `allowWhen` / `disallowWhen`: its SQL throws its error when it isn't allowed */
export interface AllowWhenValueSource extends NodeValueSource {
    readonly __valueSource: NodeValueSource
    readonly __allowed: boolean
    readonly __error: Error
}

export const allowWhenValueSourceNode: NodeStrategy<AllowWhenValueSource> = {
    ...valueSourceNode,
    // A value source that is not allowed throws its error when its SQL is written: every composite (a select used as a
    // value, a fragment, an aggregate, a with, the clauses of a query) writes its parts through their __toSql, so the
    // error reaches the query wherever the value source is. __isAllowed answers the same question without throwing; no
    // execution asks it, it exists for the introspection of a built query, and it must reach everything __toSql writes.
    __toSql(vs: AllowWhenValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!vs.__allowed) {
            throw vs.__error
        }
        return vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
    },
    __toSqlForCondition(vs: AllowWhenValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!vs.__allowed) {
            throw vs.__error
        }
        return vs.__valueSource.__toSqlForCondition(sqlBuilder, context, forceTypeCast)
    },
    __addWiths(vs: AllowWhenValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: AllowWhenValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: AllowWhenValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): boolean {
        if (!vs.__allowed) {
            return false
        }
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): boolean {
        // The `allowWhen`/`disallowWhen` gate is irrelevant to aggregation:
        // a disallowed expression still structurally contains its aggregate.
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newAllowWhenValueSource(allowed: boolean, error: Error, valueSource: NodeValueSource, typeClass: DataTypeClass): AllowWhenValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(valueSource.__optionalType) as InCreation<AllowWhenValueSource>
    vs.__node = allowWhenValueSourceNode
    // The result reads the shape of an aggregated array from the value source it finds in the columns: an aggregated
    // array guarded by `allowWhen` (a select of one aggregated column used as a value, then `allowWhen`) keeps it
    __keepAggregatedArrayShape(vs, valueSource)
    vs.__valueSource = valueSource
    vs.__error = error
    vs.__allowed = allowed
    return vs
}
