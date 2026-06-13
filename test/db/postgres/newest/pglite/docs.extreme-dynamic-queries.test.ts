// Documentation snippets for the Extreme dynamic queries page
// (docs/queries/extreme-dynamic-queries.md). Covers the most advanced
// dynamic patterns: dynamicConditionFor, dynamicPick/dynamicPickPaths,
// allowWhen/disallowWhen, optional joins with dynamic picks, and the
// nested complex projection variants of those.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { type DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { dynamicPick, dynamicPickPaths } from '../../../../../src/dynamic/pick.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:extreme-dynamic-queries/dynamic-condition-for', async () => {
        ctx.mockNext([
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project where name ilike ('%' || $1 || '%') or slug ilike ($2 || '%') order by id"`)
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
        // name ilike '%tools%' → Internal tools (2); slug ilike 'mktg%' → mktg-site (1)
        expect(rows).toEqual([
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
        ])
    })

    test('docs:extreme-dynamic-queries/dynamic-pick', async () => {
        ctx.mockNext([
            { name: 'Marketing site', id: 1 },
            { name: 'Internal tools', id: 2 },
            { name: 'Public API', id: 3 },
            { name: 'Legacy app', id: 4 },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as name, id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:    number
            name?: string
            slug?: string
        }>>>()
        // Only `name` (and the explicit `id`) are selected; `slug` is unpicked.
        expect(rows).toEqual([
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.name as "organizationName" from project inner join organization on organization.id = project.organization_id order by id"`)
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
        ctx.mockNext([
            { id: 1, title: 'Update hero copy', 'assignee.id': 1, 'assignee.fullName': 'Ada Lovelace' },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, app_user.id as "assignee.id", app_user.full_name as "assignee.fullName" from issue left join app_user on app_user.id = issue.assignee_id where app_user.full_name ilike ('%' || $1 || '%') order by id"`)
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
        // Only issue 1's assignee (Ada Lovelace) matches the ilike '%Ada%' filter.
        expect(rows).toEqual([
            { id: 1, title: 'Update hero copy', assignee: { id: 1, fullName: 'Ada Lovelace' } },
        ])
    })

    test('docs-extra:extreme-dynamic-queries/dynamic-condition-nested-and-or', async () => {
        // Page sections "Complex dynamic boolean expressions" + "Select
        // using a dynamic filter" — the filter object accepts nested
        // `and`/`or` arrays for arbitrarily complex predicates.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const selectFields = {
            id:   tProject.id,
            name: tProject.name,
            slug: tProject.slug,
        }

        const filter: DynamicCondition<{
            id:   'int',
            name: 'string',
            slug: 'string',
        }> = {
            and: [
                { name: { containsInsensitive: 'mark' } },
                { or: [
                    { slug: { startsWith: 'mktg' } },
                    { slug: { startsWith: 'tools' } },
                ] },
            ],
        }

        const where = connection.dynamicConditionFor(selectFields).withValues(filter)

        const rows = await connection.selectFrom(tProject)
            .where(where)
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where name ilike ('%' || $1 || '%') and (slug like ($2 || '%') or slug like ($3 || '%')) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "mark",
            "mktg",
            "tools",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
    })

    test('docs-extra:extreme-dynamic-queries/dynamic-pick-with-required-keys', async () => {
        // Section "Select dynamically picking columns" — `dynamicPick`
        // accepts a third argument with always-included keys. These
        // appear in the projected shape even when the user didn't pick
        // them.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const availableFields = {
            id:   tProject.id,
            name: tProject.name,
            slug: tProject.slug,
        }
        // The user picked only `name`; `id` is always included because it is
        // passed as an always-required key (the third argument), even though
        // it was not picked. `slug` is available but neither picked nor
        // required, so it is dropped.
        const fields = dynamicPick(availableFields, { name: true }, ['id'])

        const rows = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select(fields)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name?: string; slug?: string }>>>()
        expect(rows).toEqual(expected)
        // Used to keep imports active.
        void tAppUser
        void tOrganization
        void dynamicPickPaths
    })
})
