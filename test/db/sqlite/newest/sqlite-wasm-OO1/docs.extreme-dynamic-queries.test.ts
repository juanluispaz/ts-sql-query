// Documentation snippets for the Extreme dynamic queries page
// (docs/queries/extreme-dynamic-queries.md). Covers the most advanced
// dynamic patterns: dynamicConditionFor, dynamicPick/dynamicPickPaths,
// allowWhen/disallowWhen, optional joins with dynamic picks, and the
// nested complex projection variants of those.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { type DynamicCondition, type DynamicConditionForModel } from '../../../../../src/dynamic/condition.js'
import { dynamicPick, dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPickPaths, type PickValuesPath } from '../../../../../src/dynamic/pick.js'
import { tAppUser, tIssue, tOrganization, tProject, type DBConnection } from '../../domain/connection.js'
import type { OrderByForModel } from '../../../../../src/dynamic/orderBy.js'
import { type DeepPick, type DeepPickPaths } from '../../../../../src/extras/deepUtilities.js'
import { fromRef, type TableOrViewLeftJoinOf } from '../../../../../src/extras/types.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

function insertChildIssue(assigneeId: number) {
    return ctx.conn.insertInto(tIssue)
        .set({ projectId: 1, number: 50, title: 'Child issue', status: 'open', priority: 1, parentId: 1, assigneeId })
        .returningLastInsertedId()
        .executeInsert()
}

function buildIssueAvailableFields<ASSIGNEE extends TableOrViewLeftJoinOf<typeof tAppUser, 'assignee'>>(_connection: DBConnection, assigneeRef: ASSIGNEE) {
    const assignee = fromRef(tAppUser, assigneeRef)

    return {
        id:    tIssue.id,
        title: tIssue.title,
        assignee: {
            id:   assignee.id,
            name: assignee.fullName.concat(' ').concat(assignee.email),
        },
    }
}

interface UserRules {
    anyUserNameContains?: string
    anyUserCreatedAt?: Date
}

function buildIssueConditionExtension<ASSIGNEE extends TableOrViewLeftJoinOf<typeof tAppUser, 'assignee'>>(connection: DBConnection, assigneeRef: ASSIGNEE) {
    const assignee = fromRef(tAppUser, assigneeRef)

    return {
        users: (rules: UserRules) => {
            let result = connection.dynamicBooleanExpressionUsing(tIssue)

            if (rules.anyUserNameContains) {
                const query = connection.subSelectUsing(tIssue)
                    .from(tAppUser)
                    .where(tAppUser.fullName.concat(' ').concat(tAppUser.email).containsInsensitive(rules.anyUserNameContains))
                    .selectOneColumn(tAppUser.id)

                result = result.and(connection.exists(query))
            }

            if (rules.anyUserCreatedAt) {
                const query = connection.subSelectUsing(tIssue)
                    .from(tAppUser)
                    .where(tAppUser.createdAt.equals(rules.anyUserCreatedAt))
                    .selectOneColumn(tAppUser.id)

                result = result.and(connection.exists(query))
            }

            return result
        },
        assignee: {
            isInAnotherIssueWithTitle: (title: string) => {
                const query = connection.selectFrom(tIssue)
                    .where(tIssue.title.containsInsensitive(title))
                    .selectOneColumn(tIssue.assigneeId)

                return assignee.id.in(query)
            },
        },
    }
}

type IssueFields = DynamicPickPaths<ReturnType<typeof buildIssueAvailableFields>, 'id'>
type IssueDynamicCondition = DynamicCondition<ReturnType<typeof buildIssueAvailableFields>, ReturnType<typeof buildIssueConditionExtension>>
type IssueInformation<FIELDS extends IssueFields> = PickValuesPath<ReturnType<typeof buildIssueAvailableFields>, FIELDS | 'id'>

async function getSubissues<FIELDS extends IssueFields>(connection: DBConnection, parentIssueId: number, fields: FIELDS[], condition: IssueDynamicCondition, orderBy?: OrderByForModel<IssueInformation<IssueFields>>[]): Promise<IssueInformation<FIELDS>[]> {
    const assignee = tAppUser.forUseInLeftJoinAs('assignee')

    const availableFields = buildIssueAvailableFields(connection, assignee)
    const conditionExtension = buildIssueConditionExtension(connection, assignee)

    const dynamicCondition = connection.dynamicConditionFor(availableFields, conditionExtension).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const issues = await connection
        .selectFrom(tIssue)
        .optionalLeftOuterJoin(assignee).on(tIssue.assigneeId.equals(assignee.id))
        .where(dynamicCondition)
        .and(tIssue.parentId.equals(parentIssueId))
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, issues, ['id'])
}

interface IssueInformationModel {
    id: number
    title: string
    assignee?: {
        id: number
        name: string
    }
}

async function getSubissuesFromModel<FIELDS extends DeepPickPaths<IssueInformationModel>>(connection: DBConnection, parentIssueId: number, fields: FIELDS[], condition: DynamicConditionForModel<IssueInformationModel>, orderBy?: OrderByForModel<IssueInformationModel>[]): Promise<DeepPick<IssueInformationModel, FIELDS | 'id'>[]> {
    const assignee = tAppUser.forUseInLeftJoinAs('assignee')

    const availableFields = {
        id:    tIssue.id,
        title: tIssue.title,
        assignee: {
            id:   assignee.id,
            name: assignee.fullName.concat(' ').concat(assignee.email),
        },
    }

    const dynamicCondition = connection.dynamicConditionFor(availableFields).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const issues = await connection
        .selectFrom(tIssue)
        .optionalLeftOuterJoin(assignee).on(tIssue.assigneeId.equals(assignee.id))
        .where(dynamicCondition)
        .and(tIssue.parentId.equals(parentIssueId))
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, issues, ['id'])
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:extreme-dynamic-queries/complex-dynamic-boolean-expressions', async () => {
        const expected = [
            { id: 2, name: 'Internal tools tools' },
            { id: 1, name: 'Marketing site mktg-site' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const nameContains = 'te'
        const slugContains = null
        const archivedAtIs = null
        const searchOrderBy = 'name insensitive, archivedAt asc nulls last'

        let searchedProjectsWhere = connection.dynamicBooleanExpressionUsing(tProject)
        if (nameContains) {
            searchedProjectsWhere = searchedProjectsWhere.and(tProject.name.contains(nameContains))
        }
        if (slugContains) {
            searchedProjectsWhere = searchedProjectsWhere.or(tProject.slug.contains(slugContains))
        }
        if (archivedAtIs) {
            searchedProjectsWhere = searchedProjectsWhere.and(tProject.archivedAt.equals(archivedAtIs))
        }

        const searchedProjects = await connection.selectFrom(tProject)
            .where(searchedProjectsWhere)
            .select({
                id:         tProject.id,
                name:       tProject.name.concat(' ').concat(tProject.slug),
                archivedAt: tProject.archivedAt,
            })
            .orderByFromString(searchOrderBy)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name || ?1 || slug as name, archived_at as archivedAt from project where name like ('%' || ?2 || '%') escape '\\' order by lower(name || ?1 || slug), archivedAt asc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
            "te",
          ]
        `)
        assertType<Exact<typeof searchedProjects, Array<{
            id:          number
            name:        string
            archivedAt?: Date
        }>>>()
        expect(searchedProjects).toEqual(expected)
    })

    test('docs:extreme-dynamic-queries/dynamic-condition-for', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, project.archived_at as archivedAt, organization.name as organizationName from project inner join organization on project.organization_id = organization.id where (lower(project.name) like lower(?1 || '%') escape '\\' or (lower(project.slug) like lower(?2 || '%') escape '\\' and project.slug like ('%' || ?3) escape '\\')) and organization.name = ?4 order by lower(project.name), lower(project.slug) asc"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where lower(name) like lower('%' || ?1 || '%') escape '\\' and (slug like (?2 || '%') escape '\\' or slug like (?3 || '%') escape '\\') order by id"`)
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

    test('docs:extreme-dynamic-queries/dynamic-pick', async () => {
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

    test('docs-extra:extreme-dynamic-queries/dynamic-pick-paths', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name?: string; slug?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('docs:extreme-dynamic-queries/optional-inner-join-with-pick', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project where id = ?1"`)
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

    test('docs:extreme-dynamic-queries/optional-inner-join-with-pick-includes-join', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, organization.name as organizationName from project inner join organization on organization.id = project.organization_id where project.id = ?1"`)
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

    test('docs:extreme-dynamic-queries/disallowed-http-handler', async () => {
        let statusCode = 200
        let responseBody = ''
        const res = {
            status(code: number) {
                statusCode = code
                return res
            },
            json<BODY>(body: BODY) {
                responseBody = JSON.stringify(body)
            },
        }
        const req = { body: { fields: { title: true, body: true } } }
        const connection = ctx.conn
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body.allowWhen(false, "You don't have permission to see the body"),
        }

        async function handleRequest() {
            // doc-start
            try {
                const rows = await connection.selectFrom(tIssue)
                    .select(dynamicPick(availableFields, req.body.fields, ['id']))
                    .executeSelectMany()
                res.json(rows)
            } catch (e) {
                if (e instanceof TsSqlError && e.errorReason.reason === 'DISALLOWED') {
                    res.status(403).json({ error: e.message })
                    return
                }
                throw e
            }
            // doc-end
        }

        await handleRequest()

        expect(statusCode).toBe(403)
        expect(responseBody).toMatchInlineSnapshot(`"{"error":"DISALLOWED: You don't have permission to see the body"}"`)
    })

    test('docs:extreme-dynamic-queries/allow-when-not-picked', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar', status: 'in_progress' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const bodyVisible = false

        const availableFields = {
            id:     tIssue.id,
            title:  tIssue.title,
            status: tIssue.status,
            body:   tIssue.body.allowWhen(bodyVisible, "You don't have permission to see the body"),
        }

        const fieldsToPick = {
            title:  true,
            status: true,
        }

        // always include id field as required
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const issues = await connection.selectFrom(tIssue)
            .select(pickedFields)
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status from issue where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:      number
            title?:  string
            status?: string
            body?:   string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:extreme-dynamic-queries/allow-when-picked-throws', async () => {
        const connection = ctx.conn
        const bodyVisible = false

        const availableFields = {
            id:     tIssue.id,
            title:  tIssue.title,
            status: tIssue.status,
            body:   tIssue.body.allowWhen(bodyVisible, "You don't have permission to see the body"),
        }

        // doc-start
        const fieldsToPick = {
            title:  true,
            status: true,
            body:   true,
        }
        // doc-end

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        let caught: unknown = null
        try {
            await connection.selectFrom(tIssue)
                .select(pickedFields)
                .where(tIssue.id.equals(2))
                .executeSelectMany()
        } catch (e) {
            caught = e
        }

        expect(caught).not.toBeNull()
        expect(String(caught)).toContain("You don't have permission to see the body")
    })

    test('docs-extra:extreme-dynamic-queries/disallow-when-picked-throws', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as "name.projectName", project.slug as "name.projectSlug", project.archived_at as archivedAt, organization.id as "organization.id", organization.name as "organization.name" from project inner join organization on organization.id = project.organization_id where organization.name = ?1 and (lower(project.name) like lower('%' || ?2 || '%') escape '\\' or lower(project.slug) like lower('%' || ?3 || '%') escape '\\') order by lower(organization.name) asc, archivedAt desc"`)
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

    test('docs:extreme-dynamic-queries/dynamic-pick-complex-projection', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as "name.projectName", slug as "name.projectSlug" from project where id = ?1"`)
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

    test('docs:extreme-dynamic-queries/dynamic-pick-complex-projection-with-join', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as "name.projectName", project.slug as "name.projectSlug", organization.name as "organization.name" from project inner join organization on organization.id = project.organization_id where project.id = ?1"`)
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

    test('docs:extreme-dynamic-queries/full-dynamic-from-database-1', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ id: 50, title: 'Child issue' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title'], {
                title: { containsInsensitive: 'CHILD' },
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where lower(title) like lower('%' || ?1 || '%') escape '\\' and parent_id = ?2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "CHILD",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
            }>>>()
            expect(result).toEqual([{ id: childId, title: 'Child issue' }])
        })
    })

    test('docs:extreme-dynamic-queries/full-dynamic-from-database-2', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ 'id': 50, 'title': 'Child issue', 'assignee.name': 'Grace Hopper grace@acme.test' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title', 'assignee.name'], {
                users: { anyUserNameContains: 'lovelace' },
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, assignee.full_name || ?1 || assignee.email as "assignee.name" from issue left outer join app_user as assignee on issue.assignee_id = assignee.id where exists(select id as result from app_user where lower(full_name || ?2 || email) like lower('%' || ?3 || '%') escape '\\') and issue.parent_id = ?4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " ",
                " ",
                "lovelace",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
                assignee?: {
                    name: string
                }
            }>>>()
            expect(result).toEqual([{
                id:       childId,
                title:    'Child issue',
                assignee: { name: 'Grace Hopper grace@acme.test' },
            }])
        })
    })

    test('docs:extreme-dynamic-queries/full-dynamic-from-database-3', async () => {
        // Seeded issue 1 is assigned to user 1, the assignee of the child too.
        ctx.mockNext(50)
        ctx.mockNext([{ id: 50, title: 'Child issue' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(1)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title'], {
                assignee: { isInAnotherIssueWithTitle: 'Update hero' },
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title from issue left outer join app_user as assignee on issue.assignee_id = assignee.id where assignee.id in (select assignee_id as result from issue where lower(title) like lower('%' || ?1 || '%') escape '\\') and issue.parent_id = ?2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Update hero",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
            }>>>()
            expect(result).toEqual([{ id: childId, title: 'Child issue' }])
        })
    })

    test('docs:extreme-dynamic-queries/full-dynamic-from-database-4', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ id: 50, title: 'Child issue' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title'], {
                or: [
                    { users: { anyUserNameContains: 'Ada' } },
                    { users: { anyUserCreatedAt: new Date('2000-03-01') } },
                ],
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where (exists(select id as result from app_user where lower(full_name || ?1 || email) like lower('%' || ?2 || '%') escape '\\') or exists(select id as result from app_user where created_at = ?3)) and parent_id = ?4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " ",
                "Ada",
                "2000-03-01 00:00:00",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
            }>>>()
            expect(result).toEqual([{ id: childId, title: 'Child issue' }])
        })
    })

    test('docs:extreme-dynamic-queries/full-dynamic-from-model', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ 'id': 50, 'title': 'Child issue', 'assignee.name': 'Grace Hopper grace@acme.test' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const result = await getSubissuesFromModel(ctx.conn, 1, ['title', 'assignee.name'],
                { title: { containsInsensitive: 'CHILD' } },
                ['assignee.name asc nulls last', 'title desc'])
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, assignee.full_name || ?1 || assignee.email as "assignee.name" from issue left outer join app_user as assignee on issue.assignee_id = assignee.id where lower(issue.title) like lower('%' || ?2 || '%') escape '\\' and issue.parent_id = ?3 order by "assignee.name" asc nulls last, title desc"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " ",
                "CHILD",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
                assignee?: {
                    name: string
                }
            }>>>()
            expect(result).toEqual([{
                id:       childId,
                title:    'Child issue',
                assignee: { name: 'Grace Hopper grace@acme.test' },
            }])
        })
    })
})
