// Coverage of the column-map propagation walk in the value-as-array
// aggregates that the other aggregate-as-array tests miss: a deeply-nested
// column map, a non-leaf expression operand, and the two factory paths
// into the NULL variant (onlyWhenOrNull(false) / ignoreWhenAsNull(true)).
//
// the array aggregate has no ORDER BY, so the array order is not deterministic on the
// real engine — value assertions sort the array before comparing.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { dynamicPick } from '../../../../../src/dynamic/pick.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-as-array-with-deeply-nested-map-recurses-propagation', async () => {
        // `aggregateAsArray({ issue: { id, title } })` lands a two-level
        // nested column map, so the propagation walk recurses before
        // reaching the leaf columns.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(json_object('issue.id':issue.id, 'issue.title':issue.title)) as issues from project left join issue on issue.project_id = project.id where project.id = @0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            issues: Array<{ issue?: { id: number; title: string } | undefined }>
            pid:    number
        }>>>()
        // Project 1 has issues 1 ('Update hero copy') and 2 ('Redesign
        // navbar'); the aggregate is unordered, so sort by issue id in JS.
        const sorted = rows.map(r => ({
            ...r,
            issues: [...r.issues].sort((a, b) => (a.issue?.id ?? 0) - (b.issue?.id ?? 0)),
        }))
        expect(sorted).toEqual([{
            pid: 1,
            issues: [
                { issue: { id: 1, title: 'Update hero copy' } },
                { issue: { id: 2, title: 'Redesign navbar' } },
            ],
        }])
    })

    test('aggregate-as-array-of-one-column-with-expression-fires-case-2', async () => {
        // `aggregateAsArrayOfOneColumn(tIssue.priority.plus(1))` passes
        // a non-leaf value source (an expression wrapping the column).
        // The `__*Of` methods hit case 2 (`isValueSource(...)`) at the
        // root — the value source IS a `SqlOperation1ValueSource`
        // whose own propagation walks its child column. This pins
        // /
        // `AggregateValueAsArrayValueSource`.
        ctx.mockNext([{ pid: 1, bumped: [2, 3] }])

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(issue.priority + @0 null on null) as bumped from project left join issue on issue.project_id = project.id where project.id = @1 group by project.id"`)
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
        // Project 1 has issues 1 (priority 2) and 2 (priority 1); +1 each
        // -> {3, 2}. The aggregate is unordered, so sort in JS.
        const sorted = rows.map(r => ({ ...r, bumped: [...r.bumped].sort((a, b) => a - b) }))
        expect(sorted).toEqual([{ pid: 1, bumped: [2, 3] }])
    })

    test('aggregate-as-array-with-only-when-or-null-false-uses-null-variant', async () => {
        // `onlyWhenOrNull(false)` swaps in the NULL variant, so the
        // column emits literal `null` and the projected object is absent.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, null as issues from project left join issue on issue.project_id = project.id where project.id = @0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues?: Array<{ id: number; title: string }>
        }>>>()
        expect(rows).toEqual([{ pid: 1 }])
    })

    test('aggregate-as-array-with-ignore-when-as-null-true-also-uses-null-variant', async () => {
        // `ignoreWhenAsNull(true)` is the sibling factory for the NULL
        // variant; same emitted `null as issues`.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, null as issues from project left join issue on issue.project_id = project.id where project.id = @0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues?: Array<{ id: number; title: string }>
        }>>>()
        expect(rows).toEqual([{ pid: 1 }])
    })
    test('aggregate-as-array-of-a-dynamic-pick-projection', async () => {
        // The aggregateAsArray element is a `dynamicPick(...)` result (a runtime-selected
        // projection) rather than a literal object: the picked fields drive the
        // aggregated element shape, and it emits a single valid json_agg. Project 1 owns
        // issues 1 ('Update hero copy') and 2 ('Redesign navbar').
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const availableFields = { iid: tIssueLeft.id, title: tIssueLeft.title }
        const picked = dynamicPick(availableFields, { iid: true, title: true }, ['iid'])
        ctx.mockNext([{ pid: 1, issues: [{ iid: 1, title: 'Update hero copy' }, { iid: 2, title: 'Redesign navbar' }] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues: ctx.conn.aggregateAsArray(picked) })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(json_object('iid':issue.id, 'title':issue.title)) as issues from project left join issue on issue.project_id = project.id where project.id = @0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ iid?: number | undefined; title?: string | undefined }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.iid! - b.iid!) }))
        expect(sorted).toEqual([{ pid: 1, issues: [{ iid: 1, title: 'Update hero copy' }, { iid: 2, title: 'Redesign navbar' }] }])
    })

    test('builder-projecting-flag-and-bare-aggregate-project-optionals-independently', async () => {
        // Two projection flags live in ONE query and act INDEPENDENTLY:
        //   - the BUILDER-level `.projectingOptionalValuesAsNullable()` retypes the
        //     flat top-level optional leaf `optArchived` to a present required-null
        //     (`Date | null`) — the general-projection branch of the transform walk.
        //   - the co-selected BARE `aggregateAsArray({...})` (WITHOUT its own
        //     `.projectingOptionalValuesAsNullable()`) keeps the AGGREGATE default:
        //     its optional element leaf `body` is DROPPED (absent at runtime), NOT
        //     flipped to present-null — the aggregated-array branch reads the
        //     aggregate's own (unset) flag, not the builder's.
        // So in the SAME row the flat leaf surfaces present-null while the aggregate
        // element's null leaf is dropped: the two flags do not leak into each other.
        // Project 1 (archived_at NULL) owns issues 1 (body NULL) and 2 (body set).
        ctx.mockNext([{
            pid:         1,
            optArchived: null,
            issues: [
                { id: 1, body: null },
                { id: 2, body: 'Use new tokens' },
            ],
        }])

        // groupBy-BEFORE-select shape so the builder-level
        // `.projectingOptionalValuesAsNullable()` is reachable after `.select(...)`.
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .groupBy(tProject.id, tProject.archivedAt)
            .select({
                pid:         tProject.id,
                optArchived: tProject.archivedAt,
                issues:      ctx.conn.aggregateAsArray({ id: tIssue.id, body: tIssue.body }),
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project.archived_at as optArchived, json_arrayagg(json_object('id':issue.id, 'body':issue.body)) as issues from project inner join issue on issue.project_id = project.id where project.id = @0 group by project.id, project.archived_at"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:         number
            optArchived: Date | null
            issues:      Array<{ id: number; body?: string }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{
            pid:         1,
            optArchived: null,
            issues: [
                { id: 1 },
                { id: 2, body: 'Use new tokens' },
            ],
        }])
        // The flat optional leaf is PRESENT-null (builder flag) …
        expect('optArchived' in rows[0]!).toBe(true)
        expect(rows[0]!.optArchived).toBe(null)
        // … while the aggregate element's null leaf is DROPPED (aggregate default),
        // NOT reshaped to present-null by the builder flag.
        const issue1 = rows[0]!.issues.find(i => i.id === 1)!
        expect('body' in issue1).toBe(false)
    })
})
