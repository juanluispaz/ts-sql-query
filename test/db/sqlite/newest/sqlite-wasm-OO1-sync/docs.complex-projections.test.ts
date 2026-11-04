// Documentation snippets for the Complex projections page
// (docs/queries/complex-projections.md). Demonstrates nested object
// projection and optional-object projection on a left join.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:complex-projections/nested-object', async () => {
        const expected = [
            { id: 2, header: { title: 'Redesign navbar',  status: 'in_progress' }, body: 'Use new tokens' },
            { id: 1, header: { title: 'Update hero copy', status: 'open' } },
        ]
        ctx.mockNext([
            { id: 2, 'header.title': 'Redesign navbar',  'header.status': 'in_progress', body: 'Use new tokens' },
            { id: 1, 'header.title': 'Update hero copy', 'header.status': 'open',        body: null },
        ])
        const connection = ctx.conn

        // doc-start
        const projectId = 1

        const issuesOfProject = sync(connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(projectId))
            .select({
                id: tIssue.id,
                header: {
                    title:  tIssue.title,
                    status: tIssue.status,
                },
                body: tIssue.body,
            })
            .orderBy('header.title')
            .orderBy('header.status')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as "header.title", status as "header.status", body as body from issue where project_id = ?1 order by "header.title", "header.status""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issuesOfProject, Array<{
            id: number
            header: { title: string; status: string }
            body?: string
        }>>>()
        expect(issuesOfProject).toEqual(expected)
    })

    test('docs-extra:complex-projections/five-nesting-levels', async () => {
        // Section "Nested object projections": five levels, the root object
        // being the first.
        const expected = {
            id: 1,
            level2: { level3: { level4: { level5: { title: 'Update hero copy' } } } },
        }
        ctx.mockNext({ id: 1, 'level2.level3.level4.level5.title': 'Update hero copy' })
        const connection = ctx.conn

        const issue = sync(connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                level2: { level3: { level4: { level5: {
                    title: tIssue.title,
                } } } },
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as "level2.level3.level4.level5.title" from issue where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issue, {
            id: number
            level2: { level3: { level4: { level5: { title: string } } } }
        }>>()
        expect(issue).toEqual(expected)
    })

    test('docs:complex-projections/inner-join-required-object', async () => {
        // Project 1 has no archived_at: the optional property isn't set.
        const expected = {
            id: 1, name: 'Marketing site', slug: 'mktg-site',
            organization: { id: 1, name: 'Acme Corp' },
        }
        ctx.mockNext({
            id: 1, name: 'Marketing site', slug: 'mktg-site', archivedAt: null,
            'organization.id': 1, 'organization.name': 'Acme Corp',
        })
        const connection = ctx.conn

        // doc-start
        const projectWithOrganizationInOneQuery = sync(connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                slug:       tProject.slug,
                archivedAt: tProject.archivedAt,
                organization: {
                    id:   tOrganization.id,
                    name: tOrganization.name,
                },
            }).where(
                tProject.id.equals(1),
            ).executeSelectOne())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, project.archived_at as archivedAt, organization.id as "organization.id", organization.name as "organization.name" from project inner join organization on organization.id = project.organization_id where project.id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectWithOrganizationInOneQuery, {
            id:          number
            name:        string
            slug:        string
            archivedAt?: Date
            organization: { id: number; name: string }
        }>>()
        expect(projectWithOrganizationInOneQuery).toEqual(expected)
    })

    test('docs:complex-projections/multi-level-left-join', async () => {
        // Inside the rollback the issues form the chain 4 -> 3 -> 2 -> 1, so every
        // level shows up: no parent, parent without grandparent, grandparent
        // without parentId, and grandparent with parentId.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar',
              parent: { id: 1, title: 'Update hero copy' } },
            { id: 3, title: 'Migrate to ESM',
              parent: { id: 2, title: 'Redesign navbar',
                        parent: { id: 1, title: 'Update hero copy' } } },
            { id: 4, title: 'Document /v2/users',
              parent: { id: 3, title: 'Migrate to ESM',
                        parent: { id: 2, title: 'Redesign navbar', parentId: 1 } } },
        ]
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext([
            { id: 1, title: 'Update hero copy',
              'parent.id': null, 'parent.title': null,
              'parent.parent.id': null, 'parent.parent.title': null, 'parent.parent.parentId': null },
            { id: 2, title: 'Redesign navbar',
              'parent.id': 1, 'parent.title': 'Update hero copy',
              'parent.parent.id': null, 'parent.parent.title': null, 'parent.parent.parentId': null },
            { id: 3, title: 'Migrate to ESM',
              'parent.id': 2, 'parent.title': 'Redesign navbar',
              'parent.parent.id': 1, 'parent.parent.title': 'Update hero copy', 'parent.parent.parentId': null },
            { id: 4, title: 'Document /v2/users',
              'parent.id': 3, 'parent.title': 'Migrate to ESM',
              'parent.parent.id': 2, 'parent.parent.title': 'Redesign navbar', 'parent.parent.parentId': 1 },
        ])
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            sync(connection.update(tIssue).set({ parentId: 1 }).where(tIssue.id.equals(2)).executeUpdate())
            sync(connection.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(3)).executeUpdate())
            sync(connection.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(4)).executeUpdate())

            // doc-start
            const parent = tIssue.forUseInLeftJoinAs('parent')
            const parentParent = tIssue.forUseInLeftJoinAs('parentParent')

            const issueMultiParent = sync(connection.selectFrom(tIssue)
                .leftJoin(parent).on(tIssue.parentId.equals(parent.id))
                .leftJoin(parentParent).on(parent.parentId.equals(parentParent.id))
                .select({
                    id:    tIssue.id,
                    title: tIssue.title,
                    parent: {
                        id:    parent.id,
                        title: parent.title,
                        parent: {
                            id:       parentParent.id,
                            title:    parentParent.title,
                            parentId: parentParent.parentId,
                        },
                    },
                })
                .executeSelectMany())
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, parent.id as "parent.id", parent.title as "parent.title", parentParent.id as "parent.parent.id", parentParent.title as "parent.parent.title", parentParent.parent_id as "parent.parent.parentId" from issue left join issue as parent on issue.parent_id = parent.id left join issue as parentParent on parent.parent_id = parentParent.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof issueMultiParent, Array<{
                id:    number
                title: string
                parent?: {
                    id:    number
                    title: string
                    parent?: {
                        id:        number
                        title:     string
                        parentId?: number
                    }
                }
            }>>>()
            expect([...issueMultiParent].sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })

    test('docs:complex-projections/as-required-in-optional-object', async () => {
        // Issue 1: both required properties, no body. Issue 2: everything.
        // Issue 3: nothing. Issue 4: no external_ref, so the whole object goes
        // even though it has assignee_id and body.
        const expected = [
            { id: 1, title: 'Update hero copy',
              meta: { externalRef: '0a8f9c1e-1111-4222-8333-444455556666', assigneeId: 1 } },
            { id: 2, title: 'Redesign navbar',
              meta: { externalRef: '7b3e9d20-2222-4c55-9b66-dddd00009999', assigneeId: 2, body: 'Use new tokens' } },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext([
            { id: 1, title: 'Update hero copy', parentId: null,
              'meta.externalRef': '0a8f9c1e-1111-4222-8333-444455556666', 'meta.assigneeId': 1, 'meta.body': null },
            { id: 2, title: 'Redesign navbar', parentId: null,
              'meta.externalRef': '7b3e9d20-2222-4c55-9b66-dddd00009999', 'meta.assigneeId': 2, 'meta.body': 'Use new tokens' },
            { id: 3, title: 'Migrate to ESM', parentId: null,
              'meta.externalRef': null, 'meta.assigneeId': null, 'meta.body': null },
            { id: 4, title: 'Document /v2/users', parentId: null,
              'meta.externalRef': null, 'meta.assigneeId': 3, 'meta.body': 'See ADR-014' },
        ])
        const connection = ctx.conn

        // doc-start
        const issues = sync(connection.selectFrom(tIssue)
            .select({
                id:       tIssue.id,
                title:    tIssue.title,
                parentId: tIssue.parentId,
                meta: {
                    externalRef: tIssue.externalRef.asRequiredInOptionalObject(),
                    assigneeId:  tIssue.assigneeId.asRequiredInOptionalObject(),
                    body:        tIssue.body,
                },
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, parent_id as parentId, external_ref as "meta.externalRef", assignee_id as "meta.assigneeId", body as "meta.body" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:        number
            title:     string
            parentId?: number
            meta?: {
                externalRef: string
                assigneeId:  number
                body?:       string
            }
        }>>>()
        expect([...issues].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs-extra:complex-projections/rule-2-left-join-required-columns', async () => {
        // Issue 3 has assignee_id = NULL → assignee object absent.
        // Issue 1 has assignee_id = 1 (Ada) → assignee object present.
        const expected = [
            { id: 1, title: 'Update hero copy',
              assignee: { id: 1, fullName: 'Ada Lovelace' } },
            { id: 3, title: 'Migrate to ESM' /* no assignee */ },
        ]
        ctx.mockNext([
            { id: 1, title: 'Update hero copy',
              'assignee.id': 1, 'assignee.fullName': 'Ada Lovelace' },
            { id: 3, title: 'Migrate to ESM',
              'assignee.id': null, 'assignee.fullName': null },
        ])
        const connection = ctx.conn

        // doc-start
        const assignee = tAppUser.forUseInLeftJoin()
        const rows = sync(connection.selectFrom(tIssue)
            .leftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .where(tIssue.status.equals('open'))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                assignee: {
                    id:       assignee.id,
                    fullName: assignee.fullName,
                },
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, app_user.id as "assignee.id", app_user.full_name as "assignee.fullName" from issue left join app_user on app_user.id = issue.assignee_id where issue.status = ?1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:    number
            title: string
            assignee?: { id: number; fullName: string }
        }>>>()
        expect(rows).toEqual(expected)
    })
})
