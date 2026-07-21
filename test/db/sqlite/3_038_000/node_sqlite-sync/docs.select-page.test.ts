// Documentation snippets for the "Select page" feature
// (docs/queries/select-page.md). `executeSelectPage()` runs the query
// twice — once with LIMIT/OFFSET for the page, once without for the
// total count — and bundles them into `{ data, count }`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:select-page/projects-paginated', async () => {
        // Page 1 (10 per page, offset 0). Seed has 4 projects, but the page
        // is sized so the result has all of them and count = 4.
        ctx.mockNext([
            { id: 2, name: 'Internal tools', slug: 'tools' },
            { id: 4, name: 'Legacy app',     slug: 'legacy' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 3, name: 'Public API',     slug: 'public-api' },
        ])
        ctx.mockNext(4)

        const connection = ctx.conn

        // doc-start
        const page = sync(connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('name')
            .limit(10)
            .offset(0)
            .executeSelectPage())
        // doc-end

        // executeSelectPage runs two queries: first the data page, then
        // the unpaginated count. We assert both via ctx.history.
        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by name limit ? offset ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from project"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; name: string; slug: string }>
            count: number
        }>>()
        expect(page.count).toBe(4)
        expect(page.data).toHaveLength(4)
    })

    test('docs-extra:select-page/plain-filtered-count-retains-where-drops-paging', async () => {
        // A PLAIN filtered page: `selectFrom(t).where(...).select({...})` with
        // limit/offset and no group by / join / compound. The count query takes
        // the fast path that reuses the same FROM + WHERE and just swaps the
        // projection for `count(*)` — so it RETAINS the WHERE but DROPS the
        // order by / limit / offset (no subquery wrap). The data query keeps them.
        // priority > 1 matches issues 1 ('Update hero copy'), 3 ('Migrate to
        // ESM') and 4 ('Document /v2/users'); the page holds all three, count = 3.
        ctx.mockNext([
            { id: 1, title: 'Update hero copy'   },
            { id: 3, title: 'Migrate to ESM'     },
            { id: 4, title: 'Document /v2/users' },
        ])
        ctx.mockNext(3)

        const page = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage())

        // Two queries: the data page (keeps order by / limit / offset), then the
        // count (keeps the WHERE, drops the paging, no `from (select …)` wrap).
        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as id, title as title from issue where priority > ? order by id limit ? offset ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from issue where priority > ?"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; title: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual([
            { id: 1, title: 'Update hero copy'   },
            { id: 3, title: 'Migrate to ESM'     },
            { id: 4, title: 'Document /v2/users' },
        ])
    })

    test('docs-extra:select-page/extras-with-count-skips-count-query', async () => {
        // basic-query-structure.md / select-page.md prose: if the EXTRAS
        // argument provides `count`, the count query is NOT executed —
        // the supplied value is used.
        ctx.mockNext([
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
            { id: 3, name: 'Public API',     slug: 'public-api' },
            { id: 4, name: 'Legacy app',     slug: 'legacy' },
        ])

        const page = sync(ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ count: 42 }))

        // Only the data query was fired.
        expect(ctx.history.length).toBe(1)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by id limit ? offset ?"`)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; name: string; slug: string }>
            count: number
        }>>()
        expect(page.count).toBe(42)
    })

    test('docs-extra:select-page/extras-with-data-skips-data-query', async () => {
        // basic-query-structure.md / select-page.md prose: if EXTRAS
        // provides `data`, the data query is NOT executed.
        // Real DB returns whatever count(*) yields; the mock value is
        // ignored when realDbEnabled. Either way the count query was the
        // one that ran (the data query was skipped).
        ctx.mockNext(99)

        const cached = [
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
        ]
        const page = sync(ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ data: cached }))

        // Only the count query was fired.
        expect(ctx.history.length).toBe(1)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select count(*) from project"`)
        expect(page.data).toBe(cached)
        // Mock path returns 99; real path returns the actual count.
        if (ctx.realDbEnabled) {
            expect(typeof page.count).toBe('number')
        } else {
            expect(page.count).toBe(99)
        }
    })

    test('docs-extra:select-page/extras-preserved-on-result', async () => {
        // basic-query-structure.md prose: arbitrary EXTRAS appear on the
        // returned object as additional properties.
        ctx.mockNext([])
        ctx.mockNext(0)

        const page = sync(ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ generatedAt: 'now' as const }))

        assertType<Exact<typeof page, {
            data:        Array<{ id: number; name: string; slug: string }>
            count:       number
            generatedAt: 'now'
        }>>()
        expect(page.generatedAt).toBe('now')
    })

    test('docs-extra:select-page/extras-with-count-and-data-fires-no-query', async () => {
        // basic-query-structure.md / select-page.md prose: when EXTRAS provides
        // BOTH `count` and `data`, NEITHER query runs — the page is assembled
        // from the supplied values alone (the zero-query arm). No mockNext is
        // primed because the runner is never touched.
        const cached = [
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
        ]
        const page = sync(ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ count: 7, data: cached }))

        // No query was fired at all.
        expect(ctx.history.length).toBe(0)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; name: string; slug: string }>
            count: number
        }>>()
        expect(page.data).toBe(cached)
        expect(page.count).toBe(7)
    })
})
