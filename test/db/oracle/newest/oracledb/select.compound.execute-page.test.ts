// `executeSelectPage()` over a compound SELECT (union / unionAll /
// intersect / except). The plain-SELECT path is covered by
// [docs.select-page.test.ts](./docs.select-page.test.ts); a compound
// SELECT goes through a different builder:
// [src/queryBuilders/SelectQueryBuilder.ts:1290](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L1290)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select title as "label" from issue union all select name as "label" from project order by 1 fetch next :0 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        // The count query wraps the compound in a CTE and counts it.
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count("label") as (select title as "label" from issue union all select name as "label" from project order by 1) select count(*) from result_for_count"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select status as "label" from issue union select status as "label" from issue order by 1"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`[]`)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count("label") as (select status as "label" from issue union select status as "label" from issue order by 1) select count(*) from result_for_count"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select status as "label" from issue union select status as "label" from issue order by 1"`)
        assertType<Exact<typeof page, {
            data:  Array<{ label: string }>
            count: number
        }>>()
        expect(page.count).toBe(42)
    })
})
