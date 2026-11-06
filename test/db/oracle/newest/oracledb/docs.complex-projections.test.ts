// Documentation snippets for the Complex projections page
// (docs/queries/complex-projections.md). Demonstrates nested object
// projection and optional-object projection on a left join.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

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

        const issuesOfProject = await connection.selectFrom(tIssue)
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
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "header.title", status as "header.status", "body" as "body" from issue where project_id = :0 order by "header.title", "header.status""`)
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

        const issue = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                level2: { level3: { level4: { level5: {
                    title: tIssue.title,
                } } } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "level2.level3.level4.level5.title" from issue where id = :0"`)
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
        const projectWithOrganizationInOneQuery = await connection.selectFrom(tProject)
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
            ).executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id", project.name as "name", project.slug as "slug", project.archived_at as "archivedAt", "organization".id as "organization.id", "organization".name as "organization.name" from project inner join "organization" on "organization".id = project.organization_id where project.id = :0"`)
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
            await connection.update(tIssue).set({ parentId: 1 }).where(tIssue.id.equals(2)).executeUpdate()
            await connection.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(3)).executeUpdate()
            await connection.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(4)).executeUpdate()

            // doc-start
            const parent = tIssue.forUseInLeftJoinAs('parent')
            const parentParent = tIssue.forUseInLeftJoinAs('parentParent')

            const issueMultiParent = await connection.selectFrom(tIssue)
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
                .executeSelectMany()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", issue.title as "title", parent.id as "parent.id", parent.title as "parent.title", parentParent.id as "parent.parent.id", parentParent.title as "parent.parent.title", parentParent.parent_id as "parent.parent.parentId" from issue left join issue parent on issue.parent_id = parent.id left join issue parentParent on parent.parent_id = parentParent.id"`)
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
        const issues = await connection.selectFrom(tIssue)
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
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title", parent_id as "parentId", raw_to_uuid(external_ref) as "meta.externalRef", assignee_id as "meta.assigneeId", "body" as "meta.body" from issue"`)
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
        const rows = await connection.selectFrom(tIssue)
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
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", issue.title as "title", app_user.id as "assignee.id", app_user.full_name as "assignee.fullName" from issue left join app_user on app_user.id = issue.assignee_id where issue.status = :0 order by "id""`)
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

    test('docs:complex-projections/rule-1-as-required-in-optional-object', async () => {
        // Section "Rule 1". Issue 4 has assignee_id and body but no external_ref: the
        // object goes even though the others have a value.
        const expected = [
            { id: 1, meta: { externalRef: '0a8f9c1e-1111-4222-8333-444455556666', assigneeId: 1 } },
            { id: 2, meta: { externalRef: '7b3e9d20-2222-4c55-9b66-dddd00009999', assigneeId: 2, body: 'Use new tokens' } },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext([
            { id: 1, 'meta.externalRef': '0a8f9c1e-1111-4222-8333-444455556666', 'meta.assigneeId': 1, 'meta.body': null },
            { id: 2, 'meta.externalRef': '7b3e9d20-2222-4c55-9b66-dddd00009999', 'meta.assigneeId': 2, 'meta.body': 'Use new tokens' },
            { id: 3, 'meta.externalRef': null, 'meta.assigneeId': null, 'meta.body': null },
            { id: 4, 'meta.externalRef': null, 'meta.assigneeId': 3, 'meta.body': 'See ADR-014' },
        ])
        const connection = ctx.conn

        // doc-start
        const issues = await connection.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                meta: {
                    externalRef: tIssue.externalRef.asRequiredInOptionalObject(),
                    assigneeId:  tIssue.assigneeId.asRequiredInOptionalObject(),
                    body:        tIssue.body,
                },
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", raw_to_uuid(external_ref) as "meta.externalRef", assignee_id as "meta.assigneeId", "body" as "meta.body" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id: number
            meta?: {
                externalRef: string
                assigneeId:  number
                body?:       string
            }
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:complex-projections/rule-2-all-from-the-same-left-join', async () => {
        // Section "Rule 2". Project 4 has no issues, so the left join has no match.
        const expected = [
            { id: 1, firstIssue: { id: 1, title: 'Update hero copy' } },
            { id: 2, firstIssue: { id: 3, title: 'Migrate to ESM' } },
            { id: 3, firstIssue: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { id: 4 },
        ]
        ctx.mockNext([
            { id: 1, 'firstIssue.id': 1,    'firstIssue.title': 'Update hero copy',   'firstIssue.body': null },
            { id: 2, 'firstIssue.id': 3,    'firstIssue.title': 'Migrate to ESM',     'firstIssue.body': null },
            { id: 3, 'firstIssue.id': 4,    'firstIssue.title': 'Document /v2/users', 'firstIssue.body': 'See ADR-014' },
            { id: 4, 'firstIssue.id': null, 'firstIssue.title': null,                 'firstIssue.body': null },
        ])
        const connection = ctx.conn

        // doc-start
        const firstIssue = tIssue.forUseInLeftJoinAs('firstIssue')

        const projects = await connection.selectFrom(tProject)
            .leftJoin(firstIssue).on(firstIssue.projectId.equals(tProject.id).and(firstIssue.number.equals(1)))
            .select({
                id: tProject.id,
                firstIssue: {
                    id:    firstIssue.id,
                    title: firstIssue.title,
                    body:  firstIssue.body,
                },
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id", firstIssue.id as "firstIssue.id", firstIssue.title as "firstIssue.title", firstIssue."body" as "firstIssue.body" from project left join issue firstIssue on firstIssue.project_id = project.id and firstIssue."number" = :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projects, Array<{
            id: number
            firstIssue?: {
                id:    number
                title: string
                body?: string
            }
        }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:complex-projections/rule-2-a-whole-table', async () => {
        // Section "Rule 2": a left-joined table in place of its columns. Only the
        // organizations with the plan pro are joined: Globex Ltd's projects have no match.
        const acme = { id: 1, name: 'Acme Corp', plan: 'pro', verified: true, createdAt: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)) }
        const noMatch = {
            'proOrganization.id':        null,
            'proOrganization.name':      null,
            'proOrganization.plan':      null,
            'proOrganization.verified':  null,
            'proOrganization.createdAt': null,
        }
        const expected = [
            { id: 1, proOrganization: acme },
            { id: 2, proOrganization: acme },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext([
            { id: 1, proOrganization: acme },
            { id: 2, proOrganization: acme },
            { id: 3, ...noMatch },
            { id: 4, ...noMatch },
        ])
        const connection = ctx.conn

        // doc-start
        const proOrganization = tOrganization.forUseInLeftJoinAs('proOrganization')

        const projects = await connection.selectFrom(tProject)
            .leftJoin(proOrganization).on(proOrganization.id.equals(tProject.organizationId).and(proOrganization.plan.equals('pro')))
            .select({
                id: tProject.id,
                proOrganization: proOrganization,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id", proOrganization.id as "proOrganization.id", proOrganization.name as "proOrganization.name", proOrganization."plan" as "proOrganization.plan", case proOrganization.verified when 'Y' then 1 when 'N' then 0 else null end as "proOrganization.verified", proOrganization.created_at as "proOrganization.createdAt" from project left join "organization" proOrganization on proOrganization.id = project.organization_id and proOrganization."plan" = :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "pro",
          ]
        `)
        assertType<Exact<typeof projects, Array<{
            id: number
            proOrganization?: { id: number; name: string; plan: string; verified: boolean; createdAt: Date }
        }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:complex-projections/rule-3-required-property', async () => {
        // Section "Rule 3": the title of the issue keeps the object, whatever the left
        // join finds. Issue 3 has no body and no assignee.
        const expected = [
            { id: 1, info: { title: 'Update hero copy', assigneeName: 'Ada Lovelace' } },
            { id: 2, info: { title: 'Redesign navbar', body: 'Use new tokens', assigneeName: 'Grace Hopper' } },
            { id: 3, info: { title: 'Migrate to ESM' } },
            { id: 4, info: { title: 'Document /v2/users', body: 'See ADR-014', assigneeName: 'Alan Turing' } },
        ]
        ctx.mockNext([
            { id: 1, 'info.title': 'Update hero copy',   'info.body': null,             'info.assigneeName': 'Ada Lovelace' },
            { id: 2, 'info.title': 'Redesign navbar',    'info.body': 'Use new tokens', 'info.assigneeName': 'Grace Hopper' },
            { id: 3, 'info.title': 'Migrate to ESM',     'info.body': null,             'info.assigneeName': null },
            { id: 4, 'info.title': 'Document /v2/users', 'info.body': 'See ADR-014',    'info.assigneeName': 'Alan Turing' },
        ])
        const connection = ctx.conn

        // doc-start
        const assignee = tAppUser.forUseInLeftJoinAs('assignee')

        const issues = await connection.selectFrom(tIssue)
            .leftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id: tIssue.id,
                info: {
                    title:        tIssue.title,
                    body:         tIssue.body,
                    assigneeName: assignee.fullName,
                },
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", issue.title as "info.title", issue."body" as "info.body", assignee.full_name as "info.assigneeName" from issue left join app_user assignee on assignee.id = issue.assignee_id order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id: number
            info: {
                title:         string
                body?:         string
                assigneeName?: string
            }
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:complex-projections/rule-4-only-optional-properties', async () => {
        // Section "Rule 4": the same columns as rule 1 without the mark. Issue 4 keeps
        // the object now, and issue 3, with no value at all, is the only one without it.
        const expected = [
            { id: 1, meta: { externalRef: '0a8f9c1e-1111-4222-8333-444455556666', assigneeId: 1 } },
            { id: 2, meta: { externalRef: '7b3e9d20-2222-4c55-9b66-dddd00009999', assigneeId: 2, body: 'Use new tokens' } },
            { id: 3 },
            { id: 4, meta: { assigneeId: 3, body: 'See ADR-014' } },
        ]
        ctx.mockNext([
            { id: 1, 'meta.externalRef': '0a8f9c1e-1111-4222-8333-444455556666', 'meta.assigneeId': 1, 'meta.body': null },
            { id: 2, 'meta.externalRef': '7b3e9d20-2222-4c55-9b66-dddd00009999', 'meta.assigneeId': 2, 'meta.body': 'Use new tokens' },
            { id: 3, 'meta.externalRef': null, 'meta.assigneeId': null, 'meta.body': null },
            { id: 4, 'meta.externalRef': null, 'meta.assigneeId': 3, 'meta.body': 'See ADR-014' },
        ])
        const connection = ctx.conn

        // doc-start
        const issues = await connection.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                meta: {
                    externalRef: tIssue.externalRef,
                    assigneeId:  tIssue.assigneeId,
                    body:        tIssue.body,
                },
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", raw_to_uuid(external_ref) as "meta.externalRef", assignee_id as "meta.assigneeId", "body" as "meta.body" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id: number
            meta?: {
                externalRef?: string
                assigneeId?:  number
                body?:        string
            }
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:complex-projections/optional-values-as-null', async () => {
        // Section "Optional values as null": what's left out by default is null. Issues
        // 3 and 4 have no object, and no issue has a parent.
        const expected = [
            { id: 1, parentId: null, meta: { externalRef: '0a8f9c1e-1111-4222-8333-444455556666', assigneeId: 1, body: null } },
            { id: 2, parentId: null, meta: { externalRef: '7b3e9d20-2222-4c55-9b66-dddd00009999', assigneeId: 2, body: 'Use new tokens' } },
            { id: 3, parentId: null, meta: null },
            { id: 4, parentId: null, meta: null },
        ]
        ctx.mockNext([
            { id: 1, parentId: null, 'meta.externalRef': '0a8f9c1e-1111-4222-8333-444455556666', 'meta.assigneeId': 1, 'meta.body': null },
            { id: 2, parentId: null, 'meta.externalRef': '7b3e9d20-2222-4c55-9b66-dddd00009999', 'meta.assigneeId': 2, 'meta.body': 'Use new tokens' },
            { id: 3, parentId: null, 'meta.externalRef': null, 'meta.assigneeId': null, 'meta.body': null },
            { id: 4, parentId: null, 'meta.externalRef': null, 'meta.assigneeId': 3, 'meta.body': 'See ADR-014' },
        ])
        const connection = ctx.conn

        // doc-start
        const issues = await connection.selectFrom(tIssue)
            .select({
                id:       tIssue.id,
                parentId: tIssue.parentId,
                meta: {
                    externalRef: tIssue.externalRef.asRequiredInOptionalObject(),
                    assigneeId:  tIssue.assigneeId.asRequiredInOptionalObject(),
                    body:        tIssue.body,
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", parent_id as "parentId", raw_to_uuid(external_ref) as "meta.externalRef", assignee_id as "meta.assigneeId", "body" as "meta.body" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:       number
            parentId: number | null
            meta: {
                externalRef: string
                assigneeId:  number
                body:        string | null
            } | null
        }>>>()
        expect(issues).toEqual(expected)
    })
})
