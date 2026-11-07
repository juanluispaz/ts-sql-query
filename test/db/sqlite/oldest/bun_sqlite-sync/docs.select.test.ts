// Documentation snippets for the SELECT page (docs/queries/select.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:select/joins-and-order-by', async () => {
        const expected = [
            { id: 1, name: 'Marketing site', slug: 'mktg-site', organizationName: 'Acme Corp' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const name = 'market'
        const slug = null

        const organization = tOrganization.as('org')
        const projectsWithOrganizationName = sync(connection.selectFrom(tProject)
            .innerJoin(organization).on(tProject.organizationId.equals(organization.id))
            .where(tProject.name.startsWithInsensitive(name))
                .and(tProject.slug.startsWithInsensitiveIfValue(slug))
            .select({
                id:               tProject.id,
                name:             tProject.name,
                slug:             tProject.slug,
                archivedAt:       tProject.archivedAt,
                organizationName: organization.name,
            })
            .orderBy('name', 'insensitive')
            .orderBy('slug', 'asc insensitive')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, project.archived_at as archivedAt, org.name as organizationName from project inner join organization as org on project.organization_id = org.id where lower(project.name) like lower(?1 || '%') escape '\\' order by lower(project.name), lower(project.slug) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "market",
          ]
        `)
        assertType<Exact<typeof projectsWithOrganizationName, Array<{
            id:               number
            name:             string
            slug:             string
            archivedAt?:      Date
            organizationName: string
        }>>>()
        expect(projectsWithOrganizationName).toEqual(expected)
    })

    test('docs:select/ordering-by-not-returned-column', async () => {
        // Section "Select ordering by a not returned column" — pass a
        // column expression (not a result alias) to `orderBy`, optionally
        // with one of the documented OrderByMode strings.
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        const connection = ctx.conn

        // doc-start
        const project = sync(connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy(tProject.archivedAt, 'desc nulls last')
            .executeSelectOne())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = ?1 order by project.archived_at desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof project, { id: number; name: string }>>()
        expect(project.id).toBe(1)
    })

    test('docs:select/left-join', async () => {
        // Section "Select with left join" — create a left-join view with
        // `forUseInLeftJoinAs` so columns become optional in the result.
        // The seed has no issue with a non-null parentId so every row
        // comes back with `parentTitle` absent (the structural promise
        // of a left join — the column is `?` in the result type).
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const parent = tIssue.forUseInLeftJoinAs('parent')

        const issuesWithParentTitle = sync(connection.selectFrom(tIssue)
            .leftJoin(parent).on(tIssue.parentId.equals(parent.id))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                parentTitle: parent.title,
            }).orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, parent.title as parentTitle from issue left join issue as parent on issue.parent_id = parent.id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // parentTitle is optional because parent is a left-join view.
        assertType<Exact<typeof issuesWithParentTitle, Array<{
            id:           number
            title:        string
            parentTitle?: string
        }>>>()
        expect(issuesWithParentTitle).toEqual(expected)
    })

    test('docs:select/left-join-complex-projections', async () => {
        // Section "Select with left join and complex projections" — the
        // optional fields are nested inside a sub-object. With no parent
        // rows in the seed every result row omits the `parent` key.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const parent = tIssue.forUseInLeftJoinAs('parent')

        const issuesWithParent = sync(connection.selectFrom(tIssue)
            .leftJoin(parent).on(tIssue.parentId.equals(parent.id))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                parent: {
                    id:    parent.id,
                    title: parent.title,
                },
            }).orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, parent.id as "parent.id", parent.title as "parent.title" from issue left join issue as parent on issue.parent_id = parent.id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesWithParent, Array<{
            id:      number
            title:   string
            parent?: { id: number; title: string }
        }>>>()
        expect(issuesWithParent).toEqual(expected)
    })

    test('docs:select/several-tables-in-the-from', async () => {
        const expected = [
            { id: 1, organizationName: 'Acme Corp' },
            { id: 2, organizationName: 'Acme Corp' },
            { id: 3, organizationName: 'Globex Ltd' },
            { id: 4, organizationName: 'Globex Ltd' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsWithOrganization = sync(connection.selectFrom(tProject)
            .from(tOrganization)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({
                id:               tProject.id,
                organizationName: tOrganization.name,
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, organization.name as organizationName from project, organization where project.organization_id = organization.id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectsWithOrganization, Array<{
            id:               number
            organizationName: string
        }>>>()
        expect(projectsWithOrganization).toEqual(expected)
    })

    test('docs:select/what-you-can-order-by', async () => {
        const expected = [
            { id: 3, name: 'Public API',     slug: 'public-api' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 4, name: 'Legacy app',     slug: 'legacy' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsInOrder = sync(connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('name', 'desc')
            .orderBy(tProject.archivedAt, 'asc nulls last')
            .orderBy(connection.rawFragment`lower(${tProject.slug})`)
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by name desc, project.archived_at is null, project.archived_at asc, lower(project.slug)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectsInOrder, Array<{
            id:   number
            name: string
            slug: string
        }>>>()
        expect(projectsInOrder).toEqual(expected)
    })

    test('docs:select/left-join-condition-in-on', async () => {
        // The issues without that assignee are kept, without the name.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected.map((row) => ({ assigneeName: null, ...row })))
        const connection = ctx.conn

        // doc-start
        const assignee = tAppUser.forUseInLeftJoinAs('assignee')

        const issues = sync(connection.selectFrom(tIssue)
            .leftJoin(assignee).on(tIssue.assigneeId.equals(assignee.id))
                .and(assignee.fullName.equals('Ada Lovelace'))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, assignee.full_name as assigneeName from issue left join app_user as assignee on issue.assignee_id = assignee.id and assignee.full_name = ?1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Ada Lovelace",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:select/left-join-condition-in-where', async () => {
        // The issues without that assignee are removed.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assignee = tAppUser.forUseInLeftJoinAs('assignee')

        const issues = sync(connection.selectFrom(tIssue)
            .leftJoin(assignee).on(tIssue.assigneeId.equals(assignee.id))
            .where(assignee.fullName.equals('Ada Lovelace'))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, assignee.full_name as assigneeName from issue left join app_user as assignee on issue.assignee_id = assignee.id where assignee.full_name = ?1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Ada Lovelace",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:select/select-distinct', async () => {
        const expected = [{ status: 'closed' }, { status: 'in_progress' }, { status: 'open' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const statuses = sync(connection.selectDistinctFrom(tIssue)
            .select({
                status: tIssue.status,
            })
            .orderBy('status')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct status as status from issue order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof statuses, Array<{ status: string }>>>()
        expect(statuses).toEqual(expected)
    })

    test('docs:select/select-one-column', async () => {
        const expected = ['Internal tools', 'Legacy app', 'Marketing site', 'Public API']
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectNames = sync(connection.selectFrom(tProject)
            .selectOneColumn(tProject.name)
            .orderBy('result')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as result from project order by result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectNames, string[]>>()
        expect(projectNames).toEqual(expected)
    })

    test('docs:select/select-one-column-optional', async () => {
        // Issue 3 has no assignee.
        ctx.mockNext(null)
        const connection = ctx.conn

        const assigneeId = sync(connection.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .selectOneColumn(tIssue.assigneeId)
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select assignee_id as result from issue where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof assigneeId, number | null>>()
        expect(assigneeId).toBeNull()
    })

    test('docs:select/first-row-of-a-list', async () => {
        const expected = { id: 4, name: 'Legacy app' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const lastProject = sync(connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id', 'desc')
            .limit(1)
            .executeSelectNoneOrOne())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id desc limit ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof lastProject, { id: number; name: string } | null>>()
        expect(lastProject).toEqual(expected)
    })

    test('docs:select/count-all', async () => {
        // Section "Select count all" — `selectCountAll()` is the shortcut
        // for `selectOneColumn(connection.countAll())`. Result is a plain
        // int (non-nullable).
        ctx.mockNext(2)
        const connection = ctx.conn

        // doc-start
        const organizationId = 1
        const numberOfProjects = sync(connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(organizationId))
            .selectCountAll()
            .executeSelectOne())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from project where organization_id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof numberOfProjects, number>>()
        expect(numberOfProjects).toBe(2)
    })

    test('docs:select/select-without-table', async () => {
        const expected = { users: 3, organizations: 2 }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const counts = sync(connection.selectFromNoTable()
            .select({
                users:         connection.selectFrom(tAppUser).selectCountAll().forUseAsInlineQueryValue(),
                organizations: connection.selectFrom(tOrganization).selectCountAll().forUseAsInlineQueryValue(),
            })
            .executeSelectOne())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select count(*) as result from app_user) as users, (select count(*) as result from organization) as organizations"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof counts, {
            users:         number
            organizations: number
        }>>()
        expect(counts).toEqual(expected)
    })

    test('docs-extra:select/clauses-order-where-after-groupby', async () => {
        // Section "Select clauses order" lists a number of legal clause
        // orderings. The default (logical) and the "alternative" variants
        // all parse — exercise one alternative (WHERE after GROUP BY) to
        // lock the contract in.
        // Real seed: projects 1,2 (org 1, not archived), 3 (org 2, not
        // archived). Project 4 is archived. After WHERE archivedAt IS
        // NULL + GROUP BY org → [{org:1, count:2}, {org:2, count:1}].
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .where(tProject.archivedAt.isNull())
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .orderBy('organizationId')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-where-after-select', async () => {
        // Section "Select clauses order" — alternative ordering where
        // WHERE comes AFTER select(): from/groupBy/having/select/where.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .where(tProject.archivedAt.isNull())
            .orderBy('organizationId')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-where-after-orderby', async () => {
        // Section "Select clauses order" — WHERE may come AFTER orderBy():
        // from/groupBy/having/select/orderBy/where/limit/offset.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .orderBy('organizationId')
            .where(tProject.archivedAt.isNull())
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-select-before-where', async () => {
        // Section "Select clauses order" — the "Alternative order 1" branch
        // allows select() before where(): from/select/where/groupBy/having.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .where(tProject.archivedAt.isNull())
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-where-after-customize-query', async () => {
        // Section "Select clauses order": where as the last clause, with group by and having first.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .orderBy('organizationId')
            .limit(10)
            .offset(0)
            .customizeQuery({
                afterQuery: connection.rawFragment`/* trailing comment */`,
            })
            .where(tProject.archivedAt.isNull())
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId limit ?2 offset ?3 /* trailing comment */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-select-first-where-after-having', async () => {
        // Section "Select clauses order": select first, where after having.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .where(tProject.archivedAt.isNull())
            .orderBy('organizationId')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-select-first-where-after-order-by', async () => {
        // Section "Select clauses order": select first, where after order by.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .where(tProject.archivedAt.isNull())
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-select-first-where-after-offset', async () => {
        // Section "Select clauses order": select first, where after limit and offset.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .limit(10)
            .offset(0)
            .where(tProject.archivedAt.isNull())
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId limit ?2 offset ?3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-select-first-where-after-customize-query', async () => {
        // Section "Select clauses order": select first, where as the last clause.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .limit(10)
            .offset(0)
            .customizeQuery({
                afterQuery: connection.rawFragment`/* trailing comment */`,
            })
            .where(tProject.archivedAt.isNull())
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ?1 order by organizationId limit ?2 offset ?3 /* trailing comment */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    // NOT-APPLICABLE: `.startWith` / `.connectBy` are typed `never` on this connection; the hierarchical query clauses exist only on Oracle.
    /*
    test('docs-extra:select/clauses-oracle-select-first-where-after-ordering-siblings', async () => {
        // Section "Select clauses order", Oracle variants: select first, then
        // start with + connect by, with where after ordering siblings only.
        // No issue has a parent in the seed, so every issue is a root and the
        // where keeps those with priority above 1.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = sync(connection.selectFrom(tIssue)
            .select({
                id: tIssue.id,
            })
            .startWith(tIssue.parentId.isNull())
            .connectBy((prior) => prior(tIssue.id).equals(tIssue.parentId))
            .orderBy('id')
            .orderingSiblingsOnly()
            .where(tIssue.priority.greaterThan(1))
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
    */
})
