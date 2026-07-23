/**
 * Test-only hooks into ts-sql-query's unfinished **query introspection
 * API**.
 *
 * The library carries two parallel webs threaded through every query
 * builder, value source, table/view, CTE, fragment and column —
 * non-destructive walkers that mirror `__toSql` and answer a question
 * about the built query without rendering SQL:
 *
 * - `__isAllowed` — "is every `allowWhen` / `disallowWhen` gate in this
 *   query open?" (and therefore without triggering the throw that
 *   `AllowWhenValueSource.__toSql` would raise). See the comment on
 *   `AllowWhenValueSource.__toSql` in `src/internal/ValueSourceImpl.ts`
 *   for the design intent.
 * - `__hasAggregation` — "does this query contain an aggregation?".
 *
 * Both are scaffolding for a planned public introspection API — think
 * `query.isAllowed()` alongside a future `query.resultSchema()` that
 * would emit OpenAPI / JSON-Schema for the projection so an HTTP layer
 * can autogenerate `/api/docs`. Neither walker is entered by any
 * `execute*` / `query()` / `_build*` path today.
 *
 * The public surface is not exposed yet. These helpers let the test
 * suite exercise the walkers so the scaffolding stays correct (in sync
 * with `__toSql` as new shapes are added) until the public surface
 * lands.
 *
 * **Usage shape.** Each helper takes the built (not-yet-executed)
 * query object only — every query builder carries its own
 * `__sqlBuilder` reference, so no connection argument is needed.
 * Store the builder in a variable, ask the question, then
 * (optionally) execute:
 *
 * ```ts
 * const query = ctx.conn.selectFrom(tIssue)
 *     .select({ id: tIssue.id.allowWhen(false, 'gated') })
 * expect(isQueryAllowed(query)).toBe(false)
 * await expect(query.executeSelectMany()).rejects.toThrow('gated')
 * ```
 *
 * **Stability contract.** When the public API ships (e.g.
 * `query.isAllowed()`) these helpers either become thin wrappers
 * around the public methods or are deleted and tests migrate to the
 * public form. Test bodies that call them should not need to change
 * either way.
 *
 * **This file breaks `test/DESIGN.md` §1.3 ("public surface
 * only").** The exception is documented in `test/LIMITATIONS.md`
 * with the narrow justification: introspection features whose
 * scaffolding exists in `src/` cannot be exercised any other way
 * today. **The existence of these helpers does NOT justify reaching
 * into other underscore-prefixed internals from test bodies.** If
 * you need a new introspection capability for a test, extend this
 * file (one stable seam, one documented exception) — do not import
 * from `src/internal/`, `src/queryBuilders/`, `src/sqlBuilders/`
 * etc. from inside `test/db/**`.
 */

// Every concrete query builder inherits `__sqlBuilder` from
// `AbstractQueryBuilder`, and both walkers take it as their single
// argument. Cast to `any` deliberately — the signatures are not part
// of the public surface yet, and pinning a type here would invite
// consumers (and other test files) to copy it.

/**
 * Whether every `allowWhen` / `disallowWhen` gate reachable from the
 * built query is open — i.e. whether the query would render instead of
 * throwing. Walks `__isAllowed`.
 */
export function isQueryAllowed(query: unknown): boolean {
    const q = query as any
    return q.__isAllowed(q.__sqlBuilder)
}

/**
 * Whether the built query contains an aggregation anywhere the walker
 * reaches — projected columns (including nested/compound projections),
 * `where` / `having` / `groupBy` / `orderBy`, join `on` conditions,
 * `limit` / `offset`, `customizeQuery` fragments, CTEs, and the arms of
 * a compound (`union`, `intersect`, …). Walks `__hasAggregation`.
 *
 * ```ts
 * const query = ctx.conn.selectFrom(tIssue)
 *     .selectOneColumn(ctx.conn.count(tIssue.id))
 * expect(queryHasAggregation(query)).toBe(true)
 * ```
 */
export function queryHasAggregation(query: unknown): boolean {
    const q = query as any
    return q.__hasAggregation(q.__sqlBuilder)
}
