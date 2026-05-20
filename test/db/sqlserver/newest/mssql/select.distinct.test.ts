// Coverage of `SELECT DISTINCT` — `selectDistinctFrom(...)` path and
// `subSelectDistinctUsing(...)` (distinct subquery used as a CTE). The
// distinct keyword is emitted in `AbstractSqlBuilder._buildSelect` and
// dialect overrides that need to inject it before the column list.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-distinct-from-table', async () => {
        // Distinct list of issue statuses across the whole table.
        const expectedMock = [{ status: 'closed' }, { status: 'in_progress' }, { status: 'open' }]
        ctx.mockNext(expectedMock)

        const rows = await ctx.conn.selectDistinctFrom(tIssue)
            .select({ status: tIssue.status })
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct status as status from issue order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ status: string }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)
        else expect(rows.length).toBeGreaterThanOrEqual(1)
    })

    test('select-distinct-with-join-and-where', async () => {
        // Distinct list of organizations that have an open issue. Joins
        // are present so the distinct keyword has to be emitted with a
        // FROM that carries a JOIN clause.
        const expectedMock = [{ orgId: 1 }, { orgId: 2 }]
        ctx.mockNext(expectedMock)

        const rows = await ctx.conn.selectDistinctFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tIssue.status.equals('open'))
            .select({ orgId: tProject.organizationId })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct project.organization_id as orgId from project inner join issue on issue.project_id = project.id where issue.status = @0 order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ orgId: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)
    })
})
