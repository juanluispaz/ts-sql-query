import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, ToSql } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __addWiths, __getOldValues, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { __mergeOptional, type OptionalType } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, type InCreation, isValueSource, __asNodeValueSource } from './NodeStrategy.js'
import type { ValueSourceConstructor } from './dataTypeClassOf.js'

// A duration whose fields are given to an operation that adds it (`add({ days: tInvoice.graceDays })`), some of them
// values of the query (an int, like a column), the others numbers: Temporal's `Duration.from(fields)` with the numbers
// known only by the database. It exists only as the operand of that operation: the SQL builder writes each field where
// the operation uses it, and the node reaches what each field reaches.

/** The names of the fields of a duration, from the largest */
export const durationFieldNames = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds'] as const

/** The name of a field of a duration */
export type DurationFieldName = typeof durationFieldNames[number]

/** The fields of a duration given: a number, a value source, or nothing */
export type DurationFieldsGiven = { readonly [NAME in DurationFieldName]?: unknown }

/** A duration with fields of the query */
export interface DurationOfFieldsValueSource extends NodeValueSource {
    readonly __durationFields: DurationFieldsGiven
}

export const durationOfFieldsValueSourceNode: NodeStrategy<DurationOfFieldsValueSource> = {
    ...valueSourceNode,
    __toSql(vs: DurationOfFieldsValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._durationOfFields(context, vs as unknown as ToSql)
    },
    __addWiths(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        const fields = vs.__durationFields
        for (let i = 0, length = durationFieldNames.length; i < length; i++) {
            __addWiths(fields[durationFieldNames[i]!], sqlBuilder, withs)
        }
    },
    __registerTableOrView(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        const fields = vs.__durationFields
        for (let i = 0, length = durationFieldNames.length; i < length; i++) {
            __registerTableOrView(fields[durationFieldNames[i]!], sqlBuilder, requiredTablesOrViews)
        }
    },
    __registerRequiredColumn(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        const fields = vs.__durationFields
        for (let i = 0, length = durationFieldNames.length; i < length; i++) {
            __registerRequiredColumn(fields[durationFieldNames[i]!], sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    },
    __getOldValues(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const fields = vs.__durationFields
        for (let i = 0, length = durationFieldNames.length; i < length; i++) {
            const result = __getOldValues(fields[durationFieldNames[i]!], sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    },
    __getValuesForInsert(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const fields = vs.__durationFields
        for (let i = 0, length = durationFieldNames.length; i < length; i++) {
            const result = __getValuesForInsert(fields[durationFieldNames[i]!], sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    },
    __isAllowed(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): boolean {
        const fields = vs.__durationFields
        for (let i = 0, length = durationFieldNames.length; i < length; i++) {
            if (!__isAllowed(fields[durationFieldNames[i]!], sqlBuilder)) {
                return false
            }
        }
        return true
    },
    __hasAggregation(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): boolean {
        const fields = vs.__durationFields
        for (let i = 0, length = durationFieldNames.length; i < length; i++) {
            if (__hasAggregation(fields[durationFieldNames[i]!], sqlBuilder)) {
                return true
            }
        }
        return false
    },
}

/** Whether some field of the fields given is a value source */
export function __hasFieldOfTheQuery(fields: DurationFieldsGiven): boolean {
    for (let i = 0, length = durationFieldNames.length; i < length; i++) {
        if (isValueSource(fields[durationFieldNames[i]!])) {
            return true
        }
    }
    return false
}

/**
 * The duration of the fields given (checked by the caller), of the class given (a duration): optional when a field of
 * the query is
 */
export function __newDurationOfFieldsValueSource(fields: DurationFieldsGiven, typeClass: DataTypeClass): DurationOfFieldsValueSource {
    let optionalType: OptionalType = 'required'
    for (let i = 0, length = durationFieldNames.length; i < length; i++) {
        const field = fields[durationFieldNames[i]!]
        if (isValueSource(field)) {
            optionalType = __mergeOptional(optionalType, __asNodeValueSource(field).__optionalType)
        }
    }
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<DurationOfFieldsValueSource>
    vs.__node = durationOfFieldsValueSourceNode
    vs.__durationFields = fields
    return vs
}

/** The fields of a duration with fields of the query, or undefined for another value */
export function __durationFieldsOf(valueSource: unknown): DurationFieldsGiven | undefined {
    if (!isValueSource(valueSource)) {
        return undefined
    }
    const vs = __asNodeValueSource(valueSource) as Partial<DurationOfFieldsValueSource>
    return vs.__node === durationOfFieldsValueSourceNode ? vs.__durationFields : undefined
}
