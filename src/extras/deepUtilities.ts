/*
 * Deep pick / omit utilities over plain objects.
 *
 * These mirror the ergonomics of the built-in `Pick<T, K>` / `Omit<T, K>` but for nested
 * objects selected through dotted paths (`'a.b.c'`):
 *
 *  - `DeepPickPaths<Model>` is the analogue of `keyof Model` — the union of every
 *    legal dotted path of `Model` (shared by both pick and omit).
 *  - `DeepPick<Model, Paths>` is the analogue of `Pick<Model, Keys>` — the nested
 *    shape that keeps only the selected paths (top-level optionality is preserved,
 *    just like `Pick`).
 *  - `DeepOmit<Model, Paths>` is the analogue of `Omit<Model, Keys>` — the nested
 *    shape with the selected paths removed.
 *  - `deepPick(obj, paths)` / `deepOmit(obj, paths)` are the runtime
 *    companions that produce such an object from any plain object.
 *
 * `DeepPick` is intentionally a plain path-driven recursive mapped type: that shape is
 * covariant in its first type argument over a generic path union, which is what lets a
 * generic helper returning `DeepPick<ResultModel, FIELDS>` be assignable to a caller's
 * hand-written `DeepPick<BusinessModel, FIELDS>` (see how `expandTypeFromDynamicPickPaths`
 * uses it as a bridge). More elaborate community deep-pick types (built on
 * `UnionToIntersection` / deep-simplify helpers) lose that covariance and cannot be used
 * this way.
 */

import type { TerminalValue } from '../utils/objectUtils.js'

// Types treated as leaves: never recursed into when computing paths or picking. Beyond
// primitives, `TerminalValue` covers the built-in object types that represent a single
// value (a date, a binary buffer, a collection, …), so they are leaves, not nested
// projections — see its definition in `objectUtils` (the one place to register new
// terminals, e.g. the `Temporal` types). A plain custom object value (a JSON column typed
// as `{ … }`) is indistinguishable from a nested projection at the type level, so it is
// NOT treated as terminal — same as every structural deep-pick type.

/**
 * Union of every legal dotted path of `MODEL` (the deep analogue of `keyof MODEL`).
 *
 * For `{ id: number; org?: { id: number; name: string } }` it yields
 * `'id' | 'org' | 'org.id' | 'org.name'`.
 */
export type DeepPickPaths<MODEL> =
    NonNullable<MODEL> extends TerminalValue
    ? never
    : {
        [K in keyof NonNullable<MODEL> & string]:
            NonNullable<NonNullable<MODEL>[K]> extends TerminalValue
            ? K
            : K | `${K}.${DeepPickPaths<NonNullable<NonNullable<MODEL>[K]>> & string}`
    }[keyof NonNullable<MODEL> & string]

type DeepPickHead<PATH extends string> = PATH extends `${infer HEAD}.${string}` ? HEAD : PATH
type DeepPickTail<PATH extends string, KEY extends string> = PATH extends `${KEY}.${infer REST}` ? REST : never

/**
 * The nested shape of `MODEL` keeping only the selected dotted `PATHS` (the deep
 * analogue of `Pick<MODEL, KEYS>`). Selecting a whole object (`'org'`) keeps it intact;
 * selecting a leaf (`'org.name'`) narrows the inner object. Top-level optionality of
 * `MODEL` is preserved, exactly like `Pick`.
 */
export type DeepPick<MODEL, PATHS extends string> = {
    [K in keyof MODEL as Extract<K, string> extends DeepPickHead<PATHS> ? K : never]:
        [DeepPickTail<PATHS, Extract<K, string>>] extends [never]
            ? MODEL[K]
            : DeepPick<NonNullable<MODEL[K]>, DeepPickTail<PATHS, Extract<K, string>>>
}

// Bare (non-dotted) paths — the top-level keys to drop entirely.
type DeepOmitWholeKeys<PATHS extends string> = PATHS extends `${string}.${string}` ? never : PATHS

/**
 * The nested shape of `MODEL` with the selected dotted `PATHS` removed (the deep
 * analogue of `Omit<MODEL, KEYS>`). Omitting a whole object (`'org'`) drops it entirely;
 * omitting a leaf (`'org.name'`) keeps the inner object and removes only that property.
 * Top-level optionality of `MODEL` is preserved, exactly like `Omit`.
 */
export type DeepOmit<MODEL, PATHS extends string> = {
    [K in keyof MODEL as Extract<K, string> extends DeepOmitWholeKeys<PATHS> ? never : K]:
        [DeepPickTail<PATHS, Extract<K, string>>] extends [never]
            ? MODEL[K]
            : DeepOmit<NonNullable<MODEL[K]>, DeepPickTail<PATHS, Extract<K, string>>>
}

/**
 * Returns a new object keeping only the properties of `obj` selected by `paths` (dotted
 * paths into nested objects, e.g. `'org.name'`). Intermediate objects are created as
 * needed; a path whose intermediate value is `null`/`undefined` is skipped.
 */
export function deepPick<TYPE extends object, PATHS extends DeepPickPaths<TYPE>>(obj: TYPE, paths: PATHS[]): DeepPick<TYPE, PATHS> {
    const result: any = {}
    if (!obj) {
        return obj as any
    }
    if (!paths) {
        return result
    }

    for (let i = 0, length = paths.length; i < length; i++) {
        const segments = (paths[i] as string).split('.')
        let src: any = obj
        let dst: any = result
        let reachable = true

        for (let s = 0, last = segments.length - 1; s < last; s++) {
            const segment = segments[s]!
            src = src[segment]
            if (src === undefined || src === null) {
                reachable = false
                break
            }
            if (dst[segment] === undefined) {
                dst[segment] = {}
            }
            dst = dst[segment]
        }

        if (!reachable) {
            continue
        }

        const leaf = segments[segments.length - 1]!
        if (leaf in src) {
            dst[leaf] = src[leaf]
        }
    }

    return result
}

/**
 * Returns a shallow copy of `obj` with the properties selected by `paths` removed (dotted
 * paths into nested objects, e.g. `'org.name'`). Omitting a bare key drops it whole;
 * omitting a dotted path keeps the intermediate object (copied, never mutated) and removes
 * only the leaf. Values not touched by any path are copied by reference.
 */
export function deepOmit<TYPE extends object, PATHS extends DeepPickPaths<TYPE>>(obj: TYPE, paths: PATHS[]): DeepOmit<TYPE, PATHS> {
    if (!obj) {
        return obj as any
    }

    const wholeKeys: any = {}
    const deeperTails: any = {}
    if (paths) {
        for (let i = 0, length = paths.length; i < length; i++) {
            const path = paths[i] as string
            const dot = path.indexOf('.')
            if (dot < 0) {
                wholeKeys[path] = true
            } else {
                const head = path.slice(0, dot)
                const tail = path.slice(dot + 1)
                if (deeperTails[head] === undefined) {
                    deeperTails[head] = []
                }
                deeperTails[head].push(tail)
            }
        }
    }

    const o: any = obj
    const result: any = {}
    for (let key in o) {
        if (key in wholeKeys) {
            continue
        }
        const value = o[key]
        if (key in deeperTails && value && typeof value === 'object') {
            result[key] = deepOmit(value, deeperTails[key])
        } else {
            result[key] = value
        }
    }
    return result
}
