// The options of `round` of a Temporal value without zone, as Temporal reads them: the unit (in the singular or the
// plural), the increment (truncated to an integer, dividing the next larger unit and less than it; 1 for a day) and the
// mode. A time since midnight is never negative, so the nine modes of Temporal are five: floor is trunc, expand is
// ceil, halfFloor is halfTrunc and halfCeil is halfExpand.

/** How the time since midnight is rounded */
export type PlainTemporalRoundingMode = 'trunc' | 'ceil' | 'halfExpand' | 'halfTrunc' | 'halfEven'

/** The rounding to apply: to multiples of step nanoseconds, with the mode given */
export interface PlainTemporalRounding {
    readonly step: bigint
    readonly mode: PlainTemporalRoundingMode
}

/** The nanoseconds of each unit, and how many of it the next larger unit has */
const units: Record<string, { readonly nanoseconds: bigint, readonly maximum: number } | undefined> = {
    nanosecond: { nanoseconds: 1n, maximum: 1000 },
    microsecond: { nanoseconds: 1000n, maximum: 1000 },
    millisecond: { nanoseconds: 1_000_000n, maximum: 1000 },
    second: { nanoseconds: 1_000_000_000n, maximum: 60 },
    minute: { nanoseconds: 60_000_000_000n, maximum: 60 },
    hour: { nanoseconds: 3_600_000_000_000n, maximum: 24 },
    day: { nanoseconds: 86_400_000_000_000n, maximum: 1 },
}

const modes: Record<string, PlainTemporalRoundingMode | undefined> = {
    trunc: 'trunc', floor: 'trunc', ceil: 'ceil', expand: 'ceil',
    halfExpand: 'halfExpand', halfCeil: 'halfExpand', halfTrunc: 'halfTrunc', halfFloor: 'halfTrunc', halfEven: 'halfEven',
}

/**
 * The rounding the options of `round` of a time ('time') or a date and time ('timestamp') ask for, as Temporal reads
 * them; undefined when Temporal rejects them: no unit or one the type hasn't (a day for a time), an increment that
 * doesn't divide the next unit or isn't less than it, an unknown mode
 */
export function plainTemporalRoundingOf(value: unknown, fields: 'date' | 'time' | 'timestamp'): PlainTemporalRounding | undefined {
    const options = (typeof value === 'string' ? { smallestUnit: value } : value) as { smallestUnit?: unknown, roundingIncrement?: unknown, roundingMode?: unknown } | null
    if (fields === 'date' || options === null || typeof options !== 'object' || typeof options.smallestUnit !== 'string') {
        return undefined
    }
    const name = options.smallestUnit.endsWith('s') ? options.smallestUnit.slice(0, -1) : options.smallestUnit
    const unit = units[name]
    if (!unit || (name === 'day' && fields !== 'timestamp')) {
        return undefined
    }
    const mode = options.roundingMode === undefined ? 'halfExpand' : modes[String(options.roundingMode)]
    const increment = options.roundingIncrement === undefined ? 1 : Math.trunc(Number(options.roundingIncrement))
    if (!mode || !Number.isFinite(increment) || increment < 1) {
        return undefined
    }
    if (name === 'day' ? increment !== 1 : increment >= unit.maximum || unit.maximum % increment !== 0) {
        return undefined
    }
    return { step: unit.nanoseconds * BigInt(increment), mode }
}
