import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, SqlOperationStatic0, SqlOperationStatic1, HasOperation, SqlSequenceOperation } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, __asNodeValueSource } from './NodeStrategy.js'
import { type ValueSourceConstructor } from './dataTypeClassOf.js'
import { __adaptedTypeClassOf } from './adaptedTypeClass.js'
import { __classOf } from '../nodes/adaptedTypeClass.js'

export interface SqlOperationStatic0ValueSource extends NodeValueSource, HasOperation {
    __operation: keyof SqlOperationStatic0
}

export const sqlOperationStatic0ValueSourceNode: NodeStrategy<SqlOperationStatic0ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationStatic0ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context)
    },
}

export function __newSqlOperationStatic0ValueSource(operation: keyof SqlOperationStatic0, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationStatic0ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as SqlOperationStatic0ValueSource
    vs.__node = sqlOperationStatic0ValueSourceNode

    vs.__operation = operation
    return vs
}

export interface SqlOperationStaticBooleanValueSource extends NodeValueSource, HasOperation {
    __operation: keyof SqlOperationStatic0
}

export const sqlOperationStaticBooleanValueSourceNode: NodeStrategy<SqlOperationStaticBooleanValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationStaticBooleanValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context)
    },
    __toSqlForCondition(vs: SqlOperationStaticBooleanValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        if (vs.__operation === '_true') {
            return sqlBuilder._trueForCondition(context)
        } else {
            return sqlBuilder._falseForCondition(context)
        }
    },
}

export function __newSqlOperationStaticBooleanValueSource(operation: '_true' | '_false', typeClass: DataTypeClass): SqlOperationStaticBooleanValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)('required') as SqlOperationStaticBooleanValueSource
    vs.__node = sqlOperationStaticBooleanValueSourceNode

    vs.__operation = operation
    return vs
}

export interface SqlOperationStatic1ValueSource extends NodeValueSource, HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any
}

export const sqlOperationStatic1ValueSourceNode: NodeStrategy<SqlOperationStatic1ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationStatic1ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__value, __classOf(vs), forceTypeCast)
    },
    __addWiths(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): boolean {
        return __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperationStatic1ValueSource(operation: keyof SqlOperationStatic1, value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationStatic1ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as SqlOperationStatic1ValueSource
    vs.__node = sqlOperationStatic1ValueSourceNode

    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationConstValueSource extends NodeValueSource, HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any
    // Set on a copy (see SqlBuilder._typedOperand) when the const is an operand nothing else gives a type to
    __forceTypeCast?: boolean | undefined
}

export const sqlOperationConstValueSourceNode: NodeStrategy<SqlOperationConstValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationConstValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (vs.__forceTypeCast) {
            return sqlBuilder._typedConst(context, vs.__value, __classOf(vs))
        }
        return sqlBuilder._const(context, vs.__value, __classOf(vs), forceTypeCast)
    },
    __toSqlForCondition(vs: SqlOperationConstValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (vs.__forceTypeCast) {
            return sqlBuilder._typedConstForCondition(context, vs.__value, __classOf(vs))
        }
        return sqlBuilder._constForCondition(context, vs.__value, __classOf(vs), forceTypeCast)
    },
    isConstValue(_vs: SqlOperationConstValueSource): boolean {
        return true
    },
    getConstValue(vs: SqlOperationConstValueSource): any {
        return vs.__value
    },
    __addWiths(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue,withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): boolean {
        return __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperationConstValueSource(value: any, typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationConstValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as SqlOperationConstValueSource
    vs.__node = sqlOperationConstValueSourceNode

    vs.__operation = '_const'
    vs.__value = value
    return vs
}

export interface SequenceValueSource extends NodeValueSource {
    __operation: keyof SqlSequenceOperation
    __sequenceName: string
}

export const sequenceValueSourceNode: NodeStrategy<SequenceValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SequenceValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__sequenceName, vs.constructor as unknown as DataTypeClass)
    },
}

export function __newSequenceValueSource(operation: keyof SqlSequenceOperation, sequenceName: string, typeClass: DataTypeClass, optionalType: OptionalType): SequenceValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as SequenceValueSource
    vs.__node = sequenceValueSourceNode

    vs.__operation = operation
    vs.__sequenceName = sequenceName
    return vs
}

export interface NullValueSource extends NodeValueSource, HasOperation {
    __operation: '_asNullValue'
}

export const nullValueSourceNode: NodeStrategy<NullValueSource> = {
    ...valueSourceNode,
    __toSql(vs: NullValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._asNullValue(context, __classOf(vs))
    },
    __isAllowed(_vs: NullValueSource, _sqlBuilder: HasIsValue): boolean {
        return true
    },
}

export function __newNullValueSource(typeClass: DataTypeClass, optionalType: OptionalType): NullValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as NullValueSource
    vs.__node = nullValueSourceNode
    vs.__operation = '_asNullValue'
    return vs
}
