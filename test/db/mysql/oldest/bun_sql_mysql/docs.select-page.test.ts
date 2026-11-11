// Documentation snippets for the "Select page" feature
// (docs/queries/select-page.md). `executeSelectPage()` runs the query
// twice — once with LIMIT/OFFSET for the page, once without for the
// total count — and bundles them into `{ data, count }`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:select-page/projects-paginated', async () => {
        // Only project 1 matches, on both columns; the offset leaves the page
        // empty while the count still sees the matching row.
        ctx.mockNext([])
        ctx.mockNext(1)
        const connection = ctx.conn

        // doc-start
        const projectName = 'M'

        const projectPageWithName = await connection.selectFrom(tProject)
            .where(
                tProject.name.startsWithInsensitive(projectName),
            ).or(
                tProject.slug.startsWithInsensitive(projectName),
            ).select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('name')
            .orderBy('slug')
            .limit(10)
            .offset(20)
            .executeSelectPage()
        // doc-end

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project where lower(name) like concat(lower(?), '%') or lower(slug) like concat(lower(?), '%') order by name, slug limit ? offset ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            "M",
            "M",
            10,
            20,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from project where lower(name) like concat(lower(?), '%') or lower(slug) like concat(lower(?), '%')"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            "M",
            "M",
          ]
        `)
        assertType<Exact<typeof projectPageWithName, {
            data:  Array<{ id: number; name: string; slug: string }>
            count: number
        }>>()
        expect(projectPageWithName).toEqual({ data: [], count: 1 })
    })

    test('docs:select-page/page-number-to-offset', async () => {
        // Section "Limit and offset": page 2 of 3 rows of the 4 seeded projects.
        ctx.mockNext([{ id: 4, name: 'Legacy app' }])
        ctx.mockNext(4)
        const connection = ctx.conn

        // doc-start
        const pageNumber = 2
        const pageSize = 3

        const projectPage = await connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .limit(pageSize)
            .offset((pageNumber - 1) * pageSize)
            .executeSelectPage()

        const totalPages = Math.ceil(projectPage.count / pageSize)
        // doc-end

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id limit ? offset ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
            3,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from project"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectPage, {
            data:  Array<{ id: number; name: string }>
            count: number
        }>>()
        expect(projectPage).toEqual({ data: [{ id: 4, name: 'Legacy app' }], count: 4 })
        expect(totalPages).toBe(2)
    })

    test('docs:select-page/limit-and-offset-if-value', async () => {
        // Section "Limit and offset": the offset has no value, so only the limit is applied.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        ctx.mockNext(4)
        const connection = ctx.conn

        // doc-start
        const paging: { limit?: number, offset?: number } = { limit: 2 }

        const projectPage = await connection.selectFrom(tProject)
            .select({
                id: tProject.id,
            })
            .orderBy('id')
            .limitIfValue(paging.limit)
            .offsetIfValue(paging.offset)
            .executeSelectPage()
        // doc-end

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as id from project order by id limit ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from project"`)
        assertType<Exact<typeof projectPage, {
            data:  Array<{ id: number }>
            count: number
        }>>()
        expect(projectPage).toEqual({ data: expected, count: 4 })
    })

    test('docs:select-page/only-the-rows', async () => {
        // Section "You don't need the total": `executeSelectMany` sends one query.
        const expected = [{ id: 2, name: 'Internal tools' }, { id: 3, name: 'Public API' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projects = await connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .limit(2)
            .offset(1)
            .executeSelectMany()
        // doc-end

        expect(ctx.history.length).toBe(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id limit ? offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof projects, Array<{ id: number; name: string }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:select-page/known-count', async () => {
        // Section "You already know the total": the count given is returned as it is.
        const expected = [{ id: 3, name: 'Public API' }, { id: 4, name: 'Legacy app' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const knownCount = 4

        const projectPage = await connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .limit(2)
            .offset(2)
            .executeSelectPage({ count: knownCount })
        // doc-end

        expect(ctx.history.length).toBe(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id limit ? offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            2,
          ]
        `)
        assertType<Exact<typeof projectPage, {
            data:  Array<{ id: number; name: string }>
            count: number
        }>>()
        expect(projectPage).toEqual({ data: expected, count: 4 })
    })

    test('docs:select-page/only-the-total', async () => {
        // Section "You only need the total": with `data`, only the count query is sent, and
        // the order by, the limit and the offset of the same query aren't used.
        ctx.mockNext(4)
        const connection = ctx.conn

        // doc-start
        const projects: { id: number, name: string }[] = [] // Or the rows you already have

        const projectPage = await connection.selectFrom(tProject)
            .select({
                id: tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .limit(10)
            .offset(20)
            .executeSelectPage({ data: projects })
        // doc-end

        expect(ctx.history.length).toBe(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) from project"`)
        assertType<Exact<typeof projectPage, { data: { id: number, name: string }[], count: number }>>()
        expect(projectPage).toEqual({ data: [], count: 4 })
    })

    test('docs:select-page/extra-properties', async () => {
        // Section "Extra properties": they arrive in the result next to `data` and `count`.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        ctx.mockNext(4)
        const connection = ctx.conn

        // doc-start
        const pageNumber = 1
        const pageSize = 2

        const projectPage = await connection.selectFrom(tProject)
            .select({
                id: tProject.id,
            })
            .orderBy('id')
            .limit(pageSize)
            .offset((pageNumber - 1) * pageSize)
            .executeSelectPage({ pageNumber, pageSize })
        // doc-end

        expect(ctx.history.length).toBe(2)
        assertType<Exact<typeof projectPage, {
            data:       Array<{ id: number }>
            count:      number
            pageNumber: number
            pageSize:   number
        }>>()
        expect(projectPage).toEqual({ data: expected, count: 4, pageNumber: 1, pageSize: 2 })
    })

    test('docs:select-page/group-by', async () => {
        // Section "What the total counts": the count is the number of groups. The 4 seeded
        // issues have 3 different statuses.
        const expected = [{ status: 'closed', issues: 1 }, { status: 'in_progress', issues: 1 }]
        ctx.mockNext(expected)
        ctx.mockNext(3)
        const connection = ctx.conn

        // doc-start
        const issuesByStatus = await connection.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                issues: connection.countAll(),
            })
            .groupBy('status')
            .orderBy('status')
            .limit(2)
            .executeSelectPage()
        // doc-end

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select status as status, count(*) as issues from issue group by status order by status limit ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from (select status as status, count(*) as issues from issue group by status) as result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesByStatus, {
            data:  Array<{ status: string; issues: number }>
            count: number
        }>>()
        expect(issuesByStatus).toEqual({ data: expected, count: 3 })
    })

    test('docs:select-page/compound-select', async () => {
        // Section "What the total counts": the limit applies to the combined result and
        // the count is the number of combined rows: 2 organizations + 4 projects.
        const expected = [{ name: 'Acme Corp' }, { name: 'Globex Ltd' }, { name: 'Internal tools' }]
        ctx.mockNext(expected)
        ctx.mockNext(6)
        const connection = ctx.conn

        // doc-start
        const namesPage = await connection.selectFrom(tOrganization)
            .select({
                name: tOrganization.name,
            }).union(
                connection.selectFrom(tProject)
                .select({
                    name: tProject.name,
                }),
            )
            .orderBy('name')
            .limit(3)
            .executeSelectPage()
        // doc-end

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select name as name from organization union select name as name from project order by name limit ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from (select name as name from organization union select name as name from project) as result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof namesPage, {
            data:  Array<{ name: string }>
            count: number
        }>>()
        expect(namesPage).toEqual({ data: expected, count: 6 })
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

        const page = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage()

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

        const page = await ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ count: 42 })

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
        const page = await ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ data: cached })

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

        const page = await ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ generatedAt: 'now' as const })

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
        const page = await ctx.conn.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('id')
            .limit(10)
            .offset(0)
            .executeSelectPage({ count: 7, data: cached })

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
