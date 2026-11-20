// The options of `until`, `since` and `round` of an instant, as Temporal reads them. A difference has units of the
// time only, from the hour down, and its largest unit is by default the second (or the smallest unit when it is
// larger); the rest, as for a date and time (see plainTemporalDifference.ts): the increment divides the next larger
// unit and is less than it. A rounding has the units from the hour down too, and its increment must divide a day
// (24 hours, 1440 minutes, 86400 seconds...), up to a whole day: the instant is rounded as if it were positive, so its
// nanoseconds since the midnight in UTC before it are rounded, as for a date and time.

import type { PlainTemporalRounding, PlainTemporalRoundingMode } from './plainTemporalRounding.js'

const timeUnitOrder: Record<string, number | undefined> = {
    hour: 4, minute: 5, second: 6, millisecond: 7, microsecond: 8, nanosecond: 9,
}

/** The nanoseconds of each unit of the time, and how many of it a day has */
const timeUnits: Record<string, { readonly nanoseconds: bigint, readonly inADay: number } | undefined> = {
    hour: { nanoseconds: 3_600_000_000_000n, inADay: 24 },
    minute: { nanoseconds: 60_000_000_000n, inADay: 1440 },
    second: { nanoseconds: 1_000_000_000n, inADay: 86_400 },
    millisecond: { nanoseconds: 1_000_000n, inADay: 86_400_000 },
    microsecond: { nanoseconds: 1000n, inADay: 86_400_000_000 },
    nanosecond: { nanoseconds: 1n, inADay: 86_400_000_000_000 },
}

const modes: Record<string, PlainTemporalRoundingMode | undefined> = {
    trunc: 'trunc', floor: 'trunc', ceil: 'ceil', expand: 'ceil',
    halfExpand: 'halfExpand', halfCeil: 'halfExpand', halfTrunc: 'halfTrunc', halfFloor: 'halfTrunc', halfEven: 'halfEven',
}

/** The unit of the time named, in the singular or the plural; null when it isn't one, undefined when not given */
function timeUnitOf(name: unknown): string | undefined | null {
    if (name === undefined) {
        return undefined
    }
    if (typeof name !== 'string') {
        return null
    }
    const unit = name.endsWith('s') ? name.slice(0, -1) : name
    return timeUnitOrder[unit] === undefined ? null : unit
}

/**
 * The options of `until` (or `since`) of an instant as the ones of a date and time with the same meaning: its units
 * checked, and its largest unit always given (the second by default, or the smallest unit when it is larger). Undefined
 * when Temporal rejects a unit; the rest is checked as for a date and time
 */
export function instantDifferenceOptionsOf(value: unknown): object | undefined {
    if (value !== undefined && (value === null || typeof value !== 'object')) {
        return undefined
    }
    const options = (value ?? {}) as { largestUnit?: unknown, smallestUnit?: unknown, roundingIncrement?: unknown, roundingMode?: unknown }
    const smallest = timeUnitOf(options.smallestUnit)
    const largest = options.largestUnit === 'auto' ? undefined : timeUnitOf(options.largestUnit)
    if (smallest === null || largest === null) {
        return undefined
    }
    const smallestUnit = smallest ?? 'nanosecond'
    const largestUnit = largest ?? (timeUnitOrder[smallestUnit]! < timeUnitOrder['second']! ? smallestUnit : 'second')
    return { largestUnit, smallestUnit, roundingIncrement: options.roundingIncrement, roundingMode: options.roundingMode }
}

/**
 * The rounding the options of `round` of an instant ask for (a unit, or `{ smallestUnit, roundingIncrement,
 * roundingMode }`), as Temporal reads them; undefined when Temporal rejects them: no unit or one that isn't of the
 * time, an increment that doesn't divide a day, an unknown mode
 */
export function instantRoundingOf(value: unknown): PlainTemporalRounding | undefined {
    const options = (typeof value === 'string' ? { smallestUnit: value } : value) as { smallestUnit?: unknown, roundingIncrement?: unknown, roundingMode?: unknown } | null
    if (options === null || typeof options !== 'object') {
        return undefined
    }
    const name = timeUnitOf(options.smallestUnit)
    const unit = name ? timeUnits[name] : undefined
    if (!unit) {
        return undefined
    }
    const mode = options.roundingMode === undefined ? 'halfExpand' : modes[String(options.roundingMode)]
    if (!mode) {
        return undefined
    }
    const increment = options.roundingIncrement === undefined ? 1 : Math.trunc(Number(options.roundingIncrement))
    if (!Number.isFinite(increment) || increment < 1 || increment > unit.inADay || unit.inADay % increment !== 0) {
        return undefined
    }
    return { step: unit.nanoseconds * BigInt(increment), mode }
}
