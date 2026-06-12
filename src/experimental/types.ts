// EXPERIMENTAL — INTERNAL, UNSTABLE. Not part of the public API.
//
// Provenance: `DynamicOrderByForModel` is the whole-string counterpart of
// `OrderByForModel<MODEL>` (which lives in `src/dynamic/orderBy.ts` and stays public). It
// is parked here, out of the public surface, while its ergonomics are
// evaluated — it only validates through type inference (see the usage contract below),
// which makes it awkward enough to keep experimental for now. It is reachable, if needed,
// only via the unsupported escape hatch `ts-sql-query/__UNSUPPORTED__/experimental/types.js`,
// with no stability guarantees: it may change, break or disappear in any release.
//
// The public, ergonomic way to type a multi-column order-by from a model is an
// `OrderByForModel<Model>[]` array fed to `orderByFromStringArray(...)`.

import type { OrderByForModel } from '../dynamic/orderBy.js'

/**
 * Validate a WHOLE comma-separated order-by string against the model — the multi-column
 * counterpart of `OrderByForModel` (which types a single clause). It recursively checks
 * that every clause (separated by `', '`) is a valid `OrderByForModel<MODEL>` clause, so
 * the order-by value can be typed directly without `.join(', ')`. It resolves to the input
 * string when valid and to `never` when any clause is invalid.
 *
 * The recursion is over the order-by STRING (each step peels one clause; `TAIL` shrinks),
 * so it terminates naturally at the last clause — this is a bounded `Split`-style recursive
 * conditional, not the structural recursion the library unrolls.
 *
 * ⚠️ Usage contract — the second type parameter must be INFERRED, never written by hand.
 * TypeScript cannot infer a trailing type parameter when an earlier one is given explicitly,
 * so the only correct usage is to let `ORDER_BY` be inferred from the argument at a call
 * site — typically a generic function parameter (the idiomatic model-first shape):
 *
 * ```ts
 * function getX<ORDER_BY extends string>(orderBy: DynamicOrderByForModel<Model, ORDER_BY>) { ... }
 * getX('name asc, birthday desc')   // validated at compile time; an invalid clause fails to compile
 * ```
 *
 * Used as a DIRECT annotation it does NOT validate: `DynamicOrderByForModel<Model, string>`
 * collapses to `never` (no string is assignable to it). This fails CLOSED — misuse is a hard
 * compile error, never a silently-permissive type. For a multi-column order-by without the
 * generic-inference dance, prefer an `OrderByForModel<Model>[]` array fed to `orderByFromStringArray(...)`.
 */
export type DynamicOrderByForModel<MODEL, ORDER_BY extends string> =
    ORDER_BY extends `${infer HEAD}, ${infer TAIL}`
    ? [HEAD] extends [OrderByForModel<MODEL>]
        ? `${HEAD}, ${DynamicOrderByForModel<MODEL, TAIL> & string}`
        : never
    : [ORDER_BY] extends [OrderByForModel<MODEL>] ? ORDER_BY : never
