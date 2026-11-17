import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, __asNodeValueSource, __keepAggregatedArrayShape, type InCreation } from './NodeStrategy.js'
import { __sameTypeClassOf, type ValueSourceConstructor } from './dataTypeClassOf.js'
import { __adaptedTypeClassOf } from './adaptedTypeClass.js'

export interface AllowWhenValueSource extends NodeValueSource {
    readonly __valueSource: NodeValueSource
    readonly __allowed: boolean
    readonly __error: Error
}

export const allowWhenValueSourceNode: NodeStrategy<AllowWhenValueSource> = {
    ...valueSourceNode,
    // `allowWhen` / `disallowWhen` runtime enforcement. This `__toSql`
    // is the active throw point today: the error fires during SQL
    // construction (`query()` / `executeXxx()`) and propagates through
    // every composite path because each composite (subquery-as-value
    // via `_inlineSelectAsValue`, fragment via `FragmentValueSource`,
    // aggregate via `AggregateSelectValueSource`, CTE via
    // `WithViewImpl` + `_buildSelect`, plain joins / where / having /
    // groupBy / orderBy) renders via its own `__toSql` that recurses
    // into ours. See `test/db/<dialect>/<v>/<connector>/select.allow-when.composition.test.ts`
    // for the path-by-path coverage and
    // `docs/queries/extreme-dynamic-queries.md` § Restrict access to
    // values for the public contract.
    //
    // The parallel `__isAllowed` web threaded through the query
    // builders, the nodes of the value sources, `Table`, `View`, `Values`,
    // `RawFragmentImpl`, `WithViewImpl` and the
    // `ITableOrView` dispatcher (~48 methods, grep `__isAllowed` in
    // `src/`) is the scaffolding for a planned **query introspection
    // API** — non-destructive walkers paralleling `__toSql` that let a
    // consumer (e.g. an HTTP layer auto-generating OpenAPI) ask the
    // built query "is every gate open?" without triggering the throw.
    // The intended public surface (something like `query.isAllowed()`
    // alongside a future `query.resultSchema()` for OpenAPI-style
    // emission) is not yet exposed; no `execute*` / `query()` /
    // `_build*` calls `__isAllowed` today. The recursion is
    // structurally complete and **must be kept in sync with `__toSql`
    // when new value-source / table-or-view / query-builder shapes
    // are added** so that the feature lands working when the public
    // surface is wired up.
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
