// The options of `until` and `since` of a Temporal value without zone, as Temporal reads them (its difference
// settings): the units in the singular or the plural, the largest unit 'auto' (the larger of the day, or the hour for
// a time, and the smallest unit), the smallest unit the nanosecond (the day for a date), not larger than the largest;
// the increment truncated to an integer from 1 to 1e9, dividing the next larger unit and less than it for a unit of
// the time; the mode, 'trunc' by default. `since` is `until` with the mode negated (floor for ceil), negated.

/** A unit of a difference, from the largest */
export type PlainTemporalDifferenceUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond'

/** A mode of rounding of Temporal */
export type PlainTemporalDifferenceMode = 'ceil' | 'floor' | 'expand' | 'trunc' | 'halfCeil' | 'halfFloor' | 'halfExpand' | 'halfTrunc' | 'halfEven'

/** The difference to compute */
export interface PlainTemporalDifference {
    readonly largestUnit: PlainTemporalDifferenceUnit
    readonly smallestUnit: PlainTemporalDifferenceUnit
    readonly increment: number
    /** The mode of `until`: the one given, negated for `since` */
    readonly mode: PlainTemporalDifferenceMode
    /** Whether the result is negated (`since`) */
    readonly negated: boolean
}

const unitOrder: Record<string, number | undefined> = {
    year: 0, month: 1, week: 2, day: 3, hour: 4, minute: 5, second: 6, millisecond: 7, microsecond: 8, nanosecond: 9,
}

/** How many of each unit of the time the next larger unit has */
const maximumIncrement: Record<string, number | undefined> = {
    hour: 24, minute: 60, second: 60, millisecond: 1000, microsecond: 1000, nanosecond: 1000,
}

const negatedModes: Record<string, PlainTemporalDifferenceMode | undefined> = {
    ceil: 'floor', floor: 'ceil', expand: 'expand', trunc: 'trunc', halfCeil: 'halfFloor', halfFloor: 'halfCeil', halfExpand: 'halfExpand', halfTrunc: 'halfTrunc', halfEven: 'halfEven',
}

/** The unit named, in the singular or the plural, if the value has it */
function unitOf(name: unknown, fields: 'date' | 'time' | 'timestamp'): PlainTemporalDifferenceUnit | undefined | null {
    if (name === undefined) {
        return undefined
    }
    if (typeof name !== 'string') {
        return null
    }
    const unit = name.endsWith('s') ? name.slice(0, -1) : name
    const order = unitOrder[unit]
    if (order === undefined || (fields === 'date' && order > 3) || (fields === 'time' && order < 4)) {
        return null
    }
    return unit as PlainTemporalDifferenceUnit
}

/**
 * The difference the options of `until` (or of `since`) of a date ('date'), a time ('time') or a date and time
 * ('timestamp') ask for, as Temporal reads them; undefined when Temporal rejects them
 */
export function plainTemporalDifferenceOf(value: unknown, fields: 'date' | 'time' | 'timestamp', since: boolean): PlainTemporalDifference | undefined {
    if (value !== undefined && (value === null || typeof value !== 'object')) {
        return undefined
    }
    const options = (value ?? {}) as { largestUnit?: unknown, smallestUnit?: unknown, roundingIncrement?: unknown, roundingMode?: unknown }
    const smallest = unitOf(options.smallestUnit, fields)
    const largestGiven = options.largestUnit === 'auto' ? undefined : unitOf(options.largestUnit, fields)
    if (smallest === null || largestGiven === null) {
        return undefined
    }
    const smallestUnit = smallest ?? (fields === 'date' ? 'day' : 'nanosecond')
    const defaultLargest = fields === 'time' ? 'hour' : 'day'
    const largestUnit = largestGiven ?? (unitOrder[defaultLargest]! <= unitOrder[smallestUnit]! ? defaultLargest : smallestUnit)
    if (unitOrder[largestUnit]! > unitOrder[smallestUnit]!) {
        return undefined
    }
    const mode = options.roundingMode === undefined ? 'trunc' : negatedModes[String(options.roundingMode)] && String(options.roundingMode) as PlainTemporalDifferenceMode
    if (!mode) {
        return undefined
    }
    const increment = options.roundingIncrement === undefined ? 1 : Math.trunc(Number(options.roundingIncrement))
    if (!Number.isFinite(increment) || increment < 1 || increment > 1e9) {
        return undefined
    }
    const maximum = maximumIncrement[smallestUnit]
    if (maximum !== undefined && (increment >= maximum || maximum % increment !== 0)) {
        return undefined
    }
    return { largestUnit, smallestUnit, increment, mode: since ? negatedModes[mode]! : mode, negated: since }
}
