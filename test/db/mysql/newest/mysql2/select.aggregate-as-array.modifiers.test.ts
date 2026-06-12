// Coverage of the aggregate-as-array optional/gate modifiers that the
// existing `select.aggregate-as-array.*` files don't reach:
//   - `useEmptyArrayForNoValue()` (the explicit default → required array)
//   - `asOptionalNonEmptyArray()` (no value → undefined, optional array)
//   - `onlyWhenOrNull(true)` / `ignoreWhenAsNull(false)` (the pass-through
//     branches that return the same regular value source)
//   - `disallowWhen(true|false, …)` (the disallow gate, distinct from the
//     already-covered `allowWhen`)
//   - `projectingOptionalValuesAsNullable()` (optional object props become
//     `T | null` instead of `T?`)
//   - the same modifiers on the NULL variant produced by
//     `onlyWhenOrNull(false)`
// These land on AggregateSelectValueSource / NullAggregateSelectValueSource
// in src/internal/ValueSourceImpl.ts.
//
// `json_arrayagg` has no ORDER BY here, so the real engine's array order is
// not deterministic; the value assertion sorts the inner array before
// comparing so it holds in both mock and real-DB modes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-as-array-use-empty-array-for-no-value-explicit', async () => {
        ctx.mockNext([{ pid: 1, titles: ['Update hero copy', 'Redesign navbar'] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title).useEmptyArrayForNoValue(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(issue.title) as titles from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; titles: string[] }>>>()
        // json_arrayagg order is not guaranteed; sort before comparing.
        rows[0]!.titles.sort()
        expect(rows).toEqual([{ pid: 1, titles: ['Redesign navbar', 'Update hero copy'] }])
    })

    test('aggregate-as-array-as-optional-non-empty-array', async () => {
        ctx.mockNext([{ pid: 1, titles: ['Update hero copy', 'Redesign navbar'] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title).asOptionalNonEmptyArray(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(issue.title) as titles from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; titles?: string[] }>>>()
        // json_arrayagg order is not guaranteed; sort before comparing.
        // Project 1 has two issues ('Update hero copy', 'Redesign navbar').
        rows[0]!.titles!.sort()
        expect(rows).toEqual([{ pid: 1, titles: ['Redesign navbar', 'Update hero copy'] }])
    })

    test('aggregate-as-array-only-when-or-null-true-is-passthrough', async () => {
        // `onlyWhenOrNull(true)` returns the same regular value source —
        // no Null variant, so the array stays required.
        ctx.mockNext([{ pid: 1, titles: ['Update hero copy', 'Redesign navbar'] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title).onlyWhenOrNull(true),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(issue.title) as titles from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; titles?: string[] }>>>()
        // json_arrayagg order is not guaranteed; sort before comparing.
        // Project 1 has two issues ('Update hero copy', 'Redesign navbar').
        rows[0]!.titles!.sort()
        expect(rows).toEqual([{ pid: 1, titles: ['Redesign navbar', 'Update hero copy'] }])
    })

    test('aggregate-as-array-ignore-when-as-null-false-is-passthrough', async () => {
        // `ignoreWhenAsNull(false)` returns the same regular value source.
        ctx.mockNext([{ pid: 1, titles: ['Update hero copy', 'Redesign navbar'] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title).ignoreWhenAsNull(false),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(issue.title) as titles from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; titles?: string[] }>>>()
        // json_arrayagg order is not guaranteed; sort before comparing.
        // Project 1 has two issues ('Update hero copy', 'Redesign navbar').
        rows[0]!.titles!.sort()
        expect(rows).toEqual([{ pid: 1, titles: ['Redesign navbar', 'Update hero copy'] }])
    })

    test('aggregate-as-array-disallow-when-true-throws-on-build', async () => {
        // `disallowWhen(true, …)` blocks the value source — the gate throws
        // on build (equivalent to `allowWhen(false, …)`).
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const query = ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title)
                    .disallowWhen(true, 'aggregate-disallow-when-blocks'),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(false)
        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('aggregate-disallow-when-blocks')
    })

    test('aggregate-as-array-disallow-when-false-emits-transparently', async () => {
        // `disallowWhen(false, …)` leaves the value source allowed.
        ctx.mockNext([{ pid: 1, titles: ['Update hero copy'] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const query = ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title)
                    .disallowWhen(false, 'aggregate-disallow-when-open'),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(true)
        const rows = await query.executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(issue.title) as titles from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; titles: string[] }>>>()
        if (!ctx.realDbEnabled) {
            expect(rows).toEqual([{ pid: 1, titles: ['Update hero copy'] }])
        }
    })

    test('aggregate-as-array-projecting-optional-values-as-nullable', async () => {
        // The object aggregate has an optional `body` column. By default it
        // projects as `body?: string`; `projectingOptionalValuesAsNullable()`
        // turns it into an always-present `body: string | null`.
        ctx.mockNext([{ pid: 1, issues: [{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    id:   tIssueLeft.id,
                    body: tIssueLeft.body,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(json_object('id', issue.id, 'body', issue.body)) as issues from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; body: string | null }>
        }>>>()
        // json_arrayagg order is not guaranteed; sort by id before comparing.
        rows[0]!.issues.sort((a, b) => a.id - b.id)
        expect(rows).toEqual([{ pid: 1, issues: [{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }] }])
    })

    test('null-aggregate-as-array-then-use-empty-array-for-no-value', async () => {
        // `onlyWhenOrNull(false)` swaps in the NULL variant; chaining
        // `useEmptyArrayForNoValue()` exercises that modifier on the Null
        // class. The column is dropped from the projection and the result
        // is the literal empty array.
        ctx.mockNext([{ pid: 1, titles: [] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title)
                    .onlyWhenOrNull(false)
                    .useEmptyArrayForNoValue(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, null as titles from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; titles: string[] }>>>()
        expect(rows).toEqual([{ pid: 1, titles: [] }])
    })
    test('aggregate-as-array-as-required-in-optional-object', async () => {
        // `asRequiredInOptionalObject()` on an aggregate (ValueSourceImpl.ts:2515
        // — AggregateValueAsArrayValueSource.asRequiredInOptionalObject) makes
        // it the gate of an optional inner object: when the aggregate yields
        // no value (empty group → json_agg returns NULL), the whole inner
        // object is dropped. Project 3 (org 2) has one issue, project 4
        // has none; only project 3's `meta` survives.
        ctx.mockNext([
            { pid: 3, 'meta.titles': ['Document /v2/users'] },
            { pid: 4, 'meta.titles': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                pid: tProject.id,
                meta: {
                    titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title).asRequiredInOptionalObject(),
                },
            })
            .groupBy('pid')
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_arrayagg(issue.title) as \`meta.titles\` from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.id order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:   number
            meta?: { titles: string[] }
        }>>>()
        expect(rows).toEqual([
            { pid: 3, meta: { titles: ['Document /v2/users'] } },
            { pid: 4 },
        ])
    })

    test('null-aggregate-as-array-as-required-in-optional-object', async () => {
        // The Null variant — `onlyWhenOrNull(false)` chained with
        // `asRequiredInOptionalObject()` exercises ValueSourceImpl.ts:2631
        // (NullAggregateValueAsArrayValueSource.asRequiredInOptionalObject).
        // The column emits literal `null` regardless of the join, so the
        // gate is always null and `meta` is always absent.
        ctx.mockNext([
            { pid: 3, 'meta.titles': null },
            { pid: 4, 'meta.titles': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                pid: tProject.id,
                meta: {
                    titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.title)
                        .onlyWhenOrNull(false)
                        .asRequiredInOptionalObject(),
                },
            })
            .groupBy('pid')
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, null as \`meta.titles\` from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.id order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:   number
            meta?: { titles: string[] }
        }>>>()
        expect(rows).toEqual([{ pid: 3 }, { pid: 4 }])
    })

})
