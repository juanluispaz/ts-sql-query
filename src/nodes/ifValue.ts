import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, SqlOperation1, SqlOperation2, ToSql, HasOperation } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { OptionalType } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, type InCreation } from './NodeStrategy.js'
import { type ValueSourceConstructor } from './dataTypeClassOf.js'
import { sqlOperation1ValueSourceNode, sqlOperation2ValueSourceNode, sqlOperationInValueSourceNode } from './operations.js'
import { type AnyType } from '../typeSystem/base.js'

/** The value source of an operation that disappears without a value (`*IfValue`): the fields of its operation */
interface IfValueOperation extends NodeValueSource {
    __valueSource: NodeValueSource
    __value: any
    __value2?: any
}

/**
 * The node of an operation that disappears when an operand is not a value (`*IfValue`): the node of the operation when
 * its operands are values (`sqlBuilder._isValue`, decided when the SQL is written, as `allowEmptyString` only the
 * connection knows); without one, the neutral (it writes nothing and reaches nothing) or its receiver (it is written and
 * reaches as the receiver). Without a value an operation reaches only what it writes. See "The operations that
 * disappear without a value" in src/typeSystem/README.md
 */
function ifValueNode<VS extends IfValueOperation>(node: NodeStrategy<VS>, whenNoValue: 'neutral' | 'receiver', operands: 1 | 2): NodeStrategy<VS> {
    const hasValue = (vs: VS, sqlBuilder: HasIsValue) => sqlBuilder._isValue(vs.__value) && (operands === 1 || sqlBuilder._isValue(vs.__value2))
    const receiver = whenNoValue === 'receiver'
    return {
        ...node,
        __toSql(vs, sqlBuilder, context, forceTypeCast) {
            if (hasValue(vs, sqlBuilder)) {
                return node.__toSql(vs, sqlBuilder, context, forceTypeCast)
            }
            return receiver ? vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast) : ''
        },
        __addWiths(vs, sqlBuilder, withs) {
            if (hasValue(vs, sqlBuilder)) {
                node.__addWiths(vs, sqlBuilder, withs)
            } else if (receiver) {
                vs.__valueSource.__addWiths(sqlBuilder, withs)
            }
        },
        __registerTableOrView(vs, sqlBuilder, requiredTablesOrViews) {
            if (hasValue(vs, sqlBuilder)) {
                node.__registerTableOrView(vs, sqlBuilder, requiredTablesOrViews)
            } else if (receiver) {
                vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
            }
        },
        __registerRequiredColumn(vs, sqlBuilder, requiredColumns, onlyForTablesOrViews) {
            if (hasValue(vs, sqlBuilder)) {
                node.__registerRequiredColumn(vs, sqlBuilder, requiredColumns, onlyForTablesOrViews)
            } else if (receiver) {
                vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
            }
        },
        __getOldValues(vs, sqlBuilder) {
            if (hasValue(vs, sqlBuilder)) {
                return node.__getOldValues(vs, sqlBuilder)
            }
            return receiver ? vs.__valueSource.__getOldValues(sqlBuilder) : undefined
        },
        __getValuesForInsert(vs, sqlBuilder) {
            if (hasValue(vs, sqlBuilder)) {
                return node.__getValuesForInsert(vs, sqlBuilder)
            }
            return receiver ? vs.__valueSource.__getValuesForInsert(sqlBuilder) : undefined
        },
        __isAllowed(vs, sqlBuilder) {
            if (hasValue(vs, sqlBuilder)) {
                return node.__isAllowed(vs, sqlBuilder)
            }
            return receiver ? vs.__valueSource.__isAllowed(sqlBuilder) : true
        },
        __hasAggregation(vs, sqlBuilder) {
            if (hasValue(vs, sqlBuilder)) {
                return node.__hasAggregation(vs, sqlBuilder)
            }
            return receiver ? vs.__valueSource.__hasAggregation(sqlBuilder) : false
        },
    }
}

export interface BooleanValueWhenNoValueValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: '_true' | '_false'
}

export const booleanValueWhenNoValueValueSourceNode: NodeStrategy<BooleanValueWhenNoValueValueSource> = {
    ...valueSourceNode,
    __toSql(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        return sqlBuilder[vs.__operation](context)
    },
    __toSqlForCondition(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        if (vs.__operation === '_true') {
            return sqlBuilder._trueForCondition(context)
        } else {
            return sqlBuilder._falseForCondition(context)
        }
    },
    __addWiths(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newBooleanValueWhenNoValueValueSource(operation: '_true' | '_false', valueSource: AnyType | NodeValueSource, typeClass: DataTypeClass, optionalType: OptionalType): BooleanValueWhenNoValueValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<BooleanValueWhenNoValueValueSource>
    vs.__node = booleanValueWhenNoValueValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    return vs
}

export interface ValueWhenNoValueValueSource extends NodeValueSource {
    readonly __valueSource: NodeValueSource
    readonly __valueWhenNoValue: NodeValueSource & ToSql
}

export const valueWhenNoValueValueSourceNode: NodeStrategy<ValueWhenNoValueValueSource> = {
    ...valueSourceNode,
    __toSql(vs: ValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        return vs.__valueWhenNoValue.__toSql(sqlBuilder, context, forceTypeCast)
    },
    __toSqlForCondition(vs: ValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        return vs.__valueWhenNoValue.__toSqlForCondition(sqlBuilder, context, forceTypeCast)
    },
    __addWiths(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        vs.__valueWhenNoValue.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        vs.__valueWhenNoValue.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        vs.__valueWhenNoValue.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || vs.__valueWhenNoValue.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || vs.__valueWhenNoValue.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && vs.__valueWhenNoValue.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || vs.__valueWhenNoValue.__hasAggregation(sqlBuilder)
    },
}

export function __newValueWhenNoValueValueSource(valueWhenNoValue: NodeValueSource & ToSql, valueSource: AnyType | NodeValueSource, typeClass: DataTypeClass, optionalType: OptionalType): ValueWhenNoValueValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<ValueWhenNoValueValueSource>
    vs.__node = valueWhenNoValueValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__valueWhenNoValue = valueWhenNoValue
    return vs
}

export interface SqlOperation1ValueSourceIfValueOrNoop extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlOperation1
    readonly __value: any
}

export const sqlOperation1ValueSourceIfValueOrNoopNode: NodeStrategy<SqlOperation1ValueSourceIfValueOrNoop> = ifValueNode(sqlOperation1ValueSourceNode, 'neutral', 1)

export function __newSqlOperation1ValueSourceIfValueOrNoop(operation: keyof SqlOperation1, valueSource: AnyType | NodeValueSource, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperation1ValueSourceIfValueOrNoop {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperation1ValueSourceIfValueOrNoop>
    vs.__node = sqlOperation1ValueSourceIfValueOrNoopNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationInValueSourceIfValueOrNoop extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: '_in' | '_notIn'
    readonly __value: any
}

export const sqlOperationInValueSourceIfValueOrNoopNode: NodeStrategy<SqlOperationInValueSourceIfValueOrNoop> = ifValueNode(sqlOperationInValueSourceNode, 'neutral', 1)

export function __newSqlOperationInValueSourceIfValueOrNoop(operation: '_in' | '_notIn', valueSource: AnyType | NodeValueSource, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationInValueSourceIfValueOrNoop {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperationInValueSourceIfValueOrNoop>
    vs.__node = sqlOperationInValueSourceIfValueOrNoopNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationValueSourceIfValueAlwaysNoop extends NodeValueSource {
}

/**
 * The neutral condition (no condition): written as an empty SQL, which whoever composes conditions skips (`_and`, `_or`,
 * the where); it reaches nothing. See "The operations that disappear without a value" in src/typeSystem/README.md
 */
export const sqlOperationValueSourceIfValueAlwaysNoopNode: NodeStrategy<SqlOperationValueSourceIfValueAlwaysNoop> = {
    ...valueSourceNode,
    valueWhenNoValue(vs: SqlOperationValueSourceIfValueAlwaysNoop, value: any): any {
        // The neutral element of the four-valued dynamic-boolean system
        // (true / false / null / neutral): the "ignore" value produced by
        // `dynamicBooleanExpressionUsing(...)`, `onlyWhen(false)` and
        // `ignoreWhen(true)`. It carries no value of its own, so
        // `valueWhenNoValue(value)` — which substitutes a value wherever one is
        // missing — always resolves to `value`, the expression placed in its
        // stead. A bare `true` / `false` is not an expression, so it becomes
        // the constant true / false condition.
        // The neutral is a BooleanConditionType, which has them
        if (value === true) return (vs as any).trueWhenNoValue()
        if (value === false) return (vs as any).falseWhenNoValue()
        return value
    },
    __toSql(_vs: SqlOperationValueSourceIfValueAlwaysNoop, _sqlBuilder: SqlBuilder, _context: SqlBuildContext, _forceTypeCast: boolean): string {
        return ''
    },
}

/**
 * The optional type is the one of the boolean expression that was neutralised; the neutral is one more
 * possibility added to that boolean (true / false / null / neutral), it doesn't replace it, then neutralising it
 * must not drop the null that boolean admitted. When there is no previous boolean expression (the neutral used as
 * the initial value of a dynamic boolean expression), no null is possible yet, and 'required' (the identity of the
 * optional type merge) is the one that steps aside as soon as a real expression joins the expression.
 *
 * It has no default on purpose: each caller says which of the two cases it is, because a default would drop the
 * optional type of the neutralised expression without anyone noticing.
 */
export function __newSqlOperationValueSourceIfValueAlwaysNoop(typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationValueSourceIfValueAlwaysNoop {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperationValueSourceIfValueAlwaysNoop>
    vs.__node = sqlOperationValueSourceIfValueAlwaysNoopNode
    return vs
}

export interface SqlOperation1ValueSourceIfValueOrIgnore extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlOperation1
    readonly __value: any
}

export const sqlOperation1ValueSourceIfValueOrIgnoreNode: NodeStrategy<SqlOperation1ValueSourceIfValueOrIgnore> = ifValueNode(sqlOperation1ValueSourceNode, 'receiver', 1)

export function __newSqlOperation1ValueSourceIfValueOrIgnore(operation: keyof SqlOperation1, valueSource: AnyType | NodeValueSource, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperation1ValueSourceIfValueOrIgnore {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperation1ValueSourceIfValueOrIgnore>
    vs.__node = sqlOperation1ValueSourceIfValueOrIgnoreNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperation2ValueSourceIfValueOrIgnore extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlOperation2
    readonly __value: any
    readonly __value2: any
}

export const sqlOperation2ValueSourceIfValueOrIgnoreNode: NodeStrategy<SqlOperation2ValueSourceIfValueOrIgnore> = ifValueNode(sqlOperation2ValueSourceNode, 'receiver', 2)

export function __newSqlOperation2ValueSourceIfValueOrIgnore(operation: keyof SqlOperation2, valueSource: AnyType | NodeValueSource, value: any, value2: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperation2ValueSourceIfValueOrIgnore {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperation2ValueSourceIfValueOrIgnore>
    vs.__node = sqlOperation2ValueSourceIfValueOrIgnoreNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    vs.__value2 = value2
    return vs
}
