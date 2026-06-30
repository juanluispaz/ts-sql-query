// Coverage of the compound-operator variants the main compound-select
// coverage leaves on the table: `intersectAll`, `exceptAll`, `minus`,
// `minusAll`.
//
// On SQLite only `.minus(...)` is exposed by the fluent API;
// `.intersectAll`/`.exceptAll`/`.minusAll` are narrowed to `never`
// because the engine doesn't accept the `ALL` flavour of these
// operators. Those three tests are commented out with
// `NOT-APPLICABLE`: the type-system narrowing is a permanent dialect
// frontier (the bodies can never type-check here), kept for symmetry.
//
// Note: the builder rewrites `.minus(...)` to ` except ` for SQLite
// (SQLite supports `EXCEPT` natively but not `MINUS`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQLite has no `INTERSECT ALL` — `intersectAll` is
    // `never` for sqlite (compile-time frontier, paired with this
    // dialect's `types.negative` suite).
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {})
    */

    // NOT-APPLICABLE: SQLite has no `EXCEPT ALL` — `exceptAll` is `never`
    // for sqlite (compile-time frontier, paired with this dialect's
    // `types.negative` suite).
    /*
    test('except-all-emits-except-all-syntax', async () => {})
    */

    test('minus-routes-through-the-dialect-alias', async () => {
        // `.minus(...)` renders as the dialect's set-difference operator
        // (`except` on most dialects, `minus` on Oracle), deduplicated —
        // the exact keyword is pinned by the snapshot. Distinct left statuses
        // {open, in_progress, closed} minus right (id <= 2)
        // {open, in_progress} leaves {closed}.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await all.minus(small).executeSelectMany()
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed'])
    })

    // NOT-APPLICABLE: SQLite has no `MINUS ALL` (nor its `EXCEPT ALL`
    // rewrite) — `minusAll` is `never` for sqlite (frontier, paired with
    // this dialect's `types.negative` suite).
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */

    // The following chain a SECOND set-operator onto an initial compound, so the
    // second op is reached through `CompoundedExecutableSelectExpression`'s OWN
    // re-declared overload set (a distinct interface from the first op's). The
    // suite already chains union-after-union; these cover the set-difference and
    // intersect families through that compounded interface.

    test('compounded-interface-except-after-union', async () => {
        // `a.union(b).except(c)` — `except` is invoked on the compounded
        // expression `a.union(b)` returns. UNION and EXCEPT share precedence and
        // associate left-to-right, so the flat SQL is `(a ∪ b) − c`.
        // a (id<=2) = {open, in_progress}; b (id=4) = {closed}; union dedups to
        // {open, in_progress, closed}; except c (status='open') leaves
        // {in_progress, closed}.
        const expected = [{ status: 'closed' }, { status: 'in_progress' }]
        ctx.mockNext(expected)
        const a = ctx.conn.selectFrom(tIssue).where(tIssue.id.lessOrEqual(2)).select({ status: tIssue.status })
        const b = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(4)).select({ status: tIssue.status })
        const c = ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('open')).select({ status: tIssue.status })
        const result = await a.union(b).except(c).executeSelectMany()
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue where id <= ? union select status as status from issue where id = ? except select status as status from issue where status = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
            "open",
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'in_progress'])
    })

    // NOT-APPLICABLE: SQLite has no `EXCEPT ALL` — `minusAll` is `never` for
    // sqlite on the compounded interface too (compile-time frontier, paired with
    // this dialect's `types.negative` suite).
    /*
    test('compounded-interface-minus-all-after-union', async () => {
        // `a.union(b).minusAll(c)` — the dialect-aliased multiset difference
        // (`except all` on most dialects, `minus all` on Oracle) reached through
        // the compounded interface. union dedups {open, in_progress, closed};
        // `except all` of c (status='open' = one 'open') removes a single 'open',
        // leaving {in_progress, closed}.
        const expected = [{ status: 'closed' }, { status: 'in_progress' }]
        ctx.mockNext(expected)
        const a = ctx.conn.selectFrom(tIssue).where(tIssue.id.lessOrEqual(2)).select({ status: tIssue.status })
        const b = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(4)).select({ status: tIssue.status })
        const c = ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('open')).select({ status: tIssue.status })
        const result = await a.union(b).minusAll(c).executeSelectMany()
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue where id <= $1 union select status as status from issue where id = $2 except all select status as status from issue where status = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
            "open",
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'in_progress'])
    })
    */

    test('compounded-interface-intersect-after-union', async () => {
        // `a.union(b).intersect(c)` — `intersect` on the compounded interface.
        // INTERSECT binds tighter than UNION in SQL, so the data is chosen so the
        // result is the SAME under either grouping (a ⊆ c, so the intersect only
        // removes a b-element): a (id<=2) = {open, in_progress}; b (id=4) =
        // {closed}; c (id<=3) = {open, in_progress}. Both `(a∪b)∩c` and `a∪(b∩c)`
        // equal {open, in_progress} (the intersect drops the unmatched 'closed').
        const expected = [{ status: 'in_progress' }, { status: 'open' }]
        ctx.mockNext(expected)
        const a = ctx.conn.selectFrom(tIssue).where(tIssue.id.lessOrEqual(2)).select({ status: tIssue.status })
        const b = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(4)).select({ status: tIssue.status })
        const c = ctx.conn.selectFrom(tIssue).where(tIssue.id.lessOrEqual(3)).select({ status: tIssue.status })
        const result = await a.union(b).intersect(c).executeSelectMany()
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue where id <= ? union select status as status from issue where id = ? intersect select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
            3,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['in_progress', 'open'])
    })
})
