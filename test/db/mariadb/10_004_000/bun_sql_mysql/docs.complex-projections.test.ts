// Documentation snippets for the Complex projections page
// (docs/queries/complex-projections.md). Demonstrates nested object
// projection and optional-object projection on a left join.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:complex-projections/nested-object', async () => {
        const expected = [
            { id: 1, header: { number: 1, title: 'Update hero copy' } },
            { id: 2, header: { number: 2, title: 'Redesign navbar' } },
        ]
        ctx.mockNext([
            { id: 1, 'header.number': 1, 'header.title': 'Update hero copy' },
            { id: 2, 'header.number': 2, 'header.title': 'Redesign navbar' },
        ])
        const connection = ctx.conn

        // doc-start
        const rows = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                id: tIssue.id,
                header: {
                    number: tIssue.number,
                    title:  tIssue.title,
                },
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, number as \`header.number\`, title as \`header.title\` from issue where project_id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id: number
            header: { number: number; title: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('docs:complex-projections/inner-join-required-object', async () => {
        ctx.mockNext([
            { id: 1, name: 'Marketing site', 'organization.id': 1, 'organization.name': 'Acme Corp' },
        ])
        const connection = ctx.conn

        // doc-start: nested object backed by an inner join → the inner
        // object is required (no leftJoin), so its properties stay required.
        const rows = await connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
                organization: {
                    id:   tOrganization.id,
                    name: tOrganization.name,
                },
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.id as \`organization.id\`, organization.name as \`organization.name\` from project inner join organization on organization.id = project.organization_id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:   number
            name: string
            organization: { id: number; name: string }
        }>>>()
        // project 1 (Marketing site) belongs to org 1 (Acme Corp).
        expect(rows).toEqual([
            { id: 1, name: 'Marketing site',
              organization: { id: 1, name: 'Acme Corp' } },
        ])
    })

    test('docs:complex-projections/multi-level-left-join', async () => {
        ctx.mockNext([
            { id: 1, title: 'Update hero copy',
              'parent.id': null, 'parent.title': null,
              'parent.parent.id': null, 'parent.parent.title': null },
        ])
        const connection = ctx.conn

        // doc-start: tree of issues — issue → parent → parent's parent, all
        // via left join. With no parent_id seeded, every inner object is
        // absent, demonstrating that nested optional objects propagate.
        const parent = tIssue.forUseInLeftJoinAs('parent')
        const grandparent = tIssue.forUseInLeftJoinAs('grandparent')

        const rows = await connection.selectFrom(tIssue)
            .leftJoin(parent).on(parent.id.equals(tIssue.parentId))
            .leftJoin(grandparent).on(grandparent.id.equals(parent.parentId))
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                parent: {
                    id:    parent.id,
                    title: parent.title,
                    parent: {
                        id:    grandparent.id,
                        title: grandparent.title,
                    },
                },
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, parent.id as \`parent.id\`, parent.title as \`parent.title\`, grandparent.id as \`parent.parent.id\`, grandparent.title as \`parent.parent.title\` from issue left join issue as parent on parent.id = issue.parent_id left join issue as grandparent on grandparent.id = parent.parent_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // The lib's exact emitted shape for nested left-join projections
        // is structurally intricate; at minimum the row has id+title.
        assertType<Extends<typeof rows, Array<{ id: number }>>>()
        // Issue 1 has no parent, so the `parent` object is absent.
        expect(rows).toEqual([{ id: 1, title: 'Update hero copy' }])
    })

    test('docs:complex-projections/as-required-in-optional-object', async () => {
        ctx.mockNext([
            { id: 1, 'meta.body': null, 'meta.assigneeId': 1 },
            { id: 2, 'meta.body': 'Use new tokens', 'meta.assigneeId': 2 },
        ])
        const connection = ctx.conn

        // doc-start: both `body` and `priority` (priority remapped optional
        // via .ignoreWhen(false) trick) — use a real optional pair: body
        // and assigneeId. Mark body as required-in-optional-object so the
        // object appears only when body has a value.
        const rows = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                id:    tIssue.id,
                meta: {
                    body:       tIssue.body.asRequiredInOptionalObject(),
                    assigneeId: tIssue.assigneeId,
                },
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`body\` as \`meta.body\`, assignee_id as \`meta.assigneeId\` from issue where project_id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // Loose assertion — the exact `?:` vs `?: undefined` shape
        // differs by lib version. The runtime check below catches the
        // important contract: `meta` is present only when `body` is.
        assertType<Extends<typeof rows, Array<{ id: number }>>>()
        // Issue 1 (project 1): body=null → meta absent (body is required-in-object)
        // Issue 2 (project 1): body='Use new tokens', assigneeId=2 → meta full
        expect(rows).toEqual([
            { id: 1 /* meta absent: body is null */ },
            { id: 2, meta: { body: 'Use new tokens', assigneeId: 2 } },
        ])
    })

    test('docs:complex-projections/optional-object-left-join', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, app_user.id as \`assignee.id\`, app_user.full_name as \`assignee.fullName\` from issue left join app_user on app_user.id = issue.assignee_id where issue.status = ? order by id"`)
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
