// Runtime gating modifier on value sources:
// [src/internal/ValueSourceImpl.ts:1678-1715](../../../../../src/internal/ValueSourceImpl.ts#L1678-L1715)
// `AllowWhenValueSource`. The fluent API is `.allowWhen(cond, error)`
// / `.disallowWhen(cond, error)` — when the condition resolves to a
// disallowed state, building the SQL throws (and therefore so does
// `executeSelect*` / `executeInsert` / etc., because they call
// `query()` first).
//
// Use cases (per `docs/queries/sql-fragments.md` and the
// `extras/types.ts` `TsSqlProcessingError` machinery): feature flags,
// per-role authorization gates, schema-version preconditions. The
// thrown error is a `TsSqlProcessingError` with `reason: 'DISALLOWED'`
// when the caller passed a string; the raw `Error` is used as-is
// when the caller passed an `Error` object.
//
// These tests cover the gate firing AND the gate passing — both
// branches of `__toSql` (allowed: delegate; disallowed: throw). The
// SQL emitted in the allowed branch is identical to a non-gated
// expression — the wrapper is transparent when the condition holds.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('allow-when-true-emits-sql-transparently', async () => {
        // `allowWhen(true, ...)` permits the column to render. SQL is
        // identical to a non-gated `select id`. The wrapper is
        // transparent on the allowed path; the introspection walker
        // reports the query as allowed.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        const query = ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id.allowWhen(true, 'id column disabled') })
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('allow-when-false-throws-when-building', async () => {
        // `allowWhen(false, ...)` blocks the column. The introspection
        // walker reports the query as disallowed (non-destructive,
        // no throw); the throw fires when `.query()` actually runs
        // inside `executeSelectMany`.
        const query = ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id.allowWhen(false, 'id column disabled') })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('id column disabled')
    })

    test('disallow-when-false-emits-sql-transparently', async () => {
        // `disallowWhen(false, ...)` — twin of allowWhen(true): the
        // gate inverts the condition. With `false`, the SQL builds
        // and the introspection walker reports the query as allowed.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        const query = ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id.disallowWhen(false, 'never blocked') })
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('disallow-when-true-throws-when-building', async () => {
        // `disallowWhen(true, ...)` blocks. Inverse of allowWhen(false).
        const query = ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id.disallowWhen(true, 'feature flag blocks reads') })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('feature flag blocks reads')
    })

    test('allow-when-on-where-condition-fires-on-build', async () => {
        // Gate a WHERE-clause value source. The condition value lives
        // on the RHS of `equals`; gating wraps the equals result.
        // `false` blocks the where expression from rendering — the
        // build throws when the condition is appended.
        const query = ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').allowWhen(false, 'where-gate blocks query'))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('where-gate blocks query')
    })

    test('allow-when-accepts-error-object-and-rethrows-it-verbatim', async () => {
        // When the caller passes an `Error` instance instead of a
        // string, the gate stores it verbatim and rethrows the exact
        // object — useful for callers that already raise a typed
        // application error elsewhere.
        const customError = new Error('app-level: caller is not authorised')
        const query = ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id.allowWhen(false, customError) })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(customError)
    })
})
