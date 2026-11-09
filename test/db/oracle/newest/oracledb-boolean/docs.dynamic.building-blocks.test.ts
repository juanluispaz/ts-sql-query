// Documentation snippets for the Dynamic query building blocks page (docs/dynamic/building-blocks.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { type DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPickPaths, type PickValuesPath } from '../../../../../src/dynamic/pick.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:building-blocks/a-condition-that-may-not-apply', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const title: string | null = null

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.title.containsIfValue(title))
            .select({
                id: tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{ id: number, title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:building-blocks/order-and-page-from-a-request', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const request: { title?: string, order?: string, limit?: number, offset?: number } = { title: 'e', order: 'title desc', limit: 2 }

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.title.containsIfValue(request.title))
            .select({
                id: tIssue.id,
                title: tIssue.title,
            })
            .orderByFromStringIfValue(request.order)
            .limitIfValue(request.limit)
            .offsetIfValue(request.offset)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue where title like ('%' || :0 || '%') escape '\\' order by "title" desc fetch next :1 rows only"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "e",
            2,
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number, title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:building-blocks/the-filter-from-a-request', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const filterableFields = {
            title: tIssue.title,
            body: tIssue.body,
        }

        const projectOfTheUser = 1
        const filter: DynamicCondition<typeof filterableFields> = {
            or: [
                { title: { startsWithInsensitive: 'Update' } },
                { body: { containsInsensitive: 'tokens' } },
            ],
        }

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(projectOfTheUser))
            .and(connection.dynamicConditionFor(filterableFields).withValues(filter))
            .select({
                id: tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue where project_id = :0 and (lower(title) like lower(:1 || '%') escape '\\' or lower("body") like lower('%' || :2 || '%') escape '\\') order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "Update",
            "tokens",
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number, title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:building-blocks/picked-columns-without-the-join', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id: tIssue.id,
            title: tIssue.title,
            body: tIssue.body,
            projectName: tProject.name,
        }

        const issues = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(2))
            .select(dynamicPickPaths(availableFields, ['title'], ['id']))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(issues).toEqual(expected)
    })

    test('docs:building-blocks/picked-columns-with-the-join', async () => {
        const expected = [{ id: 2, projectName: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id: tIssue.id,
            title: tIssue.title,
            body: tIssue.body,
            projectName: tProject.name,
        }

        const issues = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(2))
            .select(dynamicPickPaths(availableFields, ['projectName'], ['id']))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", project.name as "projectName" from issue join project on project.id = issue.project_id where issue.id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(issues).toEqual(expected)
    })

    test('docs:building-blocks/a-function-whose-result-is-what-was-asked-for', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id: tIssue.id,
            title: tIssue.title,
            body: tIssue.body,
            projectName: tProject.name,
        }

        type IssueFields = DynamicPickPaths<typeof availableFields, 'id'>
        type IssueFilter = DynamicCondition<typeof availableFields>

        async function getIssues<FIELDS extends IssueFields>(fields: FIELDS[], filter: IssueFilter, order?: string): Promise<PickValuesPath<typeof availableFields, FIELDS | 'id'>[]> {
            const issues = await connection.selectFrom(tIssue)
                .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                .where(connection.dynamicConditionFor(availableFields).withValues(filter))
                .select(dynamicPickPaths(availableFields, fields, ['id']))
                .orderByFromStringIfValue(order)
                .executeSelectMany()

            return expandTypeFromDynamicPickPaths(availableFields, fields, issues, ['id'])
        }

        const issues = await getIssues(['title'], { title: { startsWith: 'Redesign' } })
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue where title like (:0 || '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Redesign",
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number, title: string }>>>()
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
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
