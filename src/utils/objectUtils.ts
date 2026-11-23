import type { TemporalDuration, TemporalInstant, TemporalPlainDate, TemporalPlainDateTime, TemporalPlainMonthDay, TemporalPlainTime, TemporalPlainYearMonth, TemporalZonedDateTime } from '../typeSystem/temporal.js'

/*
 * Force TS to show the real structure type
 * https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type/57683652#57683652
 * 
 * Recursive version cannot be used because it will cause expand over clases, like Date
 * There is no way to detect class instances: https://github.com/microsoft/TypeScript/issues/29063
 */

export type Expand<T> = T extends object
    ? T extends infer O
      ? { [K in keyof O]: O[K] }
      : never
    : T

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 * Discard any key that is not a string or the value is a function
 */

export type UsableKeyOf<T> = keyof {
    [K in keyof T as T[K] extends Function ? never : K extends string ? K : never]: T[K]
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 * Detect optional keys in a object
 * https://gist.github.com/eddiemoore/7873191f366675e520e802a9fb2531d8
 * 
 * This works with exactOptionalPropertyTypes in tsconfig
 * 
 * Only string keys will be returned, non-string keys are not used in ts-sql-query
 */

type Undefined<T> = { [P in UsableKeyOf<T>]: P extends undefined ? T[P] : never }

type FilterFlags<Base, Condition> = {
  [Key in keyof Base]-?: Base[Key] extends Condition ? Key : never
};

type AllowedNames<Base, Condition> =
  FilterFlags<Base, Condition>[keyof Base]

type SubType<Base, Condition> =
  Pick<Base, AllowedNames<Base, Condition>>

export type OptionalKeys<T> = Exclude<keyof T, NonNullable<keyof SubType<Undefined<T>, never>>>
export type RequiredKeys<T> = NonNullable<keyof SubType<Undefined<T>, never>>

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 * Classification of value types when walking a model/projection by dotted path (shared by
 * the deep pick/omit helpers and the model-first dynamic-condition / order-by types).
 *
 * - `PrimitiveValue`: TypeScript primitives.
 * - `TerminalValueObject`: built-in objects that represent a SINGLE value (a date, a value of
 *   Temporal, a binary buffer, a regexp). They are leaves — never a nested projection to descend
 *   into: without them, the path-walking types would descend into their accessors (`day.year`).
 *   The types of Temporal are `never` when the `lib` of the user doesn't declare it (see
 *   typeSystem/temporal.ts), so they add nothing there.
 * - `NonValueObject`: collections and callables — neither a single value nor a nested
 *   projection (arrays, maps, sets, weak maps/sets, functions, promises).
 * - `TerminalValue`: the union of the three above — anything that is NOT a nested plain
 *   object. A model field whose (non-nullable) type is not a `TerminalValue` is a nested
 *   projection to recurse into.
 */
export type PrimitiveValue = string | number | boolean | bigint | symbol | null | undefined
export type TerminalValueObject = Date | TemporalPlainDate | TemporalPlainTime | TemporalPlainDateTime | TemporalPlainYearMonth | TemporalPlainMonthDay | TemporalDuration | TemporalInstant | TemporalZonedDateTime | RegExp | ArrayBuffer | SharedArrayBuffer | ArrayBufferView
export type NonValueObject = ((...args: any[]) => any) | ReadonlyArray<any> | ReadonlyMap<any, any> | ReadonlySet<any> | WeakMap<object, any> | WeakSet<object> | Promise<any>
export type TerminalValue = PrimitiveValue | TerminalValueObject | NonValueObject
