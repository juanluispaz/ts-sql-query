import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, ToSql } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IQueryDataDiscovery, IWithView } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import type { AnyType, ILogicalValue } from '../typeSystem/base.js'

/**
 * A value source at run time: an instance of the class of its data type (or of ValueSourceRoot, for the name of a table
 * in a raw fragment) with its node, its optionality and the fields of its node. The public types describe a value
 * source by its data type, its source and its optionality, which exist only for TypeScript; `__asNodeValueSource` gives
 * the value source as it is at run time
 */
export interface NodeValueSource extends AnyValueSource, IQueryDataDiscovery, ToSql {
    /** How the value source is written and what it reaches */
    __node: NodeStrategy<any>
    __optionalType: OptionalType
    /** The type adapter of the class of the value source */
    readonly __typeAdapter: TypeAdapter | undefined
    /** Whether the value source is an aggregate: a function of aggregation, or a fragment declared as one */
    __isAggregate?: boolean | undefined
    __aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource | undefined
    __aggregatedArrayMode?: __AggregatedArrayMode | undefined
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean | undefined
    __aggregatedArrayDistinct?: boolean | undefined

    isConstValue(): boolean
    getConstValue(): any
}

/**
 * A value source as it is at run time, from the public types: a value source, a condition (which TypeScript doesn't take
 * for a value source) or `this` in a method of the class of a data type (which TypeScript sees as its data type)
 */
export function __asNodeValueSource(valueSource: AnyValueSource | ILogicalValue | AnyType): NodeValueSource {
    return valueSource as unknown as NodeValueSource
}

/** Whether the value is a value source: it has a node */
export function isValueSource(value: any): value is AnyValueSource {
    return typeof value === 'object' && value !== null && value.__node !== undefined
}

/**
 * How a value source is written and what it reaches in the tree, for one kind of node (a constant, a function of a
 * value source, a fragment, ...). One object for each kind, shared by its value sources, without state: it receives
 * the value source, which has the fields of its node
 */
export interface NodeStrategy<VS extends NodeValueSource> {
    __toSql(vs: VS, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string
    __toSqlForCondition(vs: VS, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string
    __addWiths(vs: VS, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void
    __registerTableOrView(vs: VS, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void
    __registerRequiredColumn(vs: VS, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void
    __getOldValues(vs: VS, sqlBuilder: HasIsValue): AnyTableOrView | undefined
    __getValuesForInsert(vs: VS, sqlBuilder: HasIsValue): AnyTableOrView | undefined
    __isAllowed(vs: VS, sqlBuilder: HasIsValue): boolean
    __hasAggregation(vs: VS, sqlBuilder: HasIsValue): boolean
    isConstValue(vs: VS): boolean
    getConstValue(vs: VS): any
    /** Only the neutral condition changes it: what `valueWhenNoValue` gives */
    valueWhenNoValue?(vs: VS, value: any): any
    /** Only a column and an aggregate as array change it: what `asRequiredInOptionalObject` gives */
    asRequiredInOptionalObject?(vs: VS): any
    /** Only an aggregate as array changes it: the same aggregate with another optionality (`useEmptyArrayForNoValue`, ...) */
    withOptionalType?(vs: VS, optionalType: OptionalType): any
    /** Only an aggregate as array changes it: what replaces it by null (`onlyWhenOrNull`, `ignoreWhenAsNull`) */
    asNull?(vs: VS): any
    /** Only an aggregate as array changes it: what `allowWhen` and `disallowWhen` give */
    allowWhen?(vs: VS, allowed: boolean, error: Error): any
    /** Only an aggregate as array changes it: what `projectingOptionalValuesAsNullable` gives */
    projectingOptionalValuesAsNullable?(vs: VS): any
}

/** What a node does when its strategy doesn't say otherwise: it reaches nothing */
export const valueSourceNode: Omit<NodeStrategy<NodeValueSource>, '__toSql'> = {
    __toSqlForCondition(vs, sqlBuilder, context, forceTypeCast) {
        return vs.__node.__toSql(vs, sqlBuilder, context, forceTypeCast)
    },
    __addWiths() {},
    __registerTableOrView() {},
    __registerRequiredColumn() {},
    __getOldValues() {
        return undefined
    },
    __getValuesForInsert() {
        return undefined
    },
    __isAllowed() {
        return true
    },
    __hasAggregation(vs) {
        return vs.__isAggregate ?? false
    },
    isConstValue() {
        return false
    },
    getConstValue() {
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    },
}
