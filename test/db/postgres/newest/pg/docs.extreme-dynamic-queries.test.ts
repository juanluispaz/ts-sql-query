// Documentation snippets for the Extreme dynamic queries page (docs/queries/extreme-dynamic-queries.md):
// the short examples that lead to the pages of docs/dynamic.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPickPaths } from '../../../../../src/dynamic/pick.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:extreme-dynamic-queries/a-filter-as-data', async () => {
        const expected = [{ id: 1, name: 'Marketing site', slug: 'mktg-site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const filter = {
            or: [
                { name: { startsWithInsensitive: 'Mark' } },
                { slug: { containsInsensitive: 'mktg' } }
            ]
        }

        const projects = await connection.selectFrom(tProject)
            .where(connection.dynamicConditionFor({
                name: tProject.name,
                slug: tProject.slug
            }).withValues(filter))
            .select({
                id: tProject.id,
                name: tProject.name,
                slug: tProject.slug
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project where name ilike ($1 || '%') or slug ilike ('%' || $2 || '%')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Mark",
            "mktg",
          ]
        `)
        assertType<Exact<typeof projects, Array<{ id: number, name: string, slug: string }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:extreme-dynamic-queries/picked-columns', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id: tIssue.id,
            title: tIssue.title,
            status: tIssue.status
        }

        const issues = await connection.selectFrom(tIssue)
            .select(dynamicPickPaths(availableFields, ['title'], ['id']))
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number, title?: string, status?: string }>>>()
        expect(issues).toEqual(expected)
    })
})
