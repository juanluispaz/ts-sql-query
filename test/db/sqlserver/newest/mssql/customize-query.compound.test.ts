// Coverage of `.customizeQuery({...})` on **compound** queries
// (UNION / UNION ALL / INTERSECT / EXCEPT). Compound queries land on a
// different code path in `AbstractSqlBuilder._buildSelectWithColumnsInfo`
// (the `query.__type === 'compound'` branch around
// than ordinary SELECTs, and accept a narrower
// — only `beforeQuery`, `afterQuery`, `beforeWithQuery`, `afterWithQuery`,
// plus `queryExecutionName` / `queryExecutionMetadata` (separately
// exercised in `docs.advanced.query-execution-metadata.test.ts`).
//
// The existing `select.compound*` tests pin the raw compound shape;
// `customize-query.select.test.ts` covers the SELECT-specific hooks.
// Nothing in the suite exercises the *compound* hooks, so the
// `customization.beforeQuery / afterQuery` branches are
// only reachable through this file. The WITH-wrapped branch is
// exercised by the second test below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryExecutionName, getQueryExecutionMetadata } from '../../../../../src/queryRunners/QueryRunner.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('customize-compound-before-and-after-query-wrap-union', async () => {
        // `beforeQuery` + `afterQuery` wrap the whole compound. The
        // hooks emit comments around `select … union select …` so the
        // snapshot pins both attachment points in one shot.
        const expected = [
            { label: 'Internal tools' },
            { label: 'Marketing site' },
            { label: 'Public API' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const projectsQ = connection.selectFrom(tProject)
            .where(tProject.archivedAt.isNull())
            .select({ label: tProject.name })
        const issuesQ = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('done'))
            .select({ label: tIssue.title })
        const result = await projectsQ
            .union(issuesQ)
            .orderBy('label')
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* compound-head */ `,
                afterQuery:  connection.rawFragment` /* compound-tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* compound-head */  select name as [label] from project where archived_at is null union select title as [label] from issue where status = @0 order by [label]  /* compound-tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "done",
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
    })

    test('customize-compound-with-query-hooks-wrap-cte', async () => {
        // A CTE feeds the left side of an INTERSECT; the compound
        // carries `beforeWithQuery` / `afterWithQuery` hooks that
        // wrap the WITH clause itself (NOT the inner select), so the
        // snapshot shows the comments adjacent to `with` / before the
        // first compound branch. Lands on
        // `_buildWith` → `customization.beforeWithQuery / afterWithQuery`
        // at AbstractSqlBuilder.
        const connection = ctx.conn
        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id })
            .forUseInQueryAs('openIssues')
        const left = connection.selectFrom(openIssues)
            .select({ id: openIssues.id })
        const right = connection.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ id: tIssue.id })
        ctx.mockNext([{ id: 1 }])
        const result = await left
            .intersect(right)
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with openIssues as (select id as id from issue where status = @0) select id as id from openIssues intersect select id as id from issue where id <= @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-compound-all-hooks-combined-on-except', async () => {
        // The four compound hooks at once on an EXCEPT. Documents
        // exactly where each one lands relative to the others — the
        // snapshot is the spec.
        const connection = ctx.conn
        const allIssueIds = connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .forUseInQueryAs('allIssueIds')
        const left = connection.selectFrom(allIssueIds)
            .select({ id: allIssueIds.id })
        const right = connection.selectFrom(tIssue)
            .where(tIssue.priority.equals(1))
            .select({ id: tIssue.id })
        ctx.mockNext([{ id: 1 }, { id: 3 }, { id: 4 }])
        const result = await left
            .except(right)
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  with allIssueIds as (select id as id from issue) select id as id from allIssueIds except select id as id from issue where priority = @0 order by id  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-compound-carries-query-execution-name-and-metadata', async () => {
        // `queryExecutionName` / `queryExecutionMetadata` are accepted on the
        // customizeQuery of a compound query: they don't change the emitted SQL
        // (the union snapshot is unchanged) but the metadata is attached to the
        // execution and read back via the QueryRunner helpers.
        const expected = [{ label: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject).where(tProject.id.equals(1)).select({ label: tProject.name })
            .union(connection.selectFrom(tIssue).where(tIssue.id.equals(99999)).select({ label: tIssue.title }))
            .orderBy('label')
            .customizeQuery({
                queryExecutionName:     'compound label query',
                queryExecutionMetadata: { team: 'platform' },
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as [label] from project where id = @0 union select title as [label] from issue where id = @1 order by [label]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            99999,
          ]
        `)
        expect(getQueryExecutionName(ctx.lastSql, ctx.lastParams)).toBe('compound label query')
        expect(getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)).toEqual({ team: 'platform' })
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

})
