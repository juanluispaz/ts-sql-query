// Documentation snippets for the Complex projections page
// (docs/queries/complex-projections.md). Demonstrates nested object
// projection and optional-object projection on a left join.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`number\` as \`header.number\`, title as \`header.title\` from issue where project_id = ? order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, app_user.id as \`assignee.id\`, app_user.full_name as \`assignee.fullName\` from issue left join app_user on app_user.id = issue.assignee_id where issue.\`status\` = ? order by id"`)
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
