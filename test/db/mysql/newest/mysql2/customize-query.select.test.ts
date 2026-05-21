// Exhaustive coverage of `customizeQuery({...})` hooks on SELECT.
// The docs page ([docs/queries/sql-fragments.md]) covers
// `afterSelectKeyword` + `afterQuery` only; this file fills in the
// rest of the `SelectCustomization` surface defined at
// [src/expressions/select.ts:L16](../../../../../src/expressions/select.ts#L16):
// `beforeColumns`, `customWindow`, `beforeOrderByItems`,
// `afterOrderByItems`, `beforeQuery`, `beforeWithQuery`, and
// `afterWithQuery`. Each hook routes through `_appendRawFragment`
// at the corresponding branch in
// [src/sqlBuilders/AbstractSqlBuilder.ts](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts)
// (see lines 779, 800, 872, 880, 960, 1010, 1014, 1035, 1074, 977
// for the SELECT/COMPOUND-SELECT paths).
//
// Hooks also accept fragments that interpolate columns and bound
// values, which exercises the `__registerRequiredColumn`/`__addWiths`
// forwarding through the SELECT builder
// ([src/queryBuilders/SelectQueryBuilder.ts:459-466 / 606-612 / 1060-1066](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L459)).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('customize-select-before-columns-with-hint', async () => {
        // `beforeColumns` splices a fragment between the SELECT
        // keyword (and its `afterSelectKeyword` slot) and the column
        // list. Used here for an optimiser hint that has to land
        // immediately before the projections.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`/*+ INDEX(project pk) */ `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /*+ INDEX(project pk) */  id as id from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-custom-window-emits-named-window', async () => {
        // `customWindow` is the slot for a `WINDOW name AS (...)` clause
        // - the builder always prefixes with the `window ` keyword
        // (see [AbstractSqlBuilder.ts:L960](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L960)),
        // so the fragment supplies just the window definition.
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                customWindow: connection.rawFragment`priority_w as (partition by ${tIssue.priority})`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = ? window priority_w as (partition by priority) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-after-order-by-items-trailing-tiebreaker', async () => {
        // `afterOrderByItems` appends a fragment as an additional
        // ORDER BY entry, comma-joined after the explicit items. The
        // canonical use case is a deterministic tie-breaker by the
        // unique row id when the primary sort key (here `priority`)
        // can have ties.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(tIssue.priority)
            .customizeQuery({
                afterOrderByItems: connection.rawFragment`${tIssue.id} desc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.priority, issue.id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-before-query-emits-leading-comment', async () => {
        // `beforeQuery` lands its fragment before any other SQL — the
        // canonical use case is a pgbouncer-style routing comment or
        // a query-id marker the proxy logs verbatim.
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* route=analytics-replica */ `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* route=analytics-replica */  select id as id from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-before-with-query-and-after-with-query-wrap-cte', async () => {
        // `beforeWithQuery` / `afterWithQuery` live on the INNER
        // SELECT customization (not the outer), and only render once
        // that SELECT is materialised as a CTE via
        // `.forUseInQueryAs(...)`. The builder splices the fragments
        // around the `(...)` parens, between the CTE name and body,
        // see [AbstractSqlBuilder.ts:L573-L581](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L573).
        ctx.mockNext([{ id: 1, issueId: 1 }])
        const connection = ctx.conn
        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* warmup */`,
                afterWithQuery:  connection.rawFragment`/* end-of-with */`,
            })
            .forUseInQueryAs('open_issues')

        const result = await connection.selectFrom(tProject)
            .innerJoin(openIssues).on(openIssues.projectId.equals(tProject.id))
            .select({ id: tProject.id, issueId: openIssues.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as /* warmup */ (select id as id, project_id as projectId from issue where \`status\` = ?) /* end-of-with */ select project.id as id, open_issues.id as issueId from project inner join open_issues on open_issues.projectId = project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; issueId: number }>>>()
    })

    test('customize-select-hook-fragment-with-bound-param', async () => {
        // A fragment passed to a hook can interpolate a value source -
        // here a bound integer via `connection.const(...)`. The
        // placeholder ends up inside the comment in the snapshot,
        // proving the fragment routes through `_appendRawFragment` and
        // not as a string splice. Mock-only because some drivers
        // strip comments before counting placeholders and would
        // reject the extra param at execution.
        if (ctx.realDbEnabled) return
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* tenant=${connection.const(42, 'int')} */ `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /* tenant=? */  id as id from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            42,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-hook-fragment-with-column-reference', async () => {
        // A fragment that references a column drives
        // `__registerRequiredColumn` on the customization
        // ([SelectQueryBuilder.ts:459-466](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L459)).
        // Inline column reference rendered as `issue.priority`.
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`${tIssue.priority} desc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = ? order by issue.priority desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-all-rawfragment-hooks-kitchen-sink', async () => {
        // All seven RawFragment-typed hooks on SELECT applied at once
        // - the snapshot is the documentation of exactly where each
        // one lands relative to the rest of the SELECT. The three
        // ORDER BY positions use different columns
        // (`organizationId` / `slug` / `id`) so SQL Server doesn't
        // trip on its "column specified more than once in the order
        // by list" check (error 169).
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .orderBy(tProject.organizationId)
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by ${tProject.organizationId})`,
                beforeOrderByItems: connection.rawFragment`${tProject.slug} asc`,
                afterOrderByItems:  connection.rawFragment`${tProject.id} asc`,
                afterQuery:         connection.rawFragment` /* tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id from project window w1 as (partition by organization_id) order by project.slug asc, project.organization_id, project.id asc  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })
})
