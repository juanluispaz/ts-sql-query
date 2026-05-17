// Compile-time, exact-type assertions.
//
// Usage:
//   const r = await connection.selectFrom(t)...executeSelectMany()
//   assertType<Exact<typeof r, Array<{ id: number, name: string }>>>()
//
// `Exact<A, B>` evaluates to `true` iff A and B are mutually assignable AND have
// identical key sets at every depth (the standard "invariant equality" trick
// used by tsd, type-fest, expect-type, etc.). Anything looser would let a test
// pass when the result type silently became wider/narrower than expected — the
// exact regression this suite exists to catch.

export type Exact<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

export type Extends<A, B> = A extends B ? true : false

/**
 * No-op at runtime. The type parameter is the assertion: if `T` is not `true`,
 * the call site fails to compile with "Argument of type 'false' is not
 * assignable to parameter of type 'true'".
 */
export function assertType<T extends true>(_value?: T): void {
    void _value
}
