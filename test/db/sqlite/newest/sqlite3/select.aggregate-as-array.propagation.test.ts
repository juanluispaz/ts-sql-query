// Coverage of the `__*Of` propagation methods on the two
// "value-as-array" aggregate classes that walk nested column maps:
//
//   - `AggregateValueAsArrayValueSource` (L2356-2502): the regular
//     `aggregateAsArray({...})` / `aggregateAsArrayOfOneColumn(value)`
//     return. Its `__addWithsOf` / `__registerTableOrViewOf` /
//     `__registerRequiredColumnOf` / `__getOldValuesOf` /
//     `__getValuesForInsertOf` / `__isAllowedOf` recurse over the
//     stored `__aggregatedArrayColumns` — three branches each:
//     `null` (no-op), value source (case 2), nested column map
//     (case 3, iterates `for (let prop in …)`).
//   - `NullAggregateValueAsArrayValueSource` (L2560-2651): the
//     `onlyWhenOrNull(false)` / `ignoreWhenAsNull(true)` siblings —
//     same three-branch shape, separate class so its own methods need
//     hitting too.
//
// Existing aggregate-as-array tests only flatten the column map one
// level and never wrap the aggregate in a Null* variant, so the
// recursive case-3 arms and the entire Null* class's propagation
// methods stay uncovered. Each test below picks one of those gaps:
//
//   1. `aggregate-as-array-with-deeply-nested-map-recurses-propagation` —
//      `aggregateAsArray({ outer: { inner: col } })` forces the case-3
//      arm to recurse into its inner sub-object before reaching the
//      leaf value source.
//   2. `aggregate-as-array-of-one-column-with-expression-fires-case-2` —
//      `aggregateAsArrayOfOneColumn(tIssue.priority.plus(1))` passes a
//      non-leaf value source (an expression) directly, hitting case 2
//      of the methods and the value-source path through
//      `SqlOperation1ValueSource.__*`.
//   3. `aggregate-as-array-with-only-when-or-null-false-uses-null-variant` —
//      `aggregateAsArray({...}).onlyWhenOrNull(false)` replaces the
//      regular class with `NullAggregateValueAsArrayValueSource`. The
//      SELECT still builds, and every `__*Of` method on the Null
//      class fires during build, exercising the duplicated propagation
//      block at L2560-2651.
//   4. `aggregate-as-array-with-ignore-when-as-null-true-also-uses-null-variant` —
//      same Null class via the sibling constructor (`ignoreWhenAsNull(true)`),
//      pinning the alternate factory path at L2525-2531.
//
// Nested object inside `aggregateAsArray({...})` is portable across
// every dialect (JSON-aggregate SQL differs only in function name
// per cell), so all four tests run everywhere; the snapshots track
// the per-dialect emission.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-as-array-with-deeply-nested-map-recurses-propagation', async () => {
        // `aggregateAsArray({ issue: { id, title } })` lands a nested
        // column map. During query build, every propagation method on
        // `AggregateValueAsArrayValueSource` calls its own `__*Of`
        // helper at the root, which hits the case-3 arm (`for (let
        // prop in aggregatedArrayColumns)`), recurses on `issue`, hits
        // case 3 again, then recurses on each leaf and finally hits
        // case 2 (value source). The two-level depth makes the
        // recursive iteration observable; flat shapes only hit case 3
        // → case 2 once.
        ctx.mockNext([{
            pid: 1,
            issues: [
                { issue: { id: 1, title: 'Update hero copy' } },
                { issue: { id: 2, title: 'Redesign navbar' } },
            ],
        }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    issue: { id: tIssueLeft.id, title: tIssueLeft.title },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_group_array(json_object('issue.id', issue.id, 'issue.title', issue.title)) as issues from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            issues: Array<{ issue?: { id: number; title: string } | null }>
            pid:    number
        }>>>()
        // json_group_array order is engine-defined; sort by issue id
        // for a stable comparison.
        expect(rows.length).toBe(1)
        expect(rows[0]?.pid).toBe(1)
        const issues = rows[0]?.issues.slice().sort((a, b) => (a.issue?.id ?? 0) - (b.issue?.id ?? 0))
        expect(issues).toEqual([
            { issue: { id: 1, title: 'Update hero copy' } },
            { issue: { id: 2, title: 'Redesign navbar' } },
        ])
    })

    test('aggregate-as-array-of-one-column-with-expression-fires-case-2', async () => {
        // `aggregateAsArrayOfOneColumn(tIssue.priority.plus(1))` passes
        // a non-leaf value source (an expression wrapping the column).
        // The `__*Of` methods hit case 2 (`isValueSource(...)`) at the
        // root — the value source IS a `SqlOperation1ValueSource`
        // whose own propagation walks its child column. This pins
        // L2421-2423 / L2436-2438 / L2451-2453 / L2470-2472 /
        // L2489-2491 of `AggregateValueAsArrayValueSource`.
        // Project 1 has issues 1 (priority 2) and 2 (priority 1); +1 → 3, 2.
        ctx.mockNext([{ pid: 1, bumped: [3, 2] }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                bumped: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.priority.add(1)),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_group_array(issue.priority + ?) as bumped from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            bumped: Array<number>
        }>>>()
        // json_group_array order is engine-defined; sort the bumped
        // priorities for a stable comparison.
        expect(rows.length).toBe(1)
        expect(rows[0]?.pid).toBe(1)
        expect(rows[0]?.bumped.slice().sort((a, b) => a - b)).toEqual([2, 3])
    })

    test('aggregate-as-array-with-only-when-or-null-false-uses-null-variant', async () => {
        // `aggregateAsArray({...}).onlyWhenOrNull(false)` replaces the
        // regular class instance with a `NullAggregateValueAsArrayValueSource`
        // — same `__aggregatedArrayColumns`, separate class with its
        // own duplicated `__*Of` methods at L2560-2651. The SELECT
        // build calls every propagation method on the Null instance,
        // covering the parallel block.
        ctx.mockNext([{ pid: 1, issues: null }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    id:    tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, null as issues from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues?: Array<{ id: number; title: string }>
        }>>>()
        // `null as issues` projects to a missing optional group.
        expect(rows).toEqual([{ pid: 1 }])
    })

    test('aggregate-as-array-with-ignore-when-as-null-true-also-uses-null-variant', async () => {
        // `aggregateAsArray({...}).ignoreWhenAsNull(true)` is the
        // sibling of `onlyWhenOrNull(false)` — same target class
        // (`NullAggregateValueAsArrayValueSource`), different factory
        // path at L2525-2531. This pins the alternate constructor
        // entry while still exercising the Null class's propagation
        // through SELECT build.
        ctx.mockNext([{ pid: 1, issues: null }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    id:    tIssueLeft.id,
                    title: tIssueLeft.title,
                }).ignoreWhenAsNull(true),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, null as issues from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues?: Array<{ id: number; title: string }>
        }>>>()
        // `null as issues` projects to a missing optional group.
        expect(rows).toEqual([{ pid: 1 }])
    })
})
