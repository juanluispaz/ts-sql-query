// Documentation snippets for the Extreme dynamic queries page
// (docs/queries/extreme-dynamic-queries.md). Covers the most advanced
// dynamic patterns: dynamicConditionFor, dynamicPick/dynamicPickPaths,
// allowWhen/disallowWhen, optional joins with dynamic picks, and the
// nested complex projection variants of those.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, type DynamicCondition } from '../../../../../src/dynamicCondition.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:extreme-dynamic-queries/dynamic-condition-for', async () => {
        const connection = ctx.conn

        // doc-start
        const selectFields = {
            id:    tProject.id,
            name:  tProject.name,
            slug:  tProject.slug,
        }

        type FilterType = DynamicCondition<{
            id:   'int',
            name: 'string',
            slug: 'string',
        }>

        const filter: FilterType = {
            or: [
                { name: { containsInsensitive: 'tools' } },
                { slug: { startsWithInsensitive: 'mktg' } },
            ],
        }

        const dynamicWhere = connection.dynamicConditionFor(selectFields).withValues(filter)

        const rows = await connection.selectFrom(tProject)
            .where(dynamicWhere)
            .select(selectFields)
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, slug as slug from project where lower(\`name\`) like concat('%', lower(?), '%') or lower(slug) like concat(lower(?), '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "tools",
            "mktg",
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:   number
            name: string
            slug: string
        }>>>()
        if (ctx.realDbEnabled) {
            expect(rows.map(r => r.id).sort()).toEqual([1, 2])
        }
    })

    test('docs:extreme-dynamic-queries/dynamic-pick', async () => {
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            name:  tProject.name,
            slug:  tProject.slug,
        }

        const fieldsToPick = {
            name: true,
        }

        const pickedFields = dynamicPick(availableFields, fieldsToPick)

        const rows = await connection.selectFrom(tProject)
            .select({
                ...pickedFields,
                id: tProject.id,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as \`name\`, id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:    number
            name?: string
            slug?: string
        }>>>()
        if (ctx.realDbEnabled) {
            for (const r of rows) {
                expect(typeof r.name).toBe('string')
                expect(r.slug).toBeUndefined()
            }
        }
    })

    test('docs:extreme-dynamic-queries/dynamic-pick-paths', async () => {
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id:    tProject.id,
            name:  tProject.name,
            slug:  tProject.slug,
        }

        const fieldsToPickList = ['name' as const, 'slug' as const]
        const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList, ['id'])

        const rows = await connection.selectFrom(tProject)
            .select(pickedFields)
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, slug as slug from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:    number
            name?: string
            slug?: string
        }>>>()
        if (ctx.realDbEnabled) {
            for (const r of rows) {
                expect(typeof r.id).toBe('number')
                expect(typeof r.name).toBe('string')
                expect(typeof r.slug).toBe('string')
            }
        }
    })

    test('docs:extreme-dynamic-queries/optional-inner-join-with-pick', async () => {
        const connection = ctx.conn

        // doc-start: when the picked fields don't include any column from
        // the optional-inner-joined table, the join itself is dropped.
        const availableFields = {
            id:               tProject.id,
            name:             tProject.name,
            organizationName: tOrganization.name,
        }

        const fieldsToPick = {
            name: true,
        }

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const rows = await connection.selectFrom(tProject)
            .optionalInnerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select(pickedFields)
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        // No org column requested → no join emitted.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:                number
            name?:             string
            organizationName?: string
        }>>>()
    })

    test('docs:extreme-dynamic-queries/optional-inner-join-with-pick-includes-join', async () => {
        const connection = ctx.conn

        const availableFields = {
            id:               tProject.id,
            name:             tProject.name,
            organizationName: tOrganization.name,
        }

        // doc-start: when at least one column from the optional-inner-joined
        // table IS picked, the join is emitted.
        const fieldsToPick = {
            name: true,
            organizationName: true,
        }

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const rows = await connection.selectFrom(tProject)
            .optionalInnerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select(pickedFields)
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.\`name\` as \`name\`, \`organization\`.\`name\` as organizationName from project inner join \`organization\` on \`organization\`.id = project.organization_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:                number
            name?:             string
            organizationName?: string
        }>>>()
        if (ctx.realDbEnabled) {
            const acmeProjects = rows.filter(r => r.organizationName === 'Acme Corp')
            expect(acmeProjects.length).toBeGreaterThan(0)
        }
    })

    test('docs:extreme-dynamic-queries/allow-when-not-picked', async () => {
        const connection = ctx.conn

        // doc-start: column gated by allowWhen but NOT picked → no error.
        const bodyVisible = false

        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body.allowWhen(bodyVisible, "You don't have permission to see body"),
        }

        const fieldsToPick = {
            title: true,
        }

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const rows = await connection.selectFrom(tIssue)
            .select(pickedFields)
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:     number
            title?: string
            body?:  string
        }>>>()
    })

    test('docs:extreme-dynamic-queries/allow-when-picked-throws', async () => {
        const connection = ctx.conn

        // doc-start: same column but now PICKED while disallowed → error.
        const bodyVisible = false

        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body.allowWhen(bodyVisible, "You don't have permission to see body"),
        }

        const fieldsToPick = {
            title: true,
            body:  true,
        }

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        let caught: unknown = null
        try {
            await connection.selectFrom(tIssue)
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        // doc-end

        expect(caught).not.toBeNull()
        expect(String(caught)).toContain("You don't have permission to see body")
    })

    test('docs:extreme-dynamic-queries/disallow-when-picked-throws', async () => {
        const connection = ctx.conn

        // disallowWhen is the boolean-inverted twin of allowWhen.
        const bodyHidden = true

        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body.disallowWhen(bodyHidden, 'body hidden'),
        }

        const pickedFields = dynamicPick(availableFields, { body: true }, ['id'])

        let caught: unknown = null
        try {
            await connection.selectFrom(tIssue)
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()
        } catch (e) {
            caught = e
        }

        expect(caught).not.toBeNull()
        expect(String(caught)).toContain('body hidden')
    })

    test('docs:extreme-dynamic-queries/dynamic-condition-nested-projection', async () => {
        const connection = ctx.conn

        // doc-start: dynamicConditionFor handles nested projection shapes —
        // a key on the filter that mirrors the nested projection drives a
        // condition on the corresponding column.
        const assignee = tAppUser.forUseInLeftJoin()

        const selectFields = {
            id:    tIssue.id,
            title: tIssue.title,
            assignee: {
                id:       assignee.id,
                fullName: assignee.fullName,
            },
        }

        type FilterType = DynamicCondition<{
            id: 'int',
            title: 'string',
            assignee: {
                id: 'int',
                fullName: 'string',
            },
        }>

        const filter: FilterType = {
            assignee: { fullName: { containsInsensitive: 'Ada' } },
        }

        const where = connection.dynamicConditionFor(selectFields).withValues(filter)

        const rows = await connection.selectFrom(tIssue)
            .leftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .where(where)
            .select(selectFields)
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, app_user.id as \`assignee.id\`, app_user.full_name as \`assignee.fullName\` from issue left join app_user on app_user.id = issue.assignee_id where lower(app_user.full_name) like concat('%', lower(?), '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Ada",
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:    number
            title: string
            assignee?: { id: number; fullName: string }
        }>>>()
        if (ctx.realDbEnabled) {
            for (const r of rows) {
                expect(r.assignee?.fullName).toContain('Ada')
            }
        }
    })
})
