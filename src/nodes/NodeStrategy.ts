import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, ToSql } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { typeName } from '../utils/symbols.js'
import type { OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode, __ValueSourcePrivate } from '../typeSystem/valueSource.js'
import { __getValueSourcePrivate } from '../typeSystem/valueSource.js'

/**
 * A value source as a method of a data type class passes it (`this`) to the functions of the nodes (the creations, the
 * optionality and the type adapter of the operands, the class of the result, ...). TypeScript sees in a class only what
 * `BaseType` declares, so it requires the NType (`[typeName]`), which every data type class has and a plain object
 * doesn't; the function reads the fields of the run time with a single cast to `NodeValueSource`
 */
export interface DataTypeValueSource {
    readonly [typeName]: string
}

/**
 * A value source as its node sees it: the fields every value source has (`__ValueSourcePrivate`), how it is written,
 * and its node. ValueSourceRoot, the root of the classes of the data types at run time, is one
 */
export interface NodeValueSource extends __ValueSourcePrivate, ToSql {
    __node: NodeStrategy<any>
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
