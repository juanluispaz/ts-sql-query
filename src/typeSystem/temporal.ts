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
