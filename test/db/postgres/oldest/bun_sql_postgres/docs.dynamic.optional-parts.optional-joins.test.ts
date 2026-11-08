// Documentation snippets for the Optional joins page (docs/dynamic/optional-parts/optional-joins.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

const byTitleDescending = (a: { title: string }, b: { title: string }) => b.title.localeCompare(a.title)

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:optional-joins/optional-join-with-value', async () => {
        const expected = [
            { title: 'Update hero copy', status: 'open' },
            { title: 'Redesign navbar',  status: 'in_progress', body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectName = 'Marketing site'

        const issues = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.name.equalsIfValue(projectName))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.title as title, issue.status as status, issue.body as body from issue join project on project.id = issue.project_id where project.name = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:optional-joins/optional-join', async () => {
        const expected = [
            { title: 'Update hero copy',   status: 'open' },
            { title: 'Redesign navbar',    status: 'in_progress', body: 'Use new tokens' },
            { title: 'Migrate to ESM',     status: 'open' },
            { title: 'Document /v2/users', status: 'closed', body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectName = null // CHANGED

        const issues = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.name.equalsIfValue(projectName))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title, status as status, body as body from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:optional-joins/optional-join-only-when-or-null', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar', status: 'in_progress', body: 'Use new tokens' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeProjectInfo = false

        const issueWithOptionalProject = await connection.selectFrom(tIssue)
            .optionalInnerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                status:      tIssue.status,
                body:        tIssue.body,
                projectId:   tProject.id.onlyWhenOrNull(canSeeProjectInfo),
                projectName: tProject.name.onlyWhenOrNull(canSeeProjectInfo),
            })
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status, body as body, $1::int4 as "projectId", $2::text as "projectName" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            null,
            2,
          ]
        `)
        assertType<Exact<typeof issueWithOptionalProject, Array<{
            id:           number
            title:        string
            status:       string
            body?:        string
            projectId?:   number
            projectName?: string
        }>>>()
        expect(issueWithOptionalProject).toEqual(expected)
    })

    test('docs:optional-joins/optional-join-only-when-or-null-true', async () => {
        const expected = [{
            id:          2,
            title:       'Redesign navbar',
            status:      'in_progress',
            body:        'Use new tokens',
            projectId:   1,
            projectName: 'Marketing site',
        }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeProjectInfo = true // CHANGED

        const issueWithOptionalProject = await connection.selectFrom(tIssue)
            .optionalInnerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                status:      tIssue.status,
                body:        tIssue.body,
                projectId:   tProject.id.onlyWhenOrNull(canSeeProjectInfo),
                projectName: tProject.name.onlyWhenOrNull(canSeeProjectInfo),
            })
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, issue.status as status, issue.body as body, project.id as "projectId", project.name as "projectName" from issue inner join project on project.id = issue.project_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issueWithOptionalProject, Array<{
            id:           number
            title:        string
            status:       string
            body?:        string
            projectId?:   number
            projectName?: string
        }>>>()
        expect(issueWithOptionalProject).toEqual(expected)
    })

    test('docs:optional-joins/optional-left-join', async () => {
        // Section "Optional joins with a value replaced by null": a left join, written because it's used.
        const expected = [
            { id: 1, name: 'Marketing site', organizationName: 'Acme Corp' },
            { id: 2, name: 'Internal tools', organizationName: 'Acme Corp' },
            { id: 3, name: 'Public API',     organizationName: 'Globex Ltd' },
            { id: 4, name: 'Legacy app',     organizationName: 'Globex Ltd' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeOrganizationInfo = true
        const tOrganizationForLeftJoin = tOrganization.forUseInLeftJoin()

        const projects = await connection.selectFrom(tProject)
            .optionalLeftJoin(tOrganizationForLeftJoin).on(tOrganizationForLeftJoin.id.equals(tProject.organizationId))
            .select({
                id:               tProject.id,
                name:             tProject.name,
                organizationName: tOrganizationForLeftJoin.name.onlyWhenOrNull(canSeeOrganizationInfo),
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.name as "organizationName" from project left join organization on organization.id = project.organization_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projects, Array<{
            id:                number
            name:              string
            organizationName?: string
        }>>>()
        expect(projects).toEqual(expected)
    })
})
