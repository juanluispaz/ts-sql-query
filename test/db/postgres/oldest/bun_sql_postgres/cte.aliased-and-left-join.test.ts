// CTE shape variants the existing `cte.chained.test.ts` and
// `select.cte.test.ts` do not exercise. Specifically targets the
// `WithViewImpl` branches
// not reached by current coverage:
//
// `as(alias)` and the `__originalWith` bookkeeping it
// populates — exposed by calling `.as('alias')` on a CTE,
//     which constructs a new WithViewImpl whose `__originalWith` points
//     back to the source. The recursive `__addWiths` walks the
//     `__originalWith` chain rather than re-registering the alias
//     itself.
// `forUseInLeftJoin` / `forUseInLeftJoinAs(alias)`
// same WithViewImpl constructor path, but with
//     `__forUseInLeftJoin = true` and `__setColumnsForLeftJoin`
//     marking every CTE column optional. The outer SELECT then emits
//     `left join cte on …` (or `left join cte alias on …`).
// `__addWiths` dedup branch — a CTE joined against its own
//     alias must appear exactly once in the `WITH` clause; the
//     `if (!withs.includes(this))` short-circuit makes that happen.
//
// The `__hasExternalDependencies = true` branch is set only
// when the underlying `selectData.__subSelectUsing` is non-empty, but
// `subSelectUsing(...)` returns a `SelectExpressionSubquery` that
// does not type-expose `forUseInQueryAs(...)`. The branch is currently
// not reachable via the public API; left uncovered.
//
// All four are dialect-portable (every dialect supports CTEs in SELECT
// FROM and as a left-join target). The snapshots differ only in
// boolean spelling / alias quoting; the test names are identical
// across every cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('cte-aliased-via-as-keeps-original-with-name-in-with-clause', async () => {
        // `openIssues.as('oi')` creates a renamed reference whose
        // `__originalWith` chain points back at the source. The outer
        // SELECT must use `oi` everywhere it references the CTE, but
        // the `WITH` declaration MUST keep the source name —
        // `__addWiths` walks `__originalWith` and never registers the
        // alias itself.
        ctx.mockNext([{ id: 1, projectId: 10 }, { id: 2, projectId: 10 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const oi = openIssues.as('oi')

        const result = await connection.selectFrom(oi)
            .where(oi.projectId.equals(10))
            .select({ id: oi.id, projectId: oi.projectId })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select id as id, project_id as projectId from issue where status = $1) select oi.id as id, oi.projectId as "projectId" from open_issues as oi where oi.projectId = $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            10,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; projectId: number }>>>()
    })

    test('cte-forUseInLeftJoin-emits-left-join-and-marks-columns-optional', async () => {
        // `openIssues.forUseInLeftJoin()` flips `__forUseInLeftJoin =
        // true` and `__setColumnsForLeftJoin` widens every
        // CTE column to `optional`. The outer SELECT must emit
        // `left join open_issues on …` and the projected `openId`
        // surfaces as `number | undefined` in the typed result.
        ctx.mockNext([
            { projectName: 'Marketing site', openId: 1 },
            { projectName: 'Internal tools', openId: undefined },
        ])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')
            .forUseInLeftJoin()

        const result = await connection.selectFrom(tProject)
            .leftJoin(openIssues).on(openIssues.projectId.equals(tProject.id))
            .select({
                projectName: tProject.name,
                openId:      openIssues.id,
            })
            .orderBy('projectName')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select id as id, project_id as projectId from issue where status = $1) select project.name as "projectName", open_issues.id as "openId" from project left join open_issues on open_issues.projectId = project.id order by "projectName""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectName: string; openId?: number }>>>()
    })

    test('cte-forUseInLeftJoinAs-uses-alias-in-on-and-projection', async () => {
        // `forUseInLeftJoinAs('alias')` combines the two previous
        // paths: alias + left-join. The ON clause references the
        // alias; the `WITH` declaration keeps the source name. Pins
        // WithViewImpl.
        ctx.mockNext([
            { projectName: 'Marketing site', openId: 1 },
            { projectName: 'Internal tools', openId: undefined },
        ])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')
            .forUseInLeftJoinAs('oi')

        const result = await connection.selectFrom(tProject)
            .leftJoin(openIssues).on(openIssues.projectId.equals(tProject.id))
            .select({
                projectName: tProject.name,
                openId:      openIssues.id,
            })
            .orderBy('projectName')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select id as id, project_id as projectId from issue where status = $1) select project.name as "projectName", oi.id as "openId" from project left join open_issues as oi on oi.projectId = project.id order by "projectName""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectName: string; openId?: number }>>>()
    })

    test('cte-aliased-then-joined-against-same-cte-emits-with-once', async () => {
        // `openIssues` is registered as a CTE; the outer query joins
        // it once unaliased and once via `.as('oi2')`. The `__addWiths`
        // bookkeeping must dedupe — the aliased reference's
        // `__originalWith` points at the same WithViewImpl,
        // so the WITH clause lists the CTE exactly once even though
        // two references appear in FROM/JOIN. Combines
        // (`as`) with the dedup branch of `__addWiths`.
        ctx.mockNext([{ projectId: 10, leftId: 1, rightId: 2 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const oi2 = openIssues.as('oi2')

        const result = await connection.selectFrom(openIssues)
            .innerJoin(oi2).on(oi2.projectId.equals(openIssues.projectId))
              .and(oi2.id.greaterThan(openIssues.id))
            .select({
                projectId: openIssues.projectId,
                leftId:    openIssues.id,
                rightId:   oi2.id,
            })
            .orderBy('leftId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select id as id, project_id as projectId from issue where status = $1) select open_issues.projectId as "projectId", open_issues.id as "leftId", oi2.id as "rightId" from open_issues inner join open_issues as oi2 on oi2.projectId = open_issues.projectId and oi2.id > open_issues.id order by "leftId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectId: number; leftId: number; rightId: number }>>>()
    })
})
