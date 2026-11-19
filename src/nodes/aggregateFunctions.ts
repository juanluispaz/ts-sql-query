import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, HasOperation, AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2 } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { OptionalType } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, type InCreation } from './NodeStrategy.js'
import { type ValueSourceConstructor } from './dataTypeClassOf.js'

export interface AggregateFunctions0ValueSource extends NodeValueSource, HasOperation {
    readonly __operation: keyof AggregateFunctions0
}

export const aggregateFunctions0ValueSourceNode: NodeStrategy<AggregateFunctions0ValueSource> = {
    ...valueSourceNode,
    // An aggregate function
    __hasAggregation() {
        return true
    },
    __toSql(vs: AggregateFunctions0ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context)
    },
}

export function __newAggregateFunctions0ValueSource(operation: keyof AggregateFunctions0, typeClass: DataTypeClass, optionalType: OptionalType): AggregateFunctions0ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<AggregateFunctions0ValueSource>
    vs.__node = aggregateFunctions0ValueSourceNode

    vs.__operation = operation
    return vs
}

export interface AggregateFunctions1ValueSource extends NodeValueSource, HasOperation {
    readonly __operation: keyof AggregateFunctions1
    readonly __value: any
}

export const aggregateFunctions1ValueSourceNode: NodeStrategy<AggregateFunctions1ValueSource> = {
    ...valueSourceNode,
    // An aggregate function
    __hasAggregation() {
        return true
    },
    __toSql(vs: AggregateFunctions1ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__value, [], vs.__operation))
    },
    __addWiths(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
}

export function __newAggregateFunctions1ValueSource(operation: keyof AggregateFunctions1, value: any, typeClass: DataTypeClass, optionalType: OptionalType): AggregateFunctions1ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<AggregateFunctions1ValueSource>
    vs.__node = aggregateFunctions1ValueSourceNode

    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface AggregateFunctions1or2ValueSource extends NodeValueSource, HasOperation {
    readonly __operation: keyof AggregateFunctions1or2
    readonly __value: any
    readonly __separator: string | undefined
}

export const aggregateFunctions1or2ValueSourceNode: NodeStrategy<AggregateFunctions1or2ValueSource> = {
    ...valueSourceNode,
    // An aggregate function
    __hasAggregation() {
        return true
    },
    __toSql(vs: AggregateFunctions1or2ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__separator, vs.__value)
    },
    __addWiths(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
}

export function __newAggregateFunctions1or2ValueSource(operation: keyof AggregateFunctions1or2, separator: string | undefined, value: any, typeClass: DataTypeClass, optionalType: OptionalType): AggregateFunctions1or2ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<AggregateFunctions1or2ValueSource>
    vs.__node = aggregateFunctions1or2ValueSourceNode

    vs.__operation = operation
    vs.__separator = separator
    vs.__value = value
    return vs
}
