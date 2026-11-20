// The options of `total` of a duration, as Temporal reads them: the unit (a text in the singular or the plural, or the
// `unit` of the options), and the date of reference (`relativeTo`): a Temporal.PlainDate or Temporal.PlainDateTime (of
// which only the date counts), or a value source of a plainDate or a plainDateTime. A unit of years, months or weeks
// needs the date of reference.

import { isValueSource, __asNodeValueSource } from '../nodes/NodeStrategy.js'
import { __classOf } from '../nodes/adaptedTypeClass.js'
import { __isPlainDateClass, __isPlainDateTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { __temporalIfAvailable, type TemporalPlainDate } from '../typeSystem/temporal.js'

/** A unit of a total, from the largest */
export type DurationTotalUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond'

/** The date of reference given as a value: its year, its month and its day */
export interface DurationTotalDate {
    readonly year: number
    readonly month: number
    readonly day: number
}

/** The total to compute */
export interface DurationTotal {
    readonly unit: DurationTotalUnit
    /** The date of reference: undefined without it, its parts when given as a value, the value source otherwise */
    readonly relativeTo: DurationTotalDate | object | undefined
}

const units: Record<string, DurationTotalUnit | undefined> = {
    year: 'year', month: 'month', week: 'week', day: 'day', hour: 'hour', minute: 'minute', second: 'second', millisecond: 'millisecond', microsecond: 'microsecond', nanosecond: 'nanosecond',
    years: 'year', months: 'month', weeks: 'week', days: 'day', hours: 'hour', minutes: 'minute', seconds: 'second', milliseconds: 'millisecond', microseconds: 'microsecond', nanoseconds: 'nanosecond',
}

/** Whether the unit is one of the calendar (years, months, weeks), which needs a date of reference */
export function isCalendarTotalUnit(unit: DurationTotalUnit): boolean {
    return unit === 'year' || unit === 'month' || unit === 'week'
}

/** The total the options of `total` ask for, as Temporal reads them; undefined when Temporal rejects them */
export function durationTotalOf(options: unknown): DurationTotal | undefined {
    if (typeof options === 'string') {
        const unit = units[options]
        return unit === undefined || isCalendarTotalUnit(unit) ? undefined : { unit, relativeTo: undefined }
    }
    if (options === null || typeof options !== 'object') {
        return undefined
    }
    const name = (options as { unit?: unknown }).unit
    const unit = typeof name === 'string' ? units[name] : undefined
    if (unit === undefined) {
        return undefined
    }
    const relativeTo = (options as { relativeTo?: unknown }).relativeTo
    if (relativeTo === undefined) {
        return isCalendarTotalUnit(unit) ? undefined : { unit, relativeTo: undefined }
    }
    if (isValueSource(relativeTo)) {
        const typeClass = __classOf(__asNodeValueSource(relativeTo))
        return (__isPlainDateClass(typeClass) || __isPlainDateTimeClass(typeClass)) ? { unit, relativeTo } : undefined
    }
    const temporal = relativeTo !== null && typeof relativeTo === 'object' ? __temporalIfAvailable() : undefined
    if (!temporal || !(relativeTo instanceof temporal.PlainDate || relativeTo instanceof temporal.PlainDateTime)) {
        return undefined
    }
    const date = relativeTo as TemporalPlainDate
    return { unit, relativeTo: { year: date.year, month: date.month, day: date.day } }
}
