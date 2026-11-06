// Documentation snippets for the FAQs page (docs/about/faqs.md) that change
// the query the page shows: functions returning a prebuilt query, with the
// where added by the caller.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import type { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:faqs/reuse-queries-with-functions', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site', numberOfIssues: 2 })

        // doc-start
        function buildNumberOfIssuesSubquery(connection: DBConnection) {
            return connection
                .subSelectUsing(tProject)
                .from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectCountAll()
                .forUseAsInlineQueryValue()
        }

        function buildProjectsWithNumberOfIssuesQuery(connection: DBConnection) {
            return connection.selectFrom(tProject)
                .select({
                    id:             tProject.id,
                    name:           tProject.name,
                    numberOfIssues: buildNumberOfIssuesSubquery(connection),
                })
        }

        const projectInfo = await buildProjectsWithNumberOfIssuesQuery(ctx.conn)
            .where(tProject.id.equals(1))
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select count(*) as result from issue where project_id = project.id) as numberOfIssues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectInfo, { id: number; name: string; numberOfIssues: number }>>()
        // Project 1 (Marketing site) has issues 1 and 2.
        expect(projectInfo).toEqual({ id: 1, name: 'Marketing site', numberOfIssues: 2 })
    })
})
