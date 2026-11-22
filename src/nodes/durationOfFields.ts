import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, ToSql } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __addWiths, __getOldValues, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { __mergeOptional, type OptionalType } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource, type InCreation, isValueSource, __asNodeValueSource } from './NodeStrategy.js'
import type { ValueSourceConstructor } from './dataTypeClassOf.js'

// The fields given to an operation of Temporal, some of them values of the query (an int, like a column), the others
// numbers: a duration that an operation adds (`add({ days: tInvoice.graceDays })`, Temporal's `Duration.from(fields)`
// with the numbers known only by the database), or the fields that `with` puts in place of the ones of a value
// (`with({ day: tCustomer.paymentDay })`). It exists only as the operand of that operation: the SQL builder writes each
// field where the operation uses it, and the node reaches what each field reaches.

/** The names of the fields of a duration, from the largest */
export const durationFieldNames = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds'] as const

/** The name of a field of a duration */
export type DurationFieldName = typeof durationFieldNames[number]

/** The names of the fields that `with` of a value without zone puts in place of its own */
export const withFieldNames = ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond', 'microsecond', 'nanosecond'] as const

/** The fields of a duration given: a number, a value source, or nothing */
export type DurationFieldsGiven = { readonly [NAME in DurationFieldName]?: unknown }

/** Fields of the query: of a duration, or of a with */
export interface DurationOfFieldsValueSource extends NodeValueSource {
    readonly __durationFields: DurationFieldsGiven
    /** The names of its fields: durationFieldNames or withFieldNames */
    readonly __fieldNames: readonly string[]
}

export const durationOfFieldsValueSourceNode: NodeStrategy<DurationOfFieldsValueSource> = {
    ...valueSourceNode,
    __toSql(vs: DurationOfFieldsValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._durationOfFields(context, vs as unknown as ToSql)
    },
    __addWiths(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        const fields = vs.__durationFields as Record<string, unknown>
        const names = vs.__fieldNames
        for (let i = 0, length = names.length; i < length; i++) {
            __addWiths(fields[names[i]!], sqlBuilder, withs)
        }
    },
    __registerTableOrView(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        const fields = vs.__durationFields as Record<string, unknown>
        const names = vs.__fieldNames
        for (let i = 0, length = names.length; i < length; i++) {
            __registerTableOrView(fields[names[i]!], sqlBuilder, requiredTablesOrViews)
        }
    },
    __registerRequiredColumn(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        const fields = vs.__durationFields as Record<string, unknown>
        const names = vs.__fieldNames
        for (let i = 0, length = names.length; i < length; i++) {
            __registerRequiredColumn(fields[names[i]!], sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    },
    __getOldValues(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const fields = vs.__durationFields as Record<string, unknown>
        const names = vs.__fieldNames
        for (let i = 0, length = names.length; i < length; i++) {
            const result = __getOldValues(fields[names[i]!], sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    },
    __getValuesForInsert(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const fields = vs.__durationFields as Record<string, unknown>
        const names = vs.__fieldNames
        for (let i = 0, length = names.length; i < length; i++) {
            const result = __getValuesForInsert(fields[names[i]!], sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    },
    __isAllowed(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): boolean {
        const fields = vs.__durationFields as Record<string, unknown>
        const names = vs.__fieldNames
        for (let i = 0, length = names.length; i < length; i++) {
            if (!__isAllowed(fields[names[i]!], sqlBuilder)) {
                return false
            }
        }
        return true
    },
    __hasAggregation(vs: DurationOfFieldsValueSource, sqlBuilder: HasIsValue): boolean {
        const fields = vs.__durationFields as Record<string, unknown>
        const names = vs.__fieldNames
        for (let i = 0, length = names.length; i < length; i++) {
            if (__hasAggregation(fields[names[i]!], sqlBuilder)) {
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
    return newFieldsOfQuery(fields, typeClass, durationFieldNames)
}

/**
 * The fields of a with given (checked by the caller), some of them of the query, as an operand of the class given (the
 * one of the value): optional when a field of the query is
 */
export function __newWithFieldsValueSource(fields: object, typeClass: DataTypeClass): DurationOfFieldsValueSource {
    return newFieldsOfQuery(fields as DurationFieldsGiven, typeClass, withFieldNames)
}

/** Whether some field of the fields of a with given is a value source */
export function __hasWithFieldOfTheQuery(fields: object): boolean {
    for (let i = 0, length = withFieldNames.length; i < length; i++) {
        if (isValueSource((fields as Record<string, unknown>)[withFieldNames[i]!])) {
            return true
        }
    }
    return false
}

function newFieldsOfQuery(fields: DurationFieldsGiven, typeClass: DataTypeClass, names: readonly string[]): DurationOfFieldsValueSource {
    let optionalType: OptionalType = 'required'
    for (let i = 0, length = names.length; i < length; i++) {
        const field = (fields as Record<string, unknown>)[names[i]!]
        if (isValueSource(field)) {
            optionalType = __mergeOptional(optionalType, __asNodeValueSource(field).__optionalType)
        }
    }
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as InCreation<DurationOfFieldsValueSource>
    vs.__node = durationOfFieldsValueSourceNode
    vs.__durationFields = fields
    vs.__fieldNames = names
    return vs
}

/** The fields of a duration with fields of the query, or undefined for another value */
export function __durationFieldsOf(valueSource: unknown): DurationFieldsGiven | undefined {
    if (!isValueSource(valueSource)) {
        return undefined
    }
    const vs = __asNodeValueSource(valueSource) as Partial<DurationOfFieldsValueSource>
    return vs.__node === durationOfFieldsValueSourceNode && vs.__fieldNames === durationFieldNames ? vs.__durationFields : undefined
}

/** The fields of a with with fields of the query, or undefined for another value */
export function __withFieldsOf(value: unknown): object | undefined {
    if (!isValueSource(value)) {
        return undefined
    }
    const vs = __asNodeValueSource(value) as Partial<DurationOfFieldsValueSource>
    return vs.__node === durationOfFieldsValueSourceNode && vs.__fieldNames === withFieldNames ? vs.__durationFields : undefined
}
