// Coverage of `.customizeQuery({...})` on **compound** queries
// (UNION / UNION ALL / INTERSECT / EXCEPT). Compound queries land on a
// different code path in `AbstractSqlBuilder._buildSelectWithColumnsInfo`
// (the `query.__type === 'compound'` branch around
// [L769](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L769))
// than ordinary SELECTs, and accept a narrower
// [CompoundSelectCustomization](../../../../../src/expressions/select.ts)
// — only `beforeQuery`, `afterQuery`, `beforeWithQuery`, `afterWithQuery`,
// plus `queryExecutionName` / `queryExecutionMetadata` (separately
// exercised in `docs.advanced.query-execution-metadata.test.ts`).
//
// The existing `select.compound*` tests pin the raw compound shape;
// `customize-query.select.test.ts` covers the SELECT-specific hooks.
// Nothing in the suite exercises the *compound* hooks, so the
// `customization.beforeQuery / afterQuery` branches at L779-L802 are
// only reachable through this file. The WITH-wrapped branch is
// exercised by the second test below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* compound-head */  select \`name\` as label from project where archived_at is null union select title as label from issue where \`status\` = ? order by label  /* compound-tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "done",
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
    })

    // Not applicable on MySQL: the library does not expose `.intersect`
    // (or `.except`) on MySqlConnection because MySQL has no native
    // INTERSECT / EXCEPT — `select.compound.test.ts` makes the same
    // exclusion. See other cells for the canonical body.
    /*
    test('customize-compound-with-query-hooks-wrap-cte', async () => {
        // ... see other cells for the full body — uses `.intersect(...)`
        // which is not typed on MySqlConnection.
    })
    */

    // Not applicable on MySQL: `.except` not exposed (see above).
    /*
    test('customize-compound-all-hooks-combined-on-except', async () => {
        // ... see other cells for the full body — uses `.except(...)`
        // which is not typed on MySqlConnection.
    })
    */

    test('customize-compound-hook-interpolates-bound-param', async () => {
        // The `beforeQuery` hook interpolates a runtime value via
        // `${connection.const(...)}` — exercises the path where a
        // compound's customization fragment binds its own param into
        // the surrounding query (locks the param-order story for
        // hook-params relative to compound-body params: hook param
        // FIRST, body params after).
        //
        // Mock-only: the placeholder is emitted inside a `/* ... */`
        // SQL comment, and several drivers (incl. bun:sqlite) strip
        // comments before counting placeholders and reject the extra
        // param at execution. DESIGN.md §1 #18 names "synthetic SQL
        // that is the test's whole point" as the documented exception
        // for the guard — mirrors the same guard on
        // `customize-select-hook-fragment-with-bound-param`.
        if (ctx.realDbEnabled) return
        const connection = ctx.conn
        const projectsQ = connection.selectFrom(tProject)
            .where(tProject.archivedAt.isNull())
            .select({ label: tProject.name })
        const issuesQ = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ label: tIssue.title })
        ctx.mockNext([{ label: 'Update hero copy' }])
        const result = await projectsQ
            .union(issuesQ)
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* tenant=${connection.const(42, 'int')} */ `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* tenant=? */  select \`name\` as label from project where archived_at is null union select title as label from issue where \`status\` = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            42,
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
    })
})
