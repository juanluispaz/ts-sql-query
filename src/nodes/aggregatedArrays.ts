import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, __asNodeValueSource, isValueSource } from './NodeStrategy.js'
import { __sameTypeClassOf, type ValueSourceConstructor } from './dataTypeClassOf.js'
import { __addInlineQueryWiths, type InlineSelectData } from './inlineSelect.js'
import { __adaptedTypeClassOf, __classOf } from './adaptedTypeClass.js'

/*
 * The aggregates as array, a select used as an aggregated array (`forUseAsInlineAggregatedArrayValue`) and the
 * aggregate functions of the database (`aggregateAsArray`, ...): each one, the same guarded by `allowWhen`, and the
 * null that replaces it (`onlyWhenOrNull`), with the same guarded. Their value sources are of their class
 * (AggregatedArrayType); the methods that change them are the hooks of their nodes.
 */

/** The fields every aggregate as array has */
export interface AggregatedArrayValueSource extends NodeValueSource {
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode
    /** Set by `allowWhen` / `disallowWhen` */
    __allowed?: boolean | undefined
    __error?: Error | undefined
}

/** A select used as an aggregated array */
export interface AggregateSelectValueSource extends AggregatedArrayValueSource {
    __operation: '_inlineSelectAsValue'
    __selectData: InlineSelectData
}

/** An aggregate function of the database that gives an array */
export interface AggregateValueAsArrayValueSource extends AggregatedArrayValueSource {
    __operation: '_aggregateValueAsArray'
    __aggregatedArrayDistinct: boolean
}

/** An aggregate function that gives an array, guarded by `allowWhen` / `disallowWhen` */
export interface AllowWhenAggregateValueAsArrayValueSource extends AggregateValueAsArrayValueSource {
    __allowed: boolean
    __error: Error
}

/**
 * The node of an aggregate as array guarded by `allowWhen`: the one of the aggregate, which throws its error when it is
 * not allowed. As for any other value, the gate stays when its optionality changes, and another `allowWhen` that
 * allows doesn't lift it; one that doesn't allow is checked first
 */
function allowWhenAggregateNode<VS extends AggregatedArrayValueSource>(node: NodeStrategy<VS>): NodeStrategy<VS> {
    return {
        ...node,
        withOptionalType(vs, optionalType) {
            return node.allowWhen!(node.withOptionalType!(vs, optionalType), vs.__allowed!, vs.__error!)
        },
        asRequiredInOptionalObject(vs) {
            return node.allowWhen!(node.asRequiredInOptionalObject!(vs), vs.__allowed!, vs.__error!)
        },
        allowWhen(vs, allowed, error) {
            return allowed ? node.allowWhen!(vs, vs.__allowed!, vs.__error!) : node.allowWhen!(vs, false, error)
        },
        __toSql(vs, sqlBuilder, context, forceTypeCast) {
            if (!vs.__allowed) {
                throw vs.__error
            }
            return node.__toSql(vs, sqlBuilder, context, forceTypeCast)
        },
        __isAllowed(vs, sqlBuilder) {
            if (!vs.__allowed) {
                return false
            }
            return node.__isAllowed(vs, sqlBuilder)
        },
    }
}

/** The null of an aggregate as array: it reaches nothing */
function nullAggregateToSql(vs: AggregatedArrayValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext): string {
    return sqlBuilder._asNullValue(context, __classOf(vs))
}

function newAggregateSelect(node: NodeStrategy<AggregateSelectValueSource>, typeClass: DataTypeClass, selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, optionalType: OptionalType, projectingOptionalValuesAsNullable: boolean | undefined, allowed?: boolean, error?: Error): AggregateSelectValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as AggregateSelectValueSource
    vs.__node = node
    vs.__operation = '_inlineSelectAsValue'
    vs.__selectData = selectData
    vs.__aggregatedArrayColumns = aggregatedArrayColumns
    vs.__aggregatedArrayMode = aggregatedArrayMode
    vs.__aggregatedProjectingOptionalValuesAsNullable = projectingOptionalValuesAsNullable
    if (error) {
        vs.__allowed = allowed
        vs.__error = error
    }
    return vs
}

/** A select used as an aggregated array */
const aggregateSelectNode: NodeStrategy<AggregateSelectValueSource> = {
    ...valueSourceNode,
    // An aggregate (its null, below, is not)
    __hasAggregation() {
        return true
    },
    __toSql(vs, sqlBuilder, context) {
        return sqlBuilder._inlineSelectAsValue(vs.__selectData, context)
    },
    __toSqlForCondition(vs, sqlBuilder, context) {
        return sqlBuilder._inlineSelectAsValueForCondition(vs.__selectData, context)
    },
    __addWiths(vs, sqlBuilder, withs) {
        __addInlineQueryWiths(sqlBuilder, withs, vs.__selectData)
    },
    __registerTableOrView(vs, sqlBuilder, requiredTablesOrViews) {
        vs.__selectData.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs, sqlBuilder, requiredColumns, onlyForTablesOrViews) {
        vs.__selectData.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs, sqlBuilder) {
        return vs.__selectData.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs, sqlBuilder) {
        return vs.__selectData.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs, sqlBuilder) {
        return vs.__selectData.__isAllowed(sqlBuilder)
    },
    withOptionalType(vs, optionalType) {
        return newAggregateSelect(aggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, optionalType, vs.__aggregatedProjectingOptionalValuesAsNullable)
    },
    asRequiredInOptionalObject(vs) {
        return newAggregateSelect(aggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'requiredInOptionalObject', vs.__aggregatedProjectingOptionalValuesAsNullable)
    },
    asNull(vs) {
        return newAggregateSelect(nullAggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'optional', undefined)
    },
    allowWhen(vs, allowed, error) {
        return newAggregateSelect(allowWhenAggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, vs.__optionalType, vs.__aggregatedProjectingOptionalValuesAsNullable, allowed, error)
    },
    projectingOptionalValuesAsNullable(vs) {
        vs.__aggregatedProjectingOptionalValuesAsNullable = true
        return vs
    },
}

const allowWhenAggregateSelectNode = allowWhenAggregateNode(aggregateSelectNode)

/** The null that replaces a select used as an aggregated array */
const nullAggregateSelectNode: NodeStrategy<AggregateSelectValueSource> = {
    ...valueSourceNode,
    __toSql: nullAggregateToSql,
    withOptionalType(vs, optionalType) {
        return newAggregateSelect(nullAggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, optionalType, undefined)
    },
    asRequiredInOptionalObject(vs) {
        return newAggregateSelect(nullAggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'requiredInOptionalObject', undefined)
    },
    asNull(vs) {
        return newAggregateSelect(nullAggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'optional', undefined)
    },
    allowWhen(vs, allowed, error) {
        return newAggregateSelect(nullAllowWhenAggregateSelectNode, __sameTypeClassOf(vs), vs.__selectData, vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, vs.__optionalType, undefined, allowed, error)
    },
    projectingOptionalValuesAsNullable(vs) {
        return vs
    },
}

const nullAllowWhenAggregateSelectNode = allowWhenAggregateNode(nullAggregateSelectNode)

/** A select used as an aggregated array, of the class of its data type */
export function __newAggregateSelectValueSource(typeClass: DataTypeClass, selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, optionalType: OptionalType): AggregateSelectValueSource {
    return newAggregateSelect(aggregateSelectNode, typeClass, selectData, aggregatedArrayColumns, aggregatedArrayMode, optionalType, undefined)
}

function newAggregateValueAsArray(node: NodeStrategy<AggregateValueAsArrayValueSource>, typeClass: DataTypeClass, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, optionalType: OptionalType, distinct: boolean, projectingOptionalValuesAsNullable: boolean | undefined, allowed?: boolean, error?: Error): AggregateValueAsArrayValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as AggregateValueAsArrayValueSource
    vs.__node = node
    vs.__operation = '_aggregateValueAsArray'
    vs.__aggregatedArrayColumns = aggregatedArrayColumns
    vs.__aggregatedArrayMode = aggregatedArrayMode
    vs.__aggregatedProjectingOptionalValuesAsNullable = projectingOptionalValuesAsNullable
    vs.__aggregatedArrayDistinct = distinct
    if (error) {
        vs.__allowed = allowed
        vs.__error = error
    }
    return vs
}

/** What the aggregated columns of an aggregate function reach, each of them */
function aggregatedColumnsAddWiths(sqlBuilder: HasIsValue, withs: IWithView<any>[], aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
    if (!aggregatedArrayColumns) {
        return
    } else if (isValueSource(aggregatedArrayColumns)) {
        __asNodeValueSource(aggregatedArrayColumns).__addWiths(sqlBuilder, withs)
    } else {
        for (let prop in aggregatedArrayColumns) {
            aggregatedColumnsAddWiths(sqlBuilder, withs, aggregatedArrayColumns[prop])
        }
    }
}

function aggregatedColumnsRegisterTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
    if (!aggregatedArrayColumns) {
        return
    } else if (isValueSource(aggregatedArrayColumns)) {
        __asNodeValueSource(aggregatedArrayColumns).__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    } else {
        for (let prop in aggregatedArrayColumns) {
            aggregatedColumnsRegisterTableOrView(sqlBuilder, requiredTablesOrViews, aggregatedArrayColumns[prop])
        }
    }
}

function aggregatedColumnsRegisterRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
    if (!aggregatedArrayColumns) {
        return
    } else if (isValueSource(aggregatedArrayColumns)) {
        __asNodeValueSource(aggregatedArrayColumns).__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    } else {
        for (let prop in aggregatedArrayColumns) {
            aggregatedColumnsRegisterRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews, aggregatedArrayColumns[prop])
        }
    }
}

function aggregatedColumnsGetOldValues(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): AnyTableOrView | undefined {
    if (!aggregatedArrayColumns) {
        return undefined
    } else if (isValueSource(aggregatedArrayColumns)) {
        return __asNodeValueSource(aggregatedArrayColumns).__getOldValues(sqlBuilder)
    } else {
        for (let prop in aggregatedArrayColumns) {
            const result = aggregatedColumnsGetOldValues(sqlBuilder, aggregatedArrayColumns[prop])
            if (result) {
                return result
            }
        }
        return undefined
    }
}

function aggregatedColumnsGetValuesForInsert(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): AnyTableOrView | undefined {
    if (!aggregatedArrayColumns) {
        return undefined
    } else if (isValueSource(aggregatedArrayColumns)) {
        return __asNodeValueSource(aggregatedArrayColumns).__getValuesForInsert(sqlBuilder)
    } else {
        for (let prop in aggregatedArrayColumns) {
            const result = aggregatedColumnsGetValuesForInsert(sqlBuilder, aggregatedArrayColumns[prop])
            if (result) {
                return result
            }
        }
        return undefined
    }
}

function aggregatedColumnsIsAllowed(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): boolean {
    if (!aggregatedArrayColumns) {
        return true
    } else if (isValueSource(aggregatedArrayColumns)) {
        return __asNodeValueSource(aggregatedArrayColumns).__isAllowed(sqlBuilder)
    } else {
        for (let prop in aggregatedArrayColumns) {
            if (!aggregatedColumnsIsAllowed(sqlBuilder, aggregatedArrayColumns[prop])) {
                return false
            }
        }
        return true
    }
}

/** An aggregate function of the database that gives an array */
const aggregateValueAsArrayNode: NodeStrategy<AggregateValueAsArrayValueSource> = {
    ...valueSourceNode,
    // An aggregate function (its null, below, is not)
    __hasAggregation() {
        return true
    },
    __toSql(vs, sqlBuilder, context) {
        // The SQL builder types it as the value source its users see
        return sqlBuilder._aggregateValueAsArray(vs as any, context)
    },
    __addWiths(vs, sqlBuilder, withs) {
        aggregatedColumnsAddWiths(sqlBuilder, withs, vs.__aggregatedArrayColumns)
    },
    __registerTableOrView(vs, sqlBuilder, requiredTablesOrViews) {
        aggregatedColumnsRegisterTableOrView(sqlBuilder, requiredTablesOrViews, vs.__aggregatedArrayColumns)
    },
    __registerRequiredColumn(vs, sqlBuilder, requiredColumns, onlyForTablesOrViews) {
        aggregatedColumnsRegisterRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews, vs.__aggregatedArrayColumns)
    },
    __getOldValues(vs, sqlBuilder) {
        return aggregatedColumnsGetOldValues(sqlBuilder, vs.__aggregatedArrayColumns)
    },
    __getValuesForInsert(vs, sqlBuilder) {
        return aggregatedColumnsGetValuesForInsert(sqlBuilder, vs.__aggregatedArrayColumns)
    },
    __isAllowed(vs, sqlBuilder) {
        return aggregatedColumnsIsAllowed(sqlBuilder, vs.__aggregatedArrayColumns)
    },
    withOptionalType(vs, optionalType) {
        return newAggregateValueAsArray(aggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, optionalType, vs.__aggregatedArrayDistinct, vs.__aggregatedProjectingOptionalValuesAsNullable)
    },
    asRequiredInOptionalObject(vs) {
        return newAggregateValueAsArray(aggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'requiredInOptionalObject', vs.__aggregatedArrayDistinct, vs.__aggregatedProjectingOptionalValuesAsNullable)
    },
    asNull(vs) {
        return newAggregateValueAsArray(nullAggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'optional', vs.__aggregatedArrayDistinct, undefined)
    },
    allowWhen(vs, allowed, error) {
        return newAggregateValueAsArray(allowWhenAggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, vs.__optionalType, vs.__aggregatedArrayDistinct, vs.__aggregatedProjectingOptionalValuesAsNullable, allowed, error)
    },
    projectingOptionalValuesAsNullable(vs) {
        vs.__aggregatedProjectingOptionalValuesAsNullable = true
        return vs
    },
}

const allowWhenAggregateValueAsArrayNode = allowWhenAggregateNode(aggregateValueAsArrayNode)

/** The null that replaces an aggregate function that gives an array */
const nullAggregateValueAsArrayNode: NodeStrategy<AggregateValueAsArrayValueSource> = {
    ...valueSourceNode,
    __toSql: nullAggregateToSql,
    withOptionalType(vs, optionalType) {
        return newAggregateValueAsArray(nullAggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, optionalType, vs.__aggregatedArrayDistinct, undefined)
    },
    asRequiredInOptionalObject(vs) {
        return newAggregateValueAsArray(nullAggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'requiredInOptionalObject', vs.__aggregatedArrayDistinct, undefined)
    },
    asNull(vs) {
        return newAggregateValueAsArray(nullAggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, 'optional', vs.__aggregatedArrayDistinct, undefined)
    },
    allowWhen(vs, allowed, error) {
        return newAggregateValueAsArray(nullAllowWhenAggregateValueAsArrayNode, __sameTypeClassOf(vs), vs.__aggregatedArrayColumns, vs.__aggregatedArrayMode, vs.__optionalType, vs.__aggregatedArrayDistinct, undefined, allowed, error)
    },
    projectingOptionalValuesAsNullable(vs) {
        return vs
    },
}

const nullAllowWhenAggregateValueAsArrayNode = allowWhenAggregateNode(nullAggregateValueAsArrayNode)

/** An aggregate function of the database that gives an array, of the class of its data type */
export function __newAggregateValueAsArrayValueSource(typeClass: DataTypeClass, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, optionalType: OptionalType, distinct: boolean): AggregateValueAsArrayValueSource {
    return newAggregateValueAsArray(aggregateValueAsArrayNode, typeClass, aggregatedArrayColumns, aggregatedArrayMode, optionalType, distinct, undefined)
}

/** Whether the value source is an aggregate function that gives an array, guarded or not by `allowWhen` */
export function __isAggregateValueAsArrayNode(vs: NodeValueSource): boolean {
    return vs.__node === aggregateValueAsArrayNode || vs.__node === allowWhenAggregateValueAsArrayNode
}

/** Whether the value source is an aggregate function that gives an array, guarded by `allowWhen` */
export function __isAllowWhenAggregateValueAsArrayNode(vs: NodeValueSource): boolean {
    return vs.__node === allowWhenAggregateValueAsArrayNode
}
