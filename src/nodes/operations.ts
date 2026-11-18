import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, SqlOperation1, SqlOperation2, HasOperation, SqlFunction0, SqlComparator0, SqlBoolean0 } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, __asNodeValueSource, type InCreation } from './NodeStrategy.js'
import { __typeClassOf, type ValueSourceConstructor } from './dataTypeClassOf.js'
import { __addInlineQueryWiths, isSelectQuery } from './inlineSelect.js'
import { getOptionalType2 } from './operands.js'
import { __adaptedTypeClassOf, __keptClassOf } from './adaptedTypeClass.js'
import { __classOf, __isComputedTextClass, __unadaptedClassOf } from '../nodes/adaptedTypeClass.js'
import { type AnyType } from '../typeSystem/base.js'
import { __asTableOrViewRoot } from '../internal/TableOrViewRoot.js'

/**
 * The class the values given to an operation are converted with: the one of its result when it is of the data type of
 * the receiver (a value computed from it, or one of its values: the result says whether it keeps the type adapter and
 * its SQL data type), and the one of the receiver otherwise (a value compared with a column takes the column's)
 */
function argumentClassOf(vs: NodeValueSource & { __valueSource: NodeValueSource, __operation: string }): DataTypeClass {
    if (scalarOperations.has(vs.__operation)) {
        // A number without a unit (a factor, a divisor, a number of decimals, an exponent, a base): the data type of
        // the receiver (the SQL builder decides by it), without its type adapter
        return __unadaptedClassOf(__classOf(vs.__valueSource))
    }
    const result = __classOf(vs)
    const receiver = __classOf(vs.__valueSource)
    if (__unadaptedClassOf(result) !== __unadaptedClassOf(receiver)) {
        return receiver
    }
    // A text given to an operation that gives a large object or a national text is a plain text
    return __isComputedTextClass(result) ? __unadaptedClassOf(result) : result
}

/** The operations whose value is a number without a unit, not a value of the data type of the receiver */
const scalarOperations = new Set(['_multiply', '_divide', '_roundn', '_power', '_logn', '_atan2'])

/** The column of the previous row in a hierarchical query (`connect by prior` of Oracle) */
export function __priorOf(valueSource: AnyType | NodeValueSource): any {
    const vs = valueSource as unknown as NodeValueSource
    return __newSqlOperation0ValueSource('_prior', vs, __keptClassOf(vs, __typeClassOf(vs)), vs.__optionalType)
}

export interface SqlOperation0ValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlFunction0 | keyof SqlBoolean0
}

export const sqlOperation0ValueSourceNode: NodeStrategy<SqlOperation0ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation0ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__valueSource)
    },
    __addWiths(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newSqlOperation0ValueSource(operation: keyof SqlFunction0 | keyof SqlBoolean0, valueSource: AnyType | NodeValueSource, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperation0ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperation0ValueSource>
    vs.__node = sqlOperation0ValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    return vs
}

export interface SqlOperationCollateValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: '_collate'
    readonly __collation: string
}

export const sqlOperationCollateValueSourceNode: NodeStrategy<SqlOperationCollateValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationCollateValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._collate(context, vs.__valueSource, vs.__collation)
    },
    __addWiths(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newSqlOperationCollateValueSource(valueSource: AnyType | NodeValueSource, collation: string, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationCollateValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperationCollateValueSource>
    vs.__node = sqlOperationCollateValueSourceNode
    vs.__operation = '_collate'

    vs.__valueSource = valueSource as NodeValueSource
    vs.__collation = collation
    return vs
}

export interface SqlOperationIsNullValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlComparator0
}

export const sqlOperationIsNullValueSourceNode: NodeStrategy<SqlOperationIsNullValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationIsNullValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__valueSource)
    },
    __addWiths(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newSqlOperationIsNullValueSource(operation: keyof SqlComparator0, valueSource: AnyType | NodeValueSource, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationIsNullValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperationIsNullValueSource>
    vs.__node = sqlOperationIsNullValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    return vs
}

export interface SqlOperation1ValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlOperation1
    readonly __value: any
}

export const sqlOperation1ValueSourceNode: NodeStrategy<SqlOperation1ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation1ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, argumentClassOf(vs))
    },
    __addWiths(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperation1ValueSource(operation: keyof SqlOperation1, valueSource: AnyType | NodeValueSource, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperation1ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperation1ValueSource>
    vs.__node = sqlOperation1ValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationInValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: '_in' | '_notIn'
    readonly __value: any
}

export const sqlOperationInValueSourceNode: NodeStrategy<SqlOperationInValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationInValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, argumentClassOf(vs))
    },
    __addWiths(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __addWiths(values[i], sqlBuilder, withs)
            }
        } else {
            if (isSelectQuery(values)) {
                __addInlineQueryWiths(sqlBuilder, withs, values)
            } else {
                __addWiths(values, sqlBuilder, withs)
            }
        }
    },
    __registerTableOrView(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerTableOrView(values[i], sqlBuilder, requiredTablesOrViews)
            }
        } else {
            __registerTableOrView(values, sqlBuilder, requiredTablesOrViews)
        }
    },
    __registerRequiredColumn(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerRequiredColumn(values[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
            }
        } else {
            __registerRequiredColumn(values, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    },
    __getOldValues(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        let result = vs.__valueSource.__getOldValues(sqlBuilder)
        if (result) {
            return result
        }
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getOldValues(values[i], sqlBuilder)
                if (result) {
                    return result
                }
            }
        } else {
            return __getOldValues(values, sqlBuilder)
        }
        return undefined
    },
    __getValuesForInsert(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        let result = vs.__valueSource.__getValuesForInsert(sqlBuilder)
        if (result) {
            return result
        }
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getValuesForInsert(values[i], sqlBuilder)
                if (result) {
                    return result
                }
            }
        } else {
            return __getValuesForInsert(values, sqlBuilder)
        }
        return undefined
    },
    __isAllowed(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): boolean {
        let result = vs.__valueSource.__isAllowed(sqlBuilder)
        if (!result) {
            return false
        }
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __isAllowed(values[i], sqlBuilder)
                if (!result) {
                    return false
                }
            }
        } else {
            return __isAllowed(values, sqlBuilder)
        }
        return true
    },
    __hasAggregation(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): boolean {
        if (vs.__valueSource.__hasAggregation(sqlBuilder)) {
            return true
        }
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                if (__hasAggregation(values[i], sqlBuilder)) {
                    return true
                }
            }
            return false
        }
        return __hasAggregation(values, sqlBuilder)
    },
}

export function __newSqlOperationInValueSource(operation: '_in' | '_notIn', valueSource: AnyType | NodeValueSource, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationInValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperationInValueSource>
    vs.__node = sqlOperationInValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationValueWhenNullValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlOperation1
    readonly __value: any
}

export const sqlOperationValueWhenNullValueSourceNode: NodeStrategy<SqlOperationValueWhenNullValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, argumentClassOf(vs))
    },
    __addWiths(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperationValueWhenNullValueSource(valueSource: AnyType | NodeValueSource, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationValueWhenNullValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperationValueWhenNullValueSource>
    vs.__node = sqlOperationValueWhenNullValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = '_valueWhenNull'
    vs.__value = value
    return vs
}

export interface SqlOperation1NotOptionalValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlOperation1
    readonly __value: any
}

export const sqlOperation1NotOptionalValueSourceNode: NodeStrategy<SqlOperation1NotOptionalValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, argumentClassOf(vs))
    },
    __addWiths(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperation1NotOptionalValueSource(operation: keyof SqlOperation1, valueSource: AnyType | NodeValueSource, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperation1NotOptionalValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperation1NotOptionalValueSource>
    vs.__node = sqlOperation1NotOptionalValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperation2ValueSource extends NodeValueSource, HasOperation {
    readonly __valueSource: NodeValueSource
    readonly __operation: keyof SqlOperation2
    readonly __value: any
    readonly __value2: any
}

export const sqlOperation2ValueSourceNode: NodeStrategy<SqlOperation2ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation2ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value, vs.__value2], vs.__operation), vs.__value, vs.__value2, argumentClassOf(vs))
    },
    __addWiths(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
        __addWiths(vs.__value2, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value2, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value2, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder) || __getOldValues(vs.__value2, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder) || __getValuesForInsert(vs.__value2, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder) && __isAllowed(vs.__value2, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder) || __hasAggregation(vs.__value2, sqlBuilder)
    },
}

export function __newSqlOperation2ValueSource(operation: keyof SqlOperation2, valueSource: AnyType | NodeValueSource, value: any, value2: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperation2ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<SqlOperation2ValueSource>
    vs.__node = sqlOperation2ValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    vs.__operation = operation
    vs.__value = value
    vs.__value2 = value2
    return vs
}

export interface NoopValueSource extends NodeValueSource {
    readonly __valueSource: NodeValueSource
}

export const noopValueSourceNode: NodeStrategy<NoopValueSource> = {
    ...valueSourceNode,
    __toSql(vs: NoopValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
    },
    __addWiths(vs: NoopValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: NoopValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: NoopValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: NoopValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: NoopValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: NoopValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: NoopValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newNoopValueSource(valueSource: AnyType | NodeValueSource, typeClass: DataTypeClass, optionalType: OptionalType): NoopValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<NoopValueSource>
    vs.__node = noopValueSourceNode

    vs.__valueSource = valueSource as NodeValueSource
    return vs
}

/** An operation of the value source alone, whose result has the class given (with its type adapter, if any) */
export function __operation0(valueSource: AnyType, operation: keyof SqlFunction0 | keyof SqlBoolean0, typeClass: DataTypeClass): any {
    const vs = valueSource as unknown as NodeValueSource
    return __newSqlOperation0ValueSource(operation, vs, typeClass, vs.__optionalType)
}

/** An operation of the value source with a value, whose result has the class given (with its type adapter, if any) */
export function __operation1(valueSource: AnyType, operation: keyof SqlOperation1, value: any, typeClass: DataTypeClass): any {
    const vs = valueSource as unknown as NodeValueSource
    return __newSqlOperation1ValueSource(operation, vs, value, typeClass, getOptionalType2(vs, value))
}
