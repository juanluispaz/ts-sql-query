// Documentation snippets for the Picking columns dynamically page (docs/dynamic/caller-decides/picks.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, type DynamicPickPaths } from '../../../../../src/dynamic/pick.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:picks/dynamic-pick', async () => {
        const expected = [
            { name: 'Marketing site', slug: 'mktg-site',  id: 1 },
            { name: 'Internal tools', slug: 'tools',      id: 2 },
            { name: 'Public API',     slug: 'public-api', id: 3 },
            { name: 'Legacy app',     slug: 'legacy',     id: 4 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            name:       tProject.name,
            slug:       tProject.slug,
            archivedAt: tProject.archivedAt,
        }

        const fieldsToPick = {
            name: true,
            slug: true,
        }

        const pickedFields = dynamicPick(availableFields, fieldsToPick)

        const projectsWithIdPicking = await connection.selectFrom(tProject)
            .select({
                ...pickedFields,
                id: tProject.id, // always include the id field in the result
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as name, slug as slug, id as id from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectsWithIdPicking, Array<{
            id:          number
            name?:       string
            slug?:       string
            archivedAt?: Date
        }>>>()
        // The query has no order by.
        expect([...projectsWithIdPicking].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs-extra:picks/dynamic-pick-paths', async () => {
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

    test('docs-extra:picks/dynamic-pick-with-required-keys', async () => {
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
    })

    test('docs:picks/fields-from-query-string', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const req = { query: { fields: 'title,notAColumn' } }

        // doc-start
        const availableFields = {
            id:     tIssue.id,
            title:  tIssue.title,
            status: tIssue.status,
        }

        type IssueField = DynamicPickPaths<typeof availableFields, 'id'>

        const isIssueField = (field: string): field is IssueField => field in availableFields
        const requestedFields = req.query.fields.split(',').filter(isIssueField)

        const issues = await connection.selectFrom(tIssue)
            .select(dynamicPickPaths(availableFields, requestedFields, ['id']))
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:      number
            title?:  string
            status?: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs-extra:picks/order-by-a-column-not-picked-throws', () => {
        const connection = ctx.conn
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
        }

        expect(() => connection.selectFrom(tIssue)
            .select(dynamicPick(availableFields, {}, ['id']))
            .orderByFromString('title desc')
        ).toThrow('ORDER_BY_COLUMN_NOT_IN_SELECT')
    })

    test('docs:picks/optional-inner-join-with-pick', async () => {
        const expected = [{ id: 1, name: 'Marketing site', slug: 'mktg-site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id:               tProject.id,
            name:             tProject.name,
            slug:             tProject.slug,
            archivedAt:       tProject.archivedAt,
            organizationId:   tOrganization.id,
            organizationName: tOrganization.name,
        }

        const fieldsToPick = {
            name: true,
            slug: true,
        }

        // always include id field as required
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const projectWithOptionalOrganization = await connection.selectFrom(tProject)
            .optionalInnerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select(pickedFields)
            .where(tProject.id.equals(1))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectWithOptionalOrganization, Array<{
            id:                number
            name?:             string
            slug?:             string
            archivedAt?:       Date
            organizationId?:   number
            organizationName?: string
        }>>>()
        expect(projectWithOptionalOrganization).toEqual(expected)
    })

    test('docs:picks/optional-inner-join-with-pick-includes-join', async () => {
        const expected = [{ id: 1, name: 'Marketing site', slug: 'mktg-site', organizationName: 'Acme Corp' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id:               tProject.id,
            name:             tProject.name,
            slug:             tProject.slug,
            archivedAt:       tProject.archivedAt,
            organizationId:   tOrganization.id,
            organizationName: tOrganization.name,
        }

        // CHANGED: fieldsToPick requiring more information
        const fieldsToPick = {
            name:             true,
            slug:             true,
            organizationName: true,
        }

        // always include id field as required
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const projectWithOptionalOrganization = await connection.selectFrom(tProject)
            .optionalInnerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select(pickedFields)
            .where(tProject.id.equals(1))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, organization.name as "organizationName" from project inner join organization on organization.id = project.organization_id where project.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectWithOptionalOrganization, Array<{
            id:                number
            name?:             string
            slug?:             string
            archivedAt?:       Date
            organizationId?:   number
            organizationName?: string
        }>>>()
        expect(projectWithOptionalOrganization).toEqual(expected)
    })

    test('docs:picks/dynamic-pick-complex-projection', async () => {
        const expected = [{ id: 1, name: { projectName: 'Marketing site', projectSlug: 'mktg-site' } }]
        ctx.mockNext([{ 'id': 1, 'name.projectName': 'Marketing site', 'name.projectSlug': 'mktg-site' }])
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id: tProject.id,
            name: {
                projectName: tProject.name,
                projectSlug: tProject.slug,
            },
            archivedAt: tProject.archivedAt,
            organization: {
                id:   tOrganization.id,
                name: tOrganization.name,
            },
        }

        const fieldsToPick = {
            name: {
                projectName: true,
                projectSlug: true,
            },
        }

        // include allways id field as required
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const projectWithOptionalOrganization = await connection.selectFrom(tProject)
            .optionalInnerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select(pickedFields)
            .where(tProject.id.equals(1))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as "name.projectName", slug as "name.projectSlug" from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectWithOptionalOrganization, Array<{
            id: number
            name?: {
                projectName?: string
                projectSlug?: string
            }
            archivedAt?: Date
            organization?: {
                id?:   number
                name?: string
            }
        }>>>()
        expect(projectWithOptionalOrganization).toEqual(expected)
    })

    test('docs:picks/dynamic-pick-complex-projection-with-join', async () => {
        const expected = [{
            id:           1,
            name:         { projectName: 'Marketing site', projectSlug: 'mktg-site' },
            organization: { name: 'Acme Corp' },
        }]
        ctx.mockNext([{ 'id': 1, 'name.projectName': 'Marketing site', 'name.projectSlug': 'mktg-site', 'organization.name': 'Acme Corp' }])
        const connection = ctx.conn

        // doc-start
        const availableFields = {
            id: tProject.id,
            name: {
                projectName: tProject.name,
                projectSlug: tProject.slug,
            },
            archivedAt: tProject.archivedAt,
            organization: {
                id:   tOrganization.id,
                name: tOrganization.name,
            },
        }

        // CHANGED: fieldsToPick requiring more information
        const fieldsToPick = {
            name: {
                projectName: true,
                projectSlug: true,
            },
            organization: {
                name: true,
            },
        }

        // include allways id field as required
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const projectWithOptionalOrganization = await connection.selectFrom(tProject)
            .optionalInnerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select(pickedFields)
            .where(tProject.id.equals(1))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as "name.projectName", project.slug as "name.projectSlug", organization.name as "organization.name" from project inner join organization on organization.id = project.organization_id where project.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectWithOptionalOrganization, Array<{
            id: number
            name?: {
                projectName?: string
                projectSlug?: string
            }
            archivedAt?: Date
            organization?: {
                id?:   number
                name?: string
            }
        }>>>()
        expect(projectWithOptionalOrganization).toEqual(expected)
    })
})
