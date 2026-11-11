// A constant in an object of left join columns says nothing about the left join, also in a compound select.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('compound-object-with-a-constant-is-absent-without-the-left-join-row', async () => {
        const issue = tIssue.forUseInLeftJoin()
        const arm = () => ctx.conn.selectFrom(tProject)
            .leftJoin(issue).on(issue.projectId.equals(tProject.id).and(issue.number.equals(1)))
            .where(tProject.id.equals(4))
            .select({ id: tProject.id, iss: { title: issue.title, tag: ctx.conn.const('x', 'string') } })
        const expected = [{ id: 4 }]
        ctx.mockNext([{ id: 4, 'iss.title': null, 'iss.tag': 'x' }])
        const rows = await arm().union(arm()).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, issue.title as \`iss.title\`, ? as \`iss.tag\` from project left join issue on issue.project_id = project.id and issue.number = ? where project.id = ? union select project.id as id, issue.title as \`iss.title\`, ? as \`iss.tag\` from project left join issue on issue.project_id = project.id and issue.number = ? where project.id = ?"`)
        expect(rows).toEqual(expected)
    })
})
