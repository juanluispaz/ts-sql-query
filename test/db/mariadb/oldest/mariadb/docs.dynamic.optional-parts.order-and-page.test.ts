// Documentation snippets for the Order and page from a request page (docs/dynamic/optional-parts/order-and-page.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:order-and-page/order-by-from-string', async () => {
        // Section "Order by from a string".
        const expected = [
            { id: 3, name: 'Public API',     slug: 'public-api' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 4, name: 'Legacy app',     slug: 'legacy' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const orderBy = 'name desc, slug insensitive'

        const projects = await connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderByFromString(orderBy)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by name desc, lower(slug)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projects, Array<{
            id:   number
            name: string
            slug: string
        }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:order-and-page/order-by-from-string-error', async () => {
        // Section "Errors of the order": thrown by the call, while the query is being written.
        const connection = ctx.conn
        let column: string | undefined

        // doc-start
        const orderBy: string = 'name sideways'

        try {
            await connection.selectFrom(tProject)
                .select({
                    id:   tProject.id,
                    name: tProject.name,
                })
                .orderByFromString(orderBy)
                .executeSelectMany()
        } catch (e) {
            if (e instanceof TsSqlError && (e.errorReason.reason === 'ORDER_BY_COLUMN_NOT_IN_SELECT' || e.errorReason.reason === 'INVALID_ORDER_BY_ORDERING')) {
                column = e.errorReason.column
            } else {
                throw e
            }
        }
        // doc-end

        expect(column).toBe('name')
        expect(ctx.lastSql).toBe('')
    })

    test('docs:order-and-page/limit-and-offset-if-value', async () => {
        // Section "Optional limit and offset". Seed: only the issue 3 has ESM in the title.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const request: { title?: string, orderBy?: string, limit?: number, offset?: number } = { title: 'ESM', limit: 10 }

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.title.containsIfValue(request.title))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderByFromStringIfValue(request.orderBy)
            .limitIfValue(request.limit)
            .offsetIfValue(request.offset)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where title like concat('%', ?, '%') limit ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ESM",
            10,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })
})
