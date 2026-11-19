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
    readonly __node: NodeStrategy<any>
    readonly __optionalType: OptionalType
    /** The type adapter of the class of the value source */
    readonly __typeAdapter: TypeAdapter | undefined
    /**
     * Only on a value source the user declared an aggregate (an aggregate fragment, the result of a function of
     * aggregate fragments): the aggregates of the library say it in their node (`__hasAggregation`)
     */
    readonly __isAggregate?: boolean | undefined
    /**
     * Only on an aggregated array (and on what keeps one: `allowWhen`, the column of a `with`, ...): the shape of its
     * elements, which the result reads
     */
    readonly __aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource | undefined
    readonly __aggregatedArrayMode?: __AggregatedArrayMode | undefined
    readonly __aggregatedProjectingOptionalValuesAsNullable?: boolean | undefined
    /** Only on an aggregate function that gives an array (`aggregateAsArray`, ...) */
    readonly __aggregatedArrayDistinct?: boolean | undefined

    isConstValue(): boolean
    getConstValue(): any
}

// A value source is written only while it is created (see src/utils/inCreation.ts)
export { type InCreation, __inCreation } from '../utils/inCreation.js'
import type { InCreation } from '../utils/inCreation.js'

/**
 * A value source as it is at run time, from the public types: a value source, a condition (which TypeScript doesn't take
 * for a value source) or `this` in a method of the class of a data type (which TypeScript sees as its data type)
 */
export function __asNodeValueSource(valueSource: AnyValueSource | ILogicalValue | AnyType): NodeValueSource {
    return valueSource as unknown as NodeValueSource
}

/**
 * A value source equal to the one given: its class, its node and its fields. A value source is written only while it is
 * created; what must say something else of an existing one (another optionality, ...) changes its copy
 */
export function __copyOfValueSource<VS extends NodeValueSource>(valueSource: VS): InCreation<VS> {
    const copy = Object.create(Object.getPrototypeOf(valueSource))
    Object.assign(copy, valueSource)
    return copy
}

/** The value source keeps the shape of the elements of `source` when it is an aggregated array */
export function __keepAggregatedArrayShape(valueSource: InCreation<NodeValueSource>, source: NodeValueSource): void {
    if (source.__aggregatedArrayColumns) {
        valueSource.__aggregatedArrayColumns = source.__aggregatedArrayColumns
        valueSource.__aggregatedArrayMode = source.__aggregatedArrayMode
        valueSource.__aggregatedProjectingOptionalValuesAsNullable = source.__aggregatedProjectingOptionalValuesAsNullable
    }
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
    /** An aggregate as array and the name of a table in a raw fragment change it: what `allowWhen` and `disallowWhen` give */
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
        return vs.__isAggregate === true
    },
    isConstValue() {
        return false
    },
    getConstValue() {
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    },
}
