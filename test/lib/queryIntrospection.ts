/**
 * Test-only hook into ts-sql-query's unfinished **query introspection
 * API**.
 *
 * The library carries a parallel `__isAllowed` web threaded through
 * every query builder, value source, table/view, CTE, fragment and
 * column — a non-destructive walker that mirrors `__toSql` and can
 * answer "is every `allowWhen` / `disallowWhen` gate in this query
 * open?" without rendering SQL (and therefore without triggering the
 * throw that `AllowWhenValueSource.__toSql` would raise). The walker
 * is scaffolding for a planned public introspection API — think
 * `query.isAllowed()` alongside a future `query.resultSchema()` that
 * would emit OpenAPI / JSON-Schema for the projection so an HTTP
 * layer can autogenerate `/api/docs`. See the comment on
 * `AllowWhenValueSource.__toSql` in `src/internal/ValueSourceImpl.ts`
 * for the design intent.
 *
 * The public surface is not exposed yet. This helper lets the test
 * suite exercise the walker so the scaffolding stays correct (in
 * sync with `__toSql` as new shapes are added) until the public
 * surface lands.
 *
 * **Usage shape.** The helper takes the built (not-yet-executed)
 * query object only — every query builder carries its own
 * `__sqlBuilder` reference, so no connection argument is needed.
 * Store the builder in a variable, ask whether it would build, then
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
 * `query.isAllowed()`) this helper either becomes a thin wrapper
 * around the public method or is deleted and tests migrate to the
 * public form. Test bodies that call `isQueryAllowed(...)` should
 * not need to change either way.
 *
 * **This helper breaks `test/DESIGN.md` §1.3 ("public surface
 * only").** The exception is documented in `test/LIMITATIONS.md`
 * with the narrow justification: an introspection feature whose
 * scaffolding exists in `src/` cannot be exercised any other way
 * today. **The existence of this helper does NOT justify reaching
 * into other underscore-prefixed internals from test bodies.** If
 * you need a new introspection capability for a test, extend this
 * file (one stable seam, one documented exception) — do not import
 * from `src/internal/`, `src/queryBuilders/`, `src/sqlBuilders/`
 * etc. from inside `test/db/**`.
 */
export function isQueryAllowed(query: unknown): boolean {
    // Every concrete query builder inherits `__sqlBuilder` from
    // `AbstractQueryBuilder`. Cast to `any` deliberately — the
    // signature is not part of the public surface yet, and pinning
    // a type here would invite consumers (and other test files) to
    // copy it.
    const q = query as any
    return q.__isAllowed(q.__sqlBuilder)
}
