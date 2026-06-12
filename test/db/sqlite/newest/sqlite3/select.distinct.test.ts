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
        // Three distinct statuses across the seed, ordered by status.
        expect(rows).toEqual([{ status: 'closed' }, { status: 'in_progress' }, { status: 'open' }])
    })

    test('select-distinct-with-join-and-where', async () => {
        // Distinct list of organizations that have an open issue. Joins
        // are present so the distinct keyword has to be emitted with a
        // FROM that carries a JOIN clause.
        const expectedMock = [{ orgId: 1 }]
        ctx.mockNext(expectedMock)

        const rows = await ctx.conn.selectDistinctFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tIssue.status.equals('open'))
            .select({ orgId: tProject.organizationId })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct project.organization_id as orgId from project inner join issue on issue.project_id = project.id where issue.status = ? order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ orgId: number }>>>()
        // Open issues belong to projects 1 and 3, both under org 1 → one distinct orgId.
        expect(rows).toEqual([{ orgId: 1 }])
    })

    test('subselect-distinct-using-in-correlated-exists', async () => {
        // `subSelectDistinctUsing(...)` builds a correlated `select
        // distinct` subquery; used inside `exists(...)` it selects the
        // projects that have at least one issue. The DISTINCT is what
        // this test exercises (the connection's `subSelectDistinctUsing`
        // entry point); it is redundant under EXISTS but valid on every
        // engine. Projects 1/2/3 have issues; project 4 has none. This
        // shape stays type-simple — the aggregated-array form tripped a
        // tsgo/tsc inference divergence on the MariaDB connection types.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const rows = await connection.selectFrom(tProject)
            .where(connection.exists(
                connection.subSelectDistinctUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(tIssue.status),
            ))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where exists(select distinct status as result from issue where project_id = project.id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })
})
