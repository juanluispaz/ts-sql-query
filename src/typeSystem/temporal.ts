import { TsSqlProcessingError } from '../TsSqlError.js'

/*
 * Temporal, the dates and times of JavaScript, as the library reaches it: its types, and the object at run time.
 *
 * The types are taken from `typeof globalThis`, never written as `Temporal.PlainDate`: a declaration file that names
 * the namespace `Temporal` fails to compile for a user whose `lib` doesn't have it (`esnext.temporal`, or `esnext`),
 * also a user that never uses these types. Taken from the global object, each type is the one of Temporal when the
 * `lib` declares it, and `never` when not, without an error. Nothing else in the library names `Temporal` (a test
 * checks it).
 *
 * At run time Temporal is read from the global object when a value is converted, never when a module is loaded: a
 * runtime without it (Node 22 and 24) loads the library, and fails only converting a value of these types, unless a
 * polyfill installed it in the global object.
 */

/** The type of the Temporal object, when the `lib` of TypeScript declares it */
type TemporalObject = typeof globalThis extends { readonly Temporal: infer TEMPORAL } ? TEMPORAL : never

/** The type of the instances of a class of Temporal */
type InstanceOf<NAME extends string> = TemporalObject extends { readonly [P in NAME]: { readonly prototype: infer INSTANCE } } ? INSTANCE : never

/** `Temporal.PlainDate`: a date without a time and without a zone */
export type TemporalPlainDate = InstanceOf<'PlainDate'>
/** `Temporal.PlainTime`: a time of the day without a date and without a zone */
export type TemporalPlainTime = InstanceOf<'PlainTime'>
/** `Temporal.PlainDateTime`: a date and a time of the day without a zone */
export type TemporalPlainDateTime = InstanceOf<'PlainDateTime'>
/** `Temporal.Duration`: an amount of time, in years, months, weeks, days, hours ... nanoseconds */
export type TemporalDuration = InstanceOf<'Duration'>
/** A unit of a time to round to, as Temporal names it, in the singular or the plural */
export type TemporalTimeUnit = 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond' | 'hours' | 'minutes' | 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds'
/** How a value is rounded, as Temporal names it */
export type TemporalRoundingMode = 'ceil' | 'floor' | 'expand' | 'trunc' | 'halfCeil' | 'halfFloor' | 'halfExpand' | 'halfTrunc' | 'halfEven'
/** The options of `round` of Temporal: the unit, how many of it (dividing the next unit), and how */
export interface TemporalRoundingOptions<UNIT extends string> {
    readonly smallestUnit: UNIT
    readonly roundingIncrement?: number | undefined
    readonly roundingMode?: TemporalRoundingMode | undefined
}
/** The fields `with` of a Temporal.PlainDate takes: integers; the month also as its code (`'M02'`) */
export interface TemporalPlainDateFields {
    readonly year?: number | undefined
    readonly month?: number | undefined
    readonly monthCode?: string | undefined
    readonly day?: number | undefined
}
/** The fields `with` of a Temporal.PlainTime takes: integers */
export interface TemporalPlainTimeFields {
    readonly hour?: number | undefined
    readonly minute?: number | undefined
    readonly second?: number | undefined
    readonly millisecond?: number | undefined
    readonly microsecond?: number | undefined
    readonly nanosecond?: number | undefined
}
/**
 * The fields of a duration as `Temporal.Duration.from` takes them, like `{ days: 3 }`: integers with one sign. Written
 * here, not taken from Temporal, so it is the same with and without its types
 */
export interface TemporalDurationLike {
    readonly years?: number | undefined
    readonly months?: number | undefined
    readonly weeks?: number | undefined
    readonly days?: number | undefined
    readonly hours?: number | undefined
    readonly minutes?: number | undefined
    readonly seconds?: number | undefined
    readonly milliseconds?: number | undefined
    readonly microseconds?: number | undefined
    readonly nanoseconds?: number | undefined
}

/** The Temporal object of the runtime, or of a polyfill installed in the global object; an error for a type without it */
export function __temporal(typeName: string): TemporalObject {
    const temporal = (globalThis as { Temporal?: TemporalObject }).Temporal
    if (temporal === undefined) {
        throw new TsSqlProcessingError({ reason: 'TEMPORAL_NOT_AVAILABLE', typeName }, 'The values of the type ' + typeName + ' are Temporal values, and this runtime has no Temporal: use a runtime with it (Node 26, Bun 1.4) or install a polyfill in the global object')
    }
    return temporal
}

/** The Temporal object of the runtime or of a polyfill, or undefined without it: for a value that may be a Temporal one */
export function __temporalIfAvailable(): TemporalObject | undefined {
    return (globalThis as { Temporal?: TemporalObject }).Temporal
}
