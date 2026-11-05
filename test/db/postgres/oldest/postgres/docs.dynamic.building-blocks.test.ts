// Documentation snippets for the Dynamic query building blocks page (docs/dynamic/building-blocks.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:building-blocks/contains-if-value', async () => {
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const nameContains: string | null | undefined = 'site'

        const projects = await connection.selectFrom(tProject)
            .where(tProject.name.containsIfValue(nameContains)) // dropped entirely when nameContains is absent
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where name like ('%' || $1 || '%')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "site",
          ]
        `)
        assertType<Exact<typeof projects, Array<{ id: number; name: string }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:building-blocks/only-when', async () => {
        const expected = [
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const restrictToMyOrganization = true
        const myOrganizationId = 2

        const projects = await connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(myOrganizationId).onlyWhen(restrictToMyOrganization))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where organization_id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof projects, Array<{ id: number; name: string }>>>()
        expect(projects.toSorted((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs:building-blocks/dynamic-boolean-expression-using', async () => {
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const nameContains: string | null | undefined = 'site'
        const slugContains: string | null | undefined = null

        let dynamicWhere = connection.dynamicBooleanExpressionUsing(tProject)
        dynamicWhere = dynamicWhere.and(tProject.name.containsIfValue(nameContains))
        dynamicWhere = dynamicWhere.or(tProject.slug.containsIfValue(slugContains))

        const projects = await connection.selectFrom(tProject)
            .where(dynamicWhere)
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where name like ('%' || $1 || '%')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "site",
          ]
        `)
        assertType<Exact<typeof projects, Array<{ id: number; name: string }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:building-blocks/only-when-or-null', async () => {
        const expected = { id: 1, name: 'Marketing site', slug: 'mktg-site' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const displayNames = true

        const project = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name.onlyWhenOrNull(displayNames), // null when displayNames is false
                slug: tProject.slug.onlyWhenOrNull(displayNames),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof project, { id: number; name?: string; slug?: string }>>()
        expect(project).toEqual(expected)
    })

    test('docs:building-blocks/optional-join', async () => {
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const organizationName: string | null | undefined = undefined

        const projects = await connection.selectFrom(tProject)
            .optionalJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId)) // omitted when tOrganization is unused
            .where(tOrganization.name.equalsIfValue(organizationName))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projects, Array<{ id: number; name: string }>>>()
        expect(projects.toSorted((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs:building-blocks/order-limit-offset-if-value', async () => {
        const expected = [
            { id: 4, title: 'Document /v2/users', body: 'See ADR-014' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 2, title: 'Redesign navbar', body: 'Use new tokens' },
            { id: 1, title: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const orderBy: string | null | undefined = 'title insensitive, body asc nulls last'
        const max: number | null | undefined = 20
        const skip: number | null | undefined = undefined

        const issues = await connection.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title, body: tIssue.body })
            .orderByFromStringIfValue(orderBy)
            .limitIfValue(max)   // applied only when max is present
            .offsetIfValue(skip) // skipped here: skip is undefined
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, body as body from issue order by lower(title), body asc nulls last limit $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            20,
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number; title: string; body?: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:building-blocks/set-if-value', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const newTitle: string | null | undefined = 'Update hero copy (revised)'
            const newCreatedAt: Date | null | undefined = undefined

            const updatedRows = await connection.update(tIssue)
                .setIfValue({
                    title:     newTitle,    // set
                    createdAt: newCreatedAt, // skipped: undefined
                })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Update hero copy (revised)",
                1,
              ]
            `)
            assertType<Exact<typeof updatedRows, number>>()
            expect(updatedRows).toBe(1)
        })
    })
})
