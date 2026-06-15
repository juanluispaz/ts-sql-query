// Coverage of the compound-operator variants the main compound-select
// coverage leaves on the table: `intersectAll`, `exceptAll`, `minus`,
// `minusAll`.
//
// On SqlServer only `.minus(...)` is exposed by the fluent API;
// `.intersectAll`/`.exceptAll`/`.minusAll` are narrowed to `never`
// because the engine doesn't accept the `ALL` flavour of these
// operators. Those three tests are commented out with
// `NOT-APPLICABLE` markers to keep the test count symmetric while
// honouring the type-system narrowing.
//
// Note: the builder rewrites `.minus(...)` to ` except ` for SqlServer
// (SqlServer supports `EXCEPT` natively but not `MINUS`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQL Server does not accept `INTERSECT ALL`; the
    // fluent API narrows `intersectAll` to `never` for `sqlServer`.
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {
        // INTERSECT ALL keeps row-multiplicities (vs INTERSECT which
        // deduplicates). left = every issue status
        // (open, in_progress, open, closed); right (priority <= 3) = all
        // four rows, so the intersection is the full left multiset.
        const expected = [{ status: 'closed' }, { status: 'in_progress' }, { status: 'open' }, { status: 'open' }]
        ctx.mockNext(expected)
        const left = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const right = ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.lessOrEqual(3))
            .select({ status: tIssue.status })
        const result = await left.intersectAll(right).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        // Compound result order is engine-defined; compare as a multiset.
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'in_progress', 'open', 'open'])
    })
    */

    // NOT-APPLICABLE: SQL Server does not accept `EXCEPT ALL`;
    // `exceptAll` is narrowed to `never` for `sqlServer`.
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
        const rows = await all.minus(small).executeSelectMany()
        expect(rows).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except select status as status from issue where id <= @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    // NOT-APPLICABLE: SQL Server does not accept `MINUS ALL` (nor its
    // `EXCEPT ALL` rewrite); `minusAll` is narrowed to `never` for
    // `sqlServer`.
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */
})
