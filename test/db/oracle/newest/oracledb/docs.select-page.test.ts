// Documentation snippets for the "Select page" feature
// (docs/queries/select-page.md). `executeSelectPage()` runs the query
// twice — once with LIMIT/OFFSET for the page, once without for the
// total count — and bundles them into `{ data, count }`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

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
        const page = await connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('name')
            .limit(10)
            .offset(0)
            .executeSelectPage()
        // doc-end

        // executeSelectPage runs two queries: first the data page, then
        // the unpaginated count. We assert both via ctx.history.
        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select id as "id", name as "name", slug as "slug" from project order by "name" offset :0 rows fetch next :1 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            0,
            10,
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
})
