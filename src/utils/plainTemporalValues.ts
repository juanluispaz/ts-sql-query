// What the query runners do with the Temporal values without zone (plainDate, plainTime, plainDateTime): the text they
// give their drivers, and the result columns they read as text, so no digit of the fraction of a second is lost.

import type { DataTypeClass } from '../TypeAdapter.js'
import { existingQueryContextOf } from '../internal/QueryContextImpl.js'
import { __isDurationClass, __isInstantClass, __isPlainDateClass, __isPlainDateTimeClass, __isPlainTimeClass, __isZonedDateTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { __temporalIfAvailable, type TemporalPlainDateTime } from '../typeSystem/temporal.js'
import { plainDateText, plainTimeText } from './plainDateTimeText.js'

/**
 * The text of a Temporal value without zone, as the databases read it: `YYYY-MM-DD`, `HH:MM:SS[.fffffffff]` and
 * `YYYY-MM-DD HH:MM:SS[.fffffffff]`, without an offset (the database completes nothing: it is a wall clock). A year
 * before 1 has its sign (`-0044-03-15`), or, with `withEra` (PostgreSQL), the era: `0044-03-15 BC` for the year -43.
 * Undefined for any other value.
 */
export function plainTemporalText(value: unknown, withEra: boolean = false): string | undefined {
    if (value === null || typeof value !== 'object') {
        return undefined
    }
    const temporal = __temporalIfAvailable()
    if (!temporal) {
        return undefined
    }
    if (value instanceof temporal.PlainTime) {
        return plainTimeText(value)
    }
    const isDate = value instanceof temporal.PlainDate
    if (!isDate && !(value instanceof temporal.PlainDateTime)) {
        return undefined
    }
    const year = value.year
    const bc = withEra && year < 1
    // The year 0 is 1 BC
    const date = plainDateText(value, bc ? 1 - year : year)
    const era = bc ? ' BC' : ''
    return isDate ? date + era : date + ' ' + plainTimeText(value as TemporalPlainDateTime) + era
}

/** Whether the value is a Temporal value without zone: a PlainDate, a PlainTime or a PlainDateTime */
export function isPlainTemporalValue(value: unknown): boolean {
    if (value === null || typeof value !== 'object') {
        return false
    }
    const temporal = __temporalIfAvailable()
    return !!temporal && (value instanceof temporal.PlainDate || value instanceof temporal.PlainTime || value instanceof temporal.PlainDateTime)
}

/** Whether the class is one of a Temporal value without zone: a plainDate, a plainTime, a plainDateTime, or one of their families */
export function isPlainTemporalClass(typeClass: DataTypeClass | undefined): boolean {
    return typeClass !== undefined && (__isPlainDateClass(typeClass) || __isPlainTimeClass(typeClass) || __isPlainDateTimeClass(typeClass))
}

/**
 * Whether the class is one of a Temporal value a query runner reads as text: a Temporal value without zone, a duration
 * or an instant
 */
function isReadAsTextClass(typeClass: DataTypeClass | undefined): boolean {
    return typeClass !== undefined && (isPlainTemporalClass(typeClass) || __isDurationClass(typeClass) || __isInstantClass(typeClass) || __isZonedDateTimeClass(typeClass))
}

/**
 * The names (keys in the row) of the result columns of the query with these params that are Temporal values without
 * zone, durations or instants, which the query runner reads as text; undefined when there is none, or the query wasn't built by the library
 */
export function plainTemporalResultColumns(params: any[]): string[] | undefined {
    const columns = existingQueryContextOf(params)?.resultColumns
    if (!columns) {
        return undefined
    }
    let result: string[] | undefined = undefined
    for (const column of columns) {
        if (isReadAsTextClass(column.requestedType)) {
            if (!result) {
                result = []
            }
            result.push(column.name)
        }
    }
    return result
}
