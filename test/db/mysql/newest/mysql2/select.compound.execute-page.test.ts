// `executeSelectPage()` over a compound SELECT (union / unionAll /
// intersect / except). The plain-SELECT path is covered by
// [docs.select-page.test.ts](./docs.select-page.test.ts); a compound
// SELECT goes through a different builder:
// `CompoundSelectQueryBuilder.__buildSelectCount`. That branch wraps
// the whole compound query in `WITH result_for_count AS (...)` and
// emits `SELECT count(*) FROM result_for_count` so the count is
// computed once on the materialised compound — instead of trying to
// re-emit the compound with `count(*)` columns (which would change
// the result for `UNION` vs `UNION ALL`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('union-all-execute-select-page-emits-data-then-count', async () => {
        // 4 issues + 4 projects = 8 rows under UNION ALL. The page
        // (LIMIT 5) returns the first 5 of the ordered result; the
        // count query, wrapped via `__buildSelectCount`, materialises
        // the compound and counts 8.
        const dataRows = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(8)

        const issuesQ = ctx.conn.selectFrom(tIssue).select({ label: tIssue.title })
        const projectsQ = ctx.conn.selectFrom(tProject).select({ label: tProject.name })

        const page = await issuesQ
            .unionAll(projectsQ)
            .orderBy('label')
            .limit(5)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select title as label from issue union all select \`name\` as label from project order by label limit ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        // The count query wraps the compound in a CTE and counts it.
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select title as label from issue union all select \`name\` as label from project order by label) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ label: string }>
            count: number
        }>>()
        expect(page.count).toBe(8)
        expect(page.data).toHaveLength(5)
    })

    test('union-execute-select-page-deduplicates-in-the-count', async () => {
        // UNION (not UNION ALL) collapses duplicates. The count query
        // executes the compound — so duplicates are removed BEFORE
        // counting, which is exactly the semantic difference that
        // makes the dedicated `__buildSelectCount` necessary
        // (a naive `count(*)` on each branch summed together would
        // double-count duplicates).
        const dataRows = [
            { label: 'closed' },
            { label: 'in_progress' },
            { label: 'open' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)

        const a = ctx.conn.selectFrom(tIssue).select({ label: tIssue.status })
        const b = ctx.conn.selectFrom(tIssue).select({ label: tIssue.status })

        const page = await a
            .union(b)
            .orderBy('label')
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select \`status\` as label from issue union select \`status\` as label from issue order by label"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`[]`)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select \`status\` as label from issue union select \`status\` as label from issue order by label) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ label: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
    })

    test('union-execute-select-page-with-extras-count-skips-count-query', async () => {
        // When the user supplies `count` via the extras argument, the
        // wrapper count query is NOT executed — the supplied value is
        // returned. Pins the short-circuit branch of
        // `__buildSelectCount` (the count query is built but never
        // sent because the data path returns the supplied count).
        const dataRows = [
            { label: 'closed' },
            { label: 'in_progress' },
            { label: 'open' },
        ]
        ctx.mockNext(dataRows)

        const a = ctx.conn.selectFrom(tIssue).select({ label: tIssue.status })
        const b = ctx.conn.selectFrom(tIssue).select({ label: tIssue.status })

        const page = await a
            .union(b)
            .orderBy('label')
            .executeSelectPage({ count: 42 })

        // Only the data query — no count query was fired.
        expect(ctx.history.length).toBe(1)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select \`status\` as label from issue union select \`status\` as label from issue order by label"`)
        assertType<Exact<typeof page, {
            data:  Array<{ label: string }>
            count: number
        }>>()
        expect(page.count).toBe(42)
    })

    test('union-all-execute-select-page-over-a-nested-object-wraps-dot-columns-in-count-cte', async () => {
        // `executeSelectPage()` over a compound whose arms re-project a NESTED OBJECT.
        // The count query wraps the whole compound — dot-aliased nested columns and
        // all — inside `with result_for_count as (...)` and counts it. Arm 1 = issue 1,
        // arm 2 = issue 2 (both project 1); UNION ALL keeps both, the page (limit 5)
        // returns both, count = 2. The `data` rows reconstruct the nested `detail`
        // object from the dot-aliased columns.
        const dataRows = [
            { iid: 1, detail: { title: 'Update hero copy', num: 1 } },
            { iid: 2, detail: { title: 'Redesign navbar', num: 2 } },
        ]
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.num': 1 },
            { iid: 2, 'detail.title': 'Redesign navbar', 'detail.num': 2 },
        ])
        ctx.mockNext(2)

        const a = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, num: tIssue.number } })
        const b = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, num: tIssue.number } })

        const page = await a
            .unionAll(b)
            .orderBy('iid')
            .limit(5)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as iid, title as \`detail.title\`, \`number\` as \`detail.num\` from issue where id = ? union all select id as iid, title as \`detail.title\`, \`number\` as \`detail.num\` from issue where id = ? order by iid limit ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            5,
          ]
        `)
        // The count query wraps the compound (nested dot-columns included) in a CTE.
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select id as iid, title as \`detail.title\`, \`number\` as \`detail.num\` from issue where id = ? union all select id as iid, title as \`detail.title\`, \`number\` as \`detail.num\` from issue where id = ? order by iid) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ iid: number; detail: { title: string; num: number } }>
            count: number
        }>>()
        expect(page.count).toBe(2)
        expect(page.data).toEqual(dataRows)
    })
    // ---- round-44 F3-SELECT: compound executeSelectPage extras {data} / {count,data}
    test('union-execute-select-page-with-extras-data-skips-data-query', async () => {
        // When the EXTRAS argument supplies `data`, the compound data query is NOT
        // executed — the supplied array is returned and only the wrapper count
        // query runs (the `__buildSelectCount` CTE over the compound). The mock
        // primes the count; on a real engine the count query still runs and yields
        // the actual compound count.
        ctx.mockNext(8)
        const cached = [{ label: 'Cached label' }]

        const a = ctx.conn.selectFrom(tIssue).select({ label: tIssue.title })
        const b = ctx.conn.selectFrom(tProject).select({ label: tProject.name })

        const page = await a
            .unionAll(b)
            .orderBy('label')
            .executeSelectPage({ data: cached })

        // Only the count query was fired (the data query was skipped).
        expect(ctx.history.length).toBe(1)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select title as label from issue union all select \`name\` as label from project order by label) select count(*) from result_for_count"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ label: string }>
            count: number
        }>>()
        expect(page.data).toBe(cached)
        // Mock path returns 8; real path returns the actual compound count (8).
        if (ctx.realDbEnabled) {
            expect(typeof page.count).toBe('number')
        } else {
            expect(page.count).toBe(8)
        }
    })

    test('union-execute-select-page-with-extras-count-and-data-fires-no-query', async () => {
        // When EXTRAS supplies BOTH `count` and `data`, NEITHER query runs — the
        // page is assembled from the supplied values alone (the zero-query arm of
        // the compound page). No mockNext is primed because the runner is never
        // touched.
        const cached = [{ label: 'Cached label' }]

        const a = ctx.conn.selectFrom(tIssue).select({ label: tIssue.title })
        const b = ctx.conn.selectFrom(tProject).select({ label: tProject.name })

        const page = await a
            .unionAll(b)
            .orderBy('label')
            .executeSelectPage({ count: 7, data: cached })

        // No query was fired at all.
        expect(ctx.history.length).toBe(0)
        assertType<Exact<typeof page, {
            data:  Array<{ label: string }>
            count: number
        }>>()
        expect(page.data).toBe(cached)
        expect(page.count).toBe(7)
    })
})
