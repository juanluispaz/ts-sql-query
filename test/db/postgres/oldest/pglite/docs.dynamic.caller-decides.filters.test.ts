// Documentation snippets for the Dynamic filters page (docs/dynamic/caller-decides/filters.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { type DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:filters/dynamic-condition-for', async () => {
        const expected = [{ id: 1, name: 'Marketing site', slug: 'mktg-site', organizationName: 'Acme Corp' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const selectFields = {
            id:               tProject.id,
            name:             tProject.name,
            slug:             tProject.slug,
            archivedAt:       tProject.archivedAt,
            organizationName: tOrganization.name,
        }

        type FilterType = DynamicCondition<{
            id:               'int',
            name:             'string',
            slug:             'string',
            archivedAt:       'localDateTime',
            organizationName: 'string',
        }>

        const filter: FilterType = {
            or: [
                { name: { startsWithInsensitive: 'Mark' } },
                { slug: { startsWithInsensitiveIfValue: 'mktg', endsWith: 'site' } },
            ],
            organizationName: { equals: 'Acme Corp' },
        }

        const dynamicWhere = connection.dynamicConditionFor(selectFields).withValues(filter)

        const projectsWithDynamicCondition = await connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tProject.organizationId.equals(tOrganization.id))
            .where(dynamicWhere)
            .select(selectFields)
            .orderBy('name', 'insensitive')
            .orderBy('slug', 'asc insensitive')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, project.archived_at as "archivedAt", organization.name as "organizationName" from project inner join organization on project.organization_id = organization.id where (project.name ilike ($1 || '%') or (project.slug ilike ($2 || '%') and project.slug like ('%' || $3))) and organization.name = $4 order by lower(project.name), lower(project.slug) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Mark",
            "mktg",
            "site",
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof projectsWithDynamicCondition, Array<{
            id:               number
            name:             string
            slug:             string
            organizationName: string
            archivedAt?:      Date
        }>>>()
        expect(projectsWithDynamicCondition).toEqual(expected)
    })

    test('docs-extra:filters/empty-values-in-a-filter-add-no-condition', () => {
        const connection = ctx.conn
        const sql = (json: string) => connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor({ id: tIssue.id, title: tIssue.title }).withValues(JSON.parse(json)))
            .select({ id: tIssue.id })
            .query()
        const noCondition = connection.selectFrom(tIssue).select({ id: tIssue.id }).query()

        expect(sql('{"id":{"equals":null}}')).toBe(noCondition)
        expect(sql('{"id":{"in":[]}}')).toBe(noCondition)
        expect(sql('{"id":{"notIn":[]}}')).toBe(noCondition)
        expect(sql('{"id":{"in":null}}')).toBe(noCondition)
        expect(sql('{"id":null}')).toBe(noCondition)
        expect(sql('{"title":{"contains":""}}')).toBe(noCondition)
        expect(sql('{"id":{"equalsIfValue":null}}')).toBe(noCondition)
    })

    test('docs-extra:filters/a-dto-with-nulls-keeps-its-value', () => {
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor({ id: tIssue.id }).withValues(JSON.parse('{"id":{"equals":1,"notEquals":null,"in":null}}')))
            .select({ id: tIssue.id })
        expect(query.query()).toMatchInlineSnapshot(`"select id as id from issue where id = $1"`)
        expect(query.params()).toEqual([1])
    })

    test('docs-extra:filters/asking-for-null-in-a-filter', () => {
        const connection = ctx.conn
        const sql = (json: string) => connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor({ body: tIssue.body }).withValues(JSON.parse(json)))
            .select({ id: tIssue.id })
            .query()
        expect(sql('{"body":{"isNull":true}}')).toMatchInlineSnapshot(`"select id as id from issue where body is null"`)
        expect(sql('{"body":{"is":null}}')).toMatchInlineSnapshot(`"select id as id from issue where body is not distinct from $1"`)
    })

    test('docs-extra:filters/a-value-of-another-shape-is-tolerated', () => {
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor({ id: tIssue.id }).withValues(JSON.parse('{"id":{"in":5}}')))
            .select({ id: tIssue.id })
        expect(query.query()).toMatchInlineSnapshot(`"select id as id from issue where id in ($1)"`)
        expect(query.params()).toEqual([5])
    })

    test('docs-extra:filters/an-empty-filter-can-not-remove-your-conditions', () => {
        const connection = ctx.conn
        const empty = () => connection.dynamicConditionFor({ id: tIssue.id }).withValues(JSON.parse('{"id":{"equals":null}}'))

        expect(connection.deleteFrom(tIssue).where(empty()).and(tIssue.projectId.equals(1)).query())
            .toMatchInlineSnapshot(`"delete from issue where project_id = $1"`)
        expect(connection.update(tIssue).set({ title: 'x' }).where(empty()).and(tIssue.projectId.equals(1)).query())
            .toMatchInlineSnapshot(`"update issue set title = $1 where project_id = $2"`)
    })

    test('docs-extra:filters/a-delete-with-only-an-empty-filter-is-rejected', async () => {
        const connection = ctx.conn
        const empty = connection.dynamicConditionFor({ id: tIssue.id }).withValues(JSON.parse('{"id":{"equals":null}}'))
        let caught: unknown
        try {
            await connection.deleteFrom(tIssue).where(empty).executeDelete()
        } catch (e) {
            caught = e
        }
        expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MISSING_WHERE')
    })

    test('docs-extra:filters/dynamic-condition-nested-and-or', async () => {
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
        expect(rows).toEqual(expected)
    })

    test('docs-extra:filters/filter-from-outside-throws-in-with-values', () => {
        const connection = ctx.conn
        const condition = connection.dynamicConditionFor({ id: tIssue.id })

        // A filter parsed from JSON has no static type
        expect(() => condition.withValues(JSON.parse('{ "nope": { "equals": 1 } }'))).toThrow('DYNAMIC_CONDITION_UNKNOWN_COLUMN')
        expect(() => condition.withValues(JSON.parse('{ "id": { "nope": 1 } }'))).toThrow('DYNAMIC_CONDITION_UNKNOWN_OPERATION')
        expect(() => condition.withValues(JSON.parse('{ "id": 1 }'))).toThrow('DYNAMIC_CONDITION_INVALID_FILTER')
    })

    test('docs:filters/dynamic-condition-nested-projection', async () => {
        const expected = {
            id:           1,
            name:         { projectName: 'Marketing site', projectSlug: 'mktg-site' },
            organization: { id: 1, name: 'Acme Corp' },
        }
        ctx.mockNext({
            'id':                1,
            'name.projectName':  'Marketing site',
            'name.projectSlug':  'mktg-site',
            'organization.id':   1,
            'organization.name': 'Acme Corp',
        })
        const connection = ctx.conn

        // doc-start
        type QueryFilterType = DynamicCondition<{
            id: 'int',
            name: {
                projectName: 'string',
                projectSlug: 'string',
            },
            archivedAt: 'localDateTime',
            organization: {
                id:   'int',
                name: 'string',
            },
        }>

        const queryFilter: QueryFilterType = {
            organization: { name: { equals: 'Acme Corp' } },
            name: {
                or: [
                    { projectName: { containsInsensitive: 'Marketing' } },
                    { projectSlug: { containsInsensitive: 'mktg' } },
                ],
            },
        }

        const queryOrderBy = 'organization.name asc insensitive, archivedAt desc'

        const querySelectFields = {
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

        const queryDynamicWhere = connection.dynamicConditionFor(querySelectFields).withValues(queryFilter)

        const projectWithOrganizationObject = await connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select(querySelectFields)
            .where(queryDynamicWhere)
            .orderByFromString(queryOrderBy)
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as "name.projectName", project.slug as "name.projectSlug", project.archived_at as "archivedAt", organization.id as "organization.id", organization.name as "organization.name" from project inner join organization on organization.id = project.organization_id where organization.name = $1 and (project.name ilike ('%' || $2 || '%') or project.slug ilike ('%' || $3 || '%')) order by lower(organization.name) asc, "archivedAt" desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme Corp",
            "Marketing",
            "mktg",
          ]
        `)
        assertType<Exact<typeof projectWithOrganizationObject, {
            id: number
            name: {
                projectName: string
                projectSlug: string
            }
            organization: {
                id:   number
                name: string
            }
            archivedAt?: Date
        }>>()
        expect(projectWithOrganizationObject).toEqual(expected)
    })
})
