// Coverage of the aggregate-as-array optional/gate modifiers the other
// select.aggregate-as-array.* files don't reach: useEmptyArrayForNoValue,
// asOptionalNonEmptyArray, onlyWhenOrNull / ignoreWhenAsNull pass-through,
// disallowWhen, projectingOptionalValuesAsNullable, and the same modifiers
// on the NULL variant from onlyWhenOrNull(false).

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
        // `asRequiredInOptionalObject()` makes the aggregate the gate of an
        // optional inner object: when the group is empty (the array aggregate returns
        // NULL) the inner object is dropped. Project 3 (org 2) has one
        // issue, project 4 has none; only project 3's `meta` survives.
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
        // The Null variant: `onlyWhenOrNull(false)` emits literal `null`
        // regardless of the join, so the gate is always null and `meta` is
        // always absent.
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

    test('null-projector-aggregate-as-array-as-required-in-optional-object', async () => {
        // With `.projectingOptionalValuesAsNullable()`, the
        // `asRequiredInOptionalObject()`-gated `meta` object is PRESENT-as-`null`
        // on the empty group instead of absent (`{ titles } | null`). Project 3
        // has one issue (meta present), project 4 none (meta null).
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
            .projectingOptionalValuesAsNullable()
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
            pid:  number
            meta: { titles: string[] } | null
        }>>>()
        expect(rows).toEqual([
            { pid: 3, meta: { titles: ['Document /v2/users'] } },
            { pid: 4, meta: null },
        ])
    })
    test('aggregate-as-array-element-level-rule-1-required-in-optional-object', async () => {
        // A column marked `.asRequiredInOptionalObject()` (`ref`) is REQUIRED in
        // every array element, while a plain-optional sibling (`assigneeId`)
        // stays optional — `Array<{ ref: string; assigneeId?: number }>`.
        // Org 1 -> projects 1,2 -> issues 1 (assignee 1), 2 (assignee 2),
        // 3 (assignee NULL). The null assignee surfaces as an ABSENT key in the
        // default asUndefined element.
        ctx.mockNext([{ oid: 1, issues: [
            { ref: 'Update hero copy', assigneeId: 1 },
            { ref: 'Redesign navbar',  assigneeId: 2 },
            { ref: 'Migrate to ESM',   assigneeId: null },
        ] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(1))
            .select({
                oid:    tProject.organizationId,
                issues: ctx.conn.aggregateAsArray({
                    ref:        tIssueLeft.title.asRequiredInOptionalObject(),
                    assigneeId: tIssueLeft.assigneeId,
                }),
            })
            .groupBy('oid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as oid, json_arrayagg(json_object('ref', issue.title, 'assigneeId', issue.assignee_id)) as issues from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            oid:    number
            issues: Array<{ ref: string; assigneeId?: number }>
        }>>>()
        expect(rows.map(r => ({ oid: r.oid, issues: [...r.issues].sort((a, b) => a.ref.localeCompare(b.ref)) })))
            .toEqual([{ oid: 1, issues: [
                { ref: 'Migrate to ESM' },
                { ref: 'Redesign navbar',  assigneeId: 2 },
                { ref: 'Update hero copy', assigneeId: 1 },
            ] }])
    })

    test('aggregate-as-array-element-level-rule-1-under-projecting-optional-values-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()` the
        // `.asRequiredInOptionalObject()` `ref` stays required, but the optional
        // `assigneeId` is PRESENT-as-null instead of an absent key —
        // `Array<{ ref: string; assigneeId: number | null }>`. Org 1's issues
        // 1, 2, 3; issue 3's null assignee surfaces as `null`.
        ctx.mockNext([{ oid: 1, issues: [
            { ref: 'Update hero copy', assigneeId: 1 },
            { ref: 'Redesign navbar',  assigneeId: 2 },
            { ref: 'Migrate to ESM',   assigneeId: null },
        ] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(1))
            .select({
                oid:    tProject.organizationId,
                issues: ctx.conn.aggregateAsArray({
                    ref:        tIssueLeft.title.asRequiredInOptionalObject(),
                    assigneeId: tIssueLeft.assigneeId,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('oid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as oid, json_arrayagg(json_object('ref', issue.title, 'assigneeId', issue.assignee_id)) as issues from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            oid:    number
            issues: Array<{ ref: string; assigneeId: number | null }>
        }>>>()
        expect(rows.map(r => ({ oid: r.oid, issues: [...r.issues].sort((a, b) => a.ref.localeCompare(b.ref)) })))
            .toEqual([{ oid: 1, issues: [
                { ref: 'Migrate to ESM',   assigneeId: null },
                { ref: 'Redesign navbar',  assigneeId: 2 },
                { ref: 'Update hero copy', assigneeId: 1 },
            ] }])
    })

    test('aggregate-as-array-element-level-rule-4-all-optional-not-left-join', async () => {
        // Every array-element column is genuinely optional and NOT from a left
        // join, so each leaf is an optional key —
        // `Array<{ body?: string | undefined; assigneeId?: number | undefined }>`.
        // Project 1 -> issues 1 (body NULL, assignee 1) and 2 (body, assignee 2);
        // the null leaves surface as ABSENT keys.
        ctx.mockNext([{ pid: 1, opts: [
            { body: null,             assigneeId: 1 },
            { body: 'Use new tokens', assigneeId: 2 },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:  tIssue.projectId,
                opts: ctx.conn.aggregateAsArray({ body: tIssue.body, assigneeId: tIssue.assigneeId }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('body', body, 'assigneeId', assignee_id)) as opts from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:  number
            opts: Array<{ body?: string | undefined; assigneeId?: number | undefined }>
        }>>>()
        expect(rows.map(r => ({ pid: r.pid, opts: [...r.opts].sort((a, b) => (a.assigneeId ?? 0) - (b.assigneeId ?? 0)) })))
            .toEqual([{ pid: 1, opts: [{ assigneeId: 1 }, { body: 'Use new tokens', assigneeId: 2 }] }])
    })

    test('aggregate-as-array-element-level-rule-4-under-projecting-optional-values-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()` the all-optional,
        // non-left-join leaves are PRESENT-as-null instead of absent keys —
        // `Array<{ body: string | null; assigneeId: number | null }>`.
        // Project 1's issues 1, 2; issue 1's null body surfaces as `null`.
        ctx.mockNext([{ pid: 1, opts: [
            { body: null,             assigneeId: 1 },
            { body: 'Use new tokens', assigneeId: 2 },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:  tIssue.projectId,
                opts: ctx.conn.aggregateAsArray({ body: tIssue.body, assigneeId: tIssue.assigneeId })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('body', body, 'assigneeId', assignee_id)) as opts from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:  number
            opts: Array<{ body: string | null; assigneeId: number | null }>
        }>>>()
        expect(rows.map(r => ({ pid: r.pid, opts: [...r.opts].sort((a, b) => (a.assigneeId ?? 0) - (b.assigneeId ?? 0)) })))
            .toEqual([{ pid: 1, opts: [{ body: null, assigneeId: 1 }, { body: 'Use new tokens', assigneeId: 2 }] }])
    })

})
