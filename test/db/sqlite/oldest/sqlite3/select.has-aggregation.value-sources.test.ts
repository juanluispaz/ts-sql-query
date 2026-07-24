// Aggregation introspection through the OPERANDS of a composed value source:
// `queryHasAggregation(query)` answers "does this query contain an aggregate
// anywhere?" without rendering SQL, by walking the same clauses the SQL builder
// renders.
//
// A projected column is rarely a bare column or a bare aggregate. It is usually
// an operation applied to one — `a.valueWhenNull(b)`, `a.in([b, c])`,
// `a.between(b, c)`, a `${…}`-interpolated fragment. Each of those builds a
// node with a RECEIVER (the value the method was called on) and one or more
// OPERANDS, and the aggregation question has to be re-asked of every one of
// them: an aggregate hiding in the second bound of a `between`, or in the
// replacement of a `valueWhenNull`, still makes the query an aggregating query.
//
// This file covers the composed-value-source shapes the public API can build:
//
//   - `valueWhenNoValue(...)` — the fallback expression of an `*IfValue`
//     condition;
//   - `in(...)` / `inN(...)` — a list of values, a single value source, or a
//     whole subquery;
//   - `valueWhenNull(...)` — the replacement expression;
//   - `is(...)` — the null-safe equality, whose operand may be a value source;
//   - `equalsIfValue(...)`-family one-argument comparisons and `inIfValue(...)`
//     — the two shapes that become a NOOP when the supplied value is not a
//     value;
//   - `concatIfValue(...)` and `replaceAllIfValue(...)` — the two shapes that
//     IGNORE a missing value and fall back to the receiver alone;
//   - `between(a, b)` and `replaceAllIfValue(f, r)` — three operands at once;
//   - `fragmentWithType(...)` / `aggregateFragmentWithType(...)` — a fragment
//     that either IS an aggregate or merely interpolates one.
//
// The clause-level positions (join `on`, `where`, `having`, `group by`, `order
// by`, the projection, the `customizeQuery` fragment slots) and the compound
// (`union` / `intersect` / …) form of the walker are NOT covered here.
//
// Falsifiability is the organising principle: every composed shape gets one
// test per operand it can carry, each with the aggregate in that operand ALONE
// and everything else plain, plus a structurally identical negative. An
// implementation that inspected the receiver and stopped would pass the
// receiver tests and fail every operand test; one that reported `true` for any
// composed node would fail every negative.
//
// Two shapes deserve their own note:
//
//   - **The NOOP short-circuit.** `greaterThanIfValue(...)` / `inIfValue(...)`
//     produce a condition only when the supplied value IS a value; `null`,
//     `undefined`, an empty array (and, unless the connection opts in, the
//     empty string) are all "no value" and turn the whole comparison into a
//     no-op that renders nothing. A no-op contributes no SQL, so it contributes
//     no aggregate either — the verdict is `false` EVEN WHEN THE RECEIVER IS AN
//     AGGREGATE. That is the counter-intuitive, falsifiable half: an
//     implementation that asked the receiver first would report `true`.
//     `concatIfValue(...)` / `replaceAllIfValue(...)` behave the other way
//     round — a missing value makes them fall back to the receiver, which still
//     renders, so an aggregating receiver still reports `true`. Both
//     behaviours get a missing-value test with an aggregating receiver, so the
//     opposite verdicts sit side by side: `false` for the two comparisons,
//     `true` for the two string rewrites.
//   - **List vs single value.** `in([a, b])` takes a LIST and `in(<subquery>)`
//     a single operand; they are two different traversals, so both get their
//     own positive and their own negative. The list form only accepts plain
//     values, so the variadic `inN(a, b)` — which does accept value sources —
//     is what puts an aggregate INSIDE the list.
//
// How far each "if value" shape can be pinned depends on what its value
// argument accepts. `equalsIfValue(...)` / `greaterThanIfValue(...)` /
// `inIfValue(...)` / `concatIfValue(...)` type it as a plain JS value (a
// scalar, an array of scalars, or `null` / `undefined`) and never as a value
// source, so their value operand cannot carry an aggregate at all and they are
// pinned on the receiver side only. `replaceAllIfValue(...)` is the exception:
// it overloads BOTH the searched text and the replacement text to accept a
// string value source (one at a time, never both in the same call), so it is
// the one "if value" shape with reachable operands — and it is pinned on all
// three sides, receiver included, exactly like `between(a, b)`.
//
// Every query here is ordinary SQL: an aggregate appears only in the projection
// or the `having` of a grouped query, or inside a scalar subquery — never bare
// in `where` or in `group by`, where no engine accepts one. The seed holds four
// issues: 1 and 2 in project 1 (assignees 1 and 2), 3 in project 2 (no
// assignee) and 4 in project 3 (assignee 3), so grouping the issues by project
// gives per-project counts of 2, 1 and 1.
//
// `queryHasAggregation` is the sanctioned introspection seam for the walker,
// which has no public API yet; see test/LIMITATIONS.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { queryHasAggregation } from '../../../../lib/queryIntrospection.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('has-aggregation/value-when-no-value-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `valueWhenNoValue(...)` turns an `*IfValue` condition into a plain
        // boolean by supplying the expression to use when the condition was
        // skipped. Here the condition itself aggregates — `count(id) > 1` — and
        // the fallback is a plain column comparison, so the `true` can only come
        // from the condition side of the pair. The comparison value `1` IS a
        // value, so the condition renders and the fallback never reaches the
        // SQL. Per-project issue counts are 2, 1 and 1, so only project 1 is
        // busy.
        const expected = [
            { projectId: 1, busy: true },
            { projectId: 2, busy: false },
            { projectId: 3, busy: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                busy:      connection.count(tIssue.id).greaterThanIfValue(1)
                    .valueWhenNoValue(tIssue.projectId.greaterThan(0)),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) > ? as busy from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; busy: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/value-when-no-value-with-an-aggregating-fallback-reports-aggregation', async () => {
        // The mirror of the test above: the condition is a plain column
        // comparison and the aggregate sits in the FALLBACK. The comparison
        // value is `null`, which is not a value, so the condition is skipped and
        // the fallback is what actually reaches the SQL — the projected column
        // renders as `count(id) > 1`, giving this test a render-side observable
        // on top of the verdict. Per-project issue counts are 2, 1 and 1, so
        // only project 1 is busy.
        const expected = [
            { projectId: 1, busy: true },
            { projectId: 2, busy: false },
            { projectId: 3, busy: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                busy:      tIssue.projectId.greaterThanIfValue(null)
                    .valueWhenNoValue(connection.count(tIssue.id).greaterThan(1)),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) > ? as busy from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; busy: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/value-when-no-value-with-neither-operand-aggregating-reports-false', async () => {
        // The negative twin of the two tests above: the same shape, with a
        // condition whose value IS a value — so the condition renders and the
        // fallback is dead code — and a fallback that is a plain column
        // comparison rather than an aggregate. An implementation that treated
        // the mere presence of a fallback as evidence of aggregation, or that
        // failed to look inside it at all, would flip exactly this test or its
        // aggregating twin. All three project ids are greater than zero, so
        // every group survives.
        const expected = [
            { projectId: 1, busy: true },
            { projectId: 2, busy: true },
            { projectId: 3, busy: true },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                busy:      tIssue.projectId.greaterThanIfValue(0)
                    .valueWhenNoValue(tIssue.projectId.lessThan(3)),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id > ? as busy from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; busy: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/in-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `in([...])` over an aggregating receiver: the membership test is
        // applied to `count(id)` and the list holds plain numbers, so the `true`
        // can only come from the receiver side. Per-project issue counts are 2,
        // 1 and 1, and the list is `[2, 5]`, so only project 1 matches.
        const expected = [
            { projectId: 1, busy: true },
            { projectId: 2, busy: false },
            { projectId: 3, busy: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                busy:      connection.count(tIssue.id).in([2, 5]),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) in (?, ?) as busy from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; busy: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/in-n-with-an-aggregating-list-element-reports-aggregation', async () => {
        // The mirror: the receiver is the plain grouping column and the
        // aggregate is one ELEMENT of the membership list. `in([...])` accepts
        // plain values only, so the variadic `inN(...)` — which does accept
        // value sources — is the way to put an expression in the list, and the
        // aggregate is the second of the two entries so a walk that only looked
        // at the first would miss it. Per group the list is `(1, <issue count>)`
        // with counts 2, 1 and 1: project 1 matches on the literal, projects 2
        // and 3 match neither entry.
        const expected = [
            { projectId: 1, busy: true },
            { projectId: 2, busy: false },
            { projectId: 3, busy: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                busy:      tIssue.projectId.inN(1, connection.count(tIssue.id)),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id in (?, count(id)) as busy from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; busy: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/in-n-with-neither-operand-aggregating-reports-false', async () => {
        // The negative twin of the list form: the second list entry is again an
        // expression rather than a bare literal — a typed constant — but it does
        // not aggregate, so an implementation that treated any value source
        // inside the list as an aggregate would report `true` here while its
        // twin still passed. The list is `(1, 2)`, so projects 1 and 2 match and
        // project 3 does not.
        const expected = [
            { projectId: 1, busy: true },
            { projectId: 2, busy: true },
            { projectId: 3, busy: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                busy:      tIssue.projectId.inN(1, connection.const(2, 'int')),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id in (?, ?) as busy from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; busy: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/in-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The OTHER `in(...)` shape: a single operand instead of a list — here a
        // whole subquery, which is a different traversal from the list walk
        // above. The outer query aggregates nowhere, so the `true` can only come
        // from descending into the subquery's projection. The lowest project id
        // is 1, whose issues are 1 and 2.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.in(
                connection.selectFrom(tProject)
                    .selectOneColumn(connection.min(tProject.id)),
            ))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where project_id in (select min(id) as result from project) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/in-with-a-non-aggregating-subquery-reports-false', async () => {
        // The negative twin of the single-operand form: the same outer query and
        // the same subquery position, with the subquery projecting a plain
        // column instead of an aggregate. An implementation that reported `true`
        // for any `in(<subquery>)` would fail here. Slug 'mktg-site' identifies
        // project 1, so the subquery still evaluates to 1 and the outer query
        // still returns project 1's issues.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.in(
                connection.selectFrom(tProject)
                    .where(tProject.slug.equals('mktg-site'))
                    .selectOneColumn(tProject.id),
            ))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where project_id in (select id as result from project where slug = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "mktg-site",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/value-when-null-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `valueWhenNull(...)` replaces a NULL result with a fallback. Here the
        // receiver aggregates — `max(assignee_id)` over each project's issues —
        // and the replacement is a plain literal, so the `true` can only come
        // from the receiver. Project 1's issues carry assignees 1 and 2 (max 2),
        // project 2's single issue has no assignee at all (max NULL, replaced by
        // 0) and project 3's issue carries assignee 3.
        const expected = [
            { projectId: 1, lead: 2 },
            { projectId: 2, lead: 0 },
            { projectId: 3, lead: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                lead:      connection.max(tIssue.assigneeId).valueWhenNull(0),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, ifnull(max(assignee_id), ?) as lead from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; lead: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/value-when-null-with-an-aggregating-replacement-reports-aggregation', async () => {
        // The mirror: the receiver is a plain nullable column and the aggregate
        // sits in the REPLACEMENT, reached through a scalar subquery — the one
        // legal way to put an aggregate in a `where`, since a bare aggregate
        // there is rejected by every engine. The seed has four projects, so the
        // subquery evaluates to 4; issue 3 is the only issue without an
        // assignee, so it is the only row whose replacement is used and the only
        // row that matches.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const projectCount = connection.selectFrom(tProject)
            .selectOneColumn(connection.count(tProject.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.valueWhenNull(projectCount).equals(4))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where ifnull(assignee_id, (select count(id) as result from project)) = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/value-when-null-with-neither-operand-aggregating-reports-false', async () => {
        // The negative twin: same receiver, same replacement POSITION, and the
        // replacement subquery projects a plain column. An implementation that
        // stopped at "the replacement is a subquery" would report `true` here
        // while its twin still passed. Slug 'legacy' identifies project 4, so
        // the replacement is 4 again and issue 3 — the only issue without an
        // assignee — is still the only match.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const legacyProjectId = connection.selectFrom(tProject)
            .where(tProject.slug.equals('legacy'))
            .selectOneColumn(tProject.id)
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.valueWhenNull(legacyProjectId).equals(4))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where ifnull(assignee_id, (select id as result from project where slug = ?)) = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "legacy",
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/is-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `is(...)` is the null-safe equality: unlike `equals(...)` it treats
        // two NULLs as equal and never yields NULL itself. Here the receiver
        // aggregates and the operand is a plain literal, so the `true` can only
        // come from the receiver. Per-project max assignee ids are 2, NULL and
        // 3, so comparing against 3 matches project 3 alone — and project 2's
        // NULL answers `false` rather than NULL, which is what makes this
        // operator worth its own test.
        const expected = [
            { projectId: 1, matches: false },
            { projectId: 2, matches: false },
            { projectId: 3, matches: true },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                matches:   connection.max(tIssue.assigneeId).is(3),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, max(assignee_id) is ? as matches from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; matches: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/is-with-an-aggregating-operand-reports-aggregation', async () => {
        // The mirror: the receiver is the plain grouping column and the operand
        // is the aggregate. Per-project lowest issue ids are 1, 3 and 4 against
        // project ids 1, 2 and 3, so only project 1 has its id equal to its
        // lowest issue id.
        const expected = [
            { projectId: 1, matches: true },
            { projectId: 2, matches: false },
            { projectId: 3, matches: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                matches:   tIssue.projectId.is(connection.min(tIssue.id)),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id is min(id) as matches from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; matches: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/is-with-neither-operand-aggregating-reports-false', async () => {
        // The negative twin: the same null-safe equality with a plain grouping
        // column on the left and a plain literal on the right. An implementation
        // that treated the operator itself as evidence of aggregation would
        // report `true` here. Only project 1 has id 1.
        const expected = [
            { projectId: 1, matches: true },
            { projectId: 2, matches: false },
            { projectId: 3, matches: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                matches:   tIssue.projectId.is(1),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id is ? as matches from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; matches: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/greater-than-if-value-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `greaterThanIfValue(...)` builds the comparison only when the supplied
        // value IS a value. Here it is — `1` — so the comparison renders as an
        // ordinary `having` condition over an aggregating receiver, and the
        // projection is deliberately aggregate-free so the `true` can only come
        // from the `having`. Per-project issue counts are 2, 1 and 1, so
        // `> 1` keeps project 1 alone.
        const expected = [
            { projectId: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(connection.count(tIssue.id).greaterThanIfValue(1))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId from issue group by project_id having count(id) > ? order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/greater-than-if-value-with-a-missing-value-and-an-aggregating-receiver-reports-false', async () => {
        // The counter-intuitive half, and the reason this shape needs its own
        // test: the receiver is the SAME aggregate as in the test above, but the
        // comparison value is `null`, which is not a value — so the whole
        // comparison becomes a no-op, contributes no SQL, and therefore
        // contributes no aggregate either. The `having` disappears from the
        // emitted statement and the verdict is `false` DESPITE the aggregating
        // receiver. An implementation that asked the receiver before checking
        // whether the comparison survives at all would report `true` here and
        // pass everything else in this file. With no filter left, all three
        // groups come back.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(connection.count(tIssue.id).greaterThanIfValue(null))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/in-if-value-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `inIfValue([...])` is the membership form of the same "only when the
        // value is a value" rule. The list is non-empty, so the condition
        // renders over an aggregating receiver and the projection stays
        // aggregate-free. Per-project issue counts are 2, 1 and 1 and the list
        // is `[2, 5]`, so project 1 alone survives.
        const expected = [
            { projectId: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(connection.count(tIssue.id).inIfValue([2, 5]))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId from issue group by project_id having count(id) in (?, ?) order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/in-if-value-with-an-empty-array-and-an-aggregating-receiver-reports-false', async () => {
        // The list form's own no-op case: an EMPTY array is not a value, so the
        // membership test never renders and the aggregating receiver is never
        // reached — the verdict is `false`. This is a distinct rejection from
        // the `null` one pinned above: an empty list is a plausible thing for a
        // caller to pass and, unlike `in([])`, `inIfValue([])` drops the
        // condition entirely instead of emitting a constantly-false one. With no
        // filter left, all three groups come back.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(connection.count(tIssue.id).inIfValue([]))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/if-value-comparisons-with-neither-receiver-aggregating-report-false', async () => {
        // The shared negative for both "only when the value is a value" shapes:
        // the scalar comparison and the membership test are combined in one
        // `having`, both with values that ARE values so both render, and neither
        // receiver aggregates — the compared values are plain literals, which is
        // all these two methods accept, so the receivers are the only side that
        // could. An implementation that treated either shape as
        // aggregating on sight would report `true` here while every positive
        // above still passed. Grouping the four issues by project yields
        // projects 1, 2 and 3; `> 1` drops project 1 and the list `[1, 2, 3]`
        // drops nothing.
        const expected = [
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(tIssue.projectId.greaterThanIfValue(1))
              .and(tIssue.projectId.inIfValue([1, 2, 3]))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId from issue group by project_id having project_id > ? and project_id in (?, ?, ?) order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/concat-if-value-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `concatIfValue(...)` appends text only when the supplied text IS a
        // value — but, unlike the comparison shapes above, a missing value makes
        // it fall back to the RECEIVER instead of disappearing. Here the value
        // is present and the receiver aggregates. Grouping the four issues by
        // title puts each issue in its own group, so the group maximum is the
        // title itself; appending '!' and comparing keeps issue 2's group.
        const expected = [
            { title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ title: tIssue.title })
            .groupBy('title')
            .having(connection.max(tIssue.title).concatIfValue('!').equals('Redesign navbar!'))
            .orderBy('title')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue group by title having (max(title) || ?) = ? order by title"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            "Redesign navbar!",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/concat-if-value-with-a-missing-value-and-an-aggregating-receiver-reports-aggregation', async () => {
        // The deliberate contrast with the comparison shapes: the value is
        // `null` here too, but a missing value makes this operation fall back to
        // the receiver rather than vanish — the aggregate still renders, so the
        // verdict stays `true`. Pairing this against the
        // `greater-than-if-value` no-op test is the point: two "if value"
        // methods, two opposite verdicts, both correct. The emitted condition is
        // the bare group maximum, so issue 2's group is still the only match.
        const expected = [
            { title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ title: tIssue.title })
            .groupBy('title')
            .having(connection.max(tIssue.title).concatIfValue(null).equals('Redesign navbar'))
            .orderBy('title')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue group by title having (max(title)) = ? order by title"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Redesign navbar",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/concat-if-value-with-neither-operand-aggregating-reports-false', async () => {
        // The negative twin of the two above: the same `having` position and the
        // same appended text, with the plain grouping column as receiver instead
        // of the group maximum. An implementation that treated the concatenation
        // itself as aggregating would report `true` here. Each issue is its own
        // group, so appending '!' and comparing keeps issue 2's group again.
        const expected = [
            { title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ title: tIssue.title })
            .groupBy('title')
            .having(tIssue.title.concatIfValue('!').equals('Redesign navbar!'))
            .orderBy('title')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue group by title having (title || ?) = ? order by title"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            "Redesign navbar!",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/between-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `between(a, b)` is the first shape in this file with THREE operands —
        // the receiver and both bounds — so it takes three positives, one per
        // operand, sharing a single query shape. This one puts the aggregate in
        // the receiver and keeps both bounds literal. Per-project issue counts
        // are 2, 1 and 1, and the range is 2..5, so only project 1 is in range.
        const expected = [
            { projectId: 1, inRange: true },
            { projectId: 2, inRange: false },
            { projectId: 3, inRange: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                inRange:   connection.count(tIssue.id).between(2, 5),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) between ? and ? as inRange from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; inRange: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/between-with-an-aggregating-lower-bound-reports-aggregation', async () => {
        // The aggregate moves to the LOWER bound; the receiver is the plain
        // grouping column and the upper bound is a literal, so the `true` can
        // only come from the first bound. Per-project issue counts are 2, 1 and
        // 1, so the ranges are 2..5, 1..5 and 1..5 against project ids 1, 2 and
        // 3: project 1 falls below its own lower bound, the other two fit.
        const expected = [
            { projectId: 1, inRange: false },
            { projectId: 2, inRange: true },
            { projectId: 3, inRange: true },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                inRange:   tIssue.projectId.between(connection.count(tIssue.id), 5),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id between count(id) and ? as inRange from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; inRange: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/between-with-an-aggregating-upper-bound-reports-aggregation', async () => {
        // The aggregate moves to the UPPER bound — the last operand, and the one
        // an implementation that stopped after the receiver and the first bound
        // would miss while both siblings above still passed. The ranges are
        // 1..2, 1..1 and 1..1 against project ids 1, 2 and 3, so only project 1
        // fits.
        const expected = [
            { projectId: 1, inRange: true },
            { projectId: 2, inRange: false },
            { projectId: 3, inRange: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                inRange:   tIssue.projectId.between(1, connection.count(tIssue.id)),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id between ? and count(id) as inRange from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; inRange: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/between-with-no-operand-aggregating-reports-false', async () => {
        // The shared negative for the three-operand shape: same range test, all
        // three operands plain. An implementation that reported `true` for any
        // range test would fail here while the three positives still passed.
        // Project ids 1, 2 and 3 all fall in 1..5.
        const expected = [
            { projectId: 1, inRange: true },
            { projectId: 2, inRange: true },
            { projectId: 3, inRange: true },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                inRange:   tIssue.projectId.between(1, 5),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, project_id between ? and ? as inRange from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; inRange: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/replace-all-if-value-with-an-aggregating-receiver-reports-aggregation', async () => {
        // `replaceAllIfValue(find, replaceWith)` is the three-operand member of
        // the "if value" family: like the concatenation above, a missing value
        // makes it fall back to the receiver rather than vanish. Both values are
        // present here and the receiver aggregates. Grouping the four issues by
        // title puts each issue in its own group, so the group maximum is the
        // title itself; rewriting 'navbar' to 'header' keeps issue 2's group.
        const expected = [
            { title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ title: tIssue.title })
            .groupBy('title')
            .having(connection.max(tIssue.title).replaceAllIfValue('navbar', 'header').equals('Redesign header'))
            .orderBy('title')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue group by title having replace(max(title), ?, ?) = ? order by title"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "navbar",
            "header",
            "Redesign header",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/replace-all-if-value-with-an-aggregating-replacement-reports-aggregation', async () => {
        // The aggregate moves to the REPLACEMENT text — the second operand —
        // while the receiver and the searched text stay plain. Unlike the other
        // "if value" methods, whose value argument is always a plain JS value,
        // this one overloads both of its operands to accept a string value
        // source, so an aggregate genuinely reaches this position and an
        // implementation that only asked the receiver would report `false` here.
        //
        // Grouping the four issues by title puts each issue in its own group, so
        // the group maximum of any column is that issue's own value. Issue 2 is
        // titled 'Redesign navbar' and its status is 'in_progress', so rewriting
        // 'navbar' to the group's status yields 'Redesign in_progress'; no other
        // title contains 'navbar', so no other group is rewritten at all.
        const expected = [
            { title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ title: tIssue.title })
            .groupBy('title')
            .having(tIssue.title.replaceAllIfValue('navbar', connection.max(tIssue.status)).equals('Redesign in_progress'))
            .orderBy('title')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue group by title having replace(title, ?, max(status)) = ? order by title"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "navbar",
            "Redesign in_progress",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/replace-all-if-value-with-an-aggregating-searched-text-reports-aggregation', async () => {
        // The last of the three operands: the aggregate is now the SEARCHED
        // text, with a plain receiver and a plain replacement. An implementation
        // that inspected the receiver and the replacement but not the searched
        // text would pass both siblings above and fail here alone.
        //
        // This one groups the four projects by name — each name is unique, so
        // every group holds one row and the group maximum of the slug is that
        // project's own slug. Only one seeded project has a slug that occurs
        // inside its own name: project 2 is named 'Internal tools' with slug
        // 'tools', so it becomes 'Internal squad'. 'mktg-site' does not occur in
        // 'Marketing site' nor 'public-api' in 'Public API'; 'legacy' differs
        // from the 'Legacy' in 'Legacy app' by case, and whether an engine's
        // replace honours that case difference does not matter here — neither
        // 'Legacy app' nor 'squad app' equals the compared text.
        const expected = [
            { name: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .select({ name: tProject.name })
            .groupBy('name')
            .having(tProject.name.replaceAllIfValue(connection.max(tProject.slug), 'squad').equals('Internal squad'))
            .orderBy('name')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as name from project group by name having replace(name, max(slug), ?) = ? order by name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "squad",
            "Internal squad",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/replace-all-if-value-with-a-missing-value-and-an-aggregating-receiver-reports-aggregation', async () => {
        // The missing-value half, and the twin of the concatenation's: the
        // searched text is `null`, which is not a value, so the rewrite falls
        // back to the receiver instead of vanishing — the aggregate still
        // renders and the verdict stays `true`. Read against the
        // `greater-than-if-value` and `in-if-value` no-op tests, which report
        // `false` from the same starting point, this is what pins the two
        // behaviours apart. The emitted condition is the bare group maximum, and
        // each issue is its own group, so issue 2's group is the only match.
        const expected = [
            { title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ title: tIssue.title })
            .groupBy('title')
            .having(connection.max(tIssue.title).replaceAllIfValue(null, 'header').equals('Redesign navbar'))
            .orderBy('title')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue group by title having max(title) = ? order by title"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Redesign navbar",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/replace-all-if-value-with-neither-operand-aggregating-reports-false', async () => {
        // The negative twin: the same rewrite in the same `having` position with
        // the plain grouping column as receiver. An implementation that treated
        // the rewrite itself as aggregating would report `true` here. Each issue
        // is its own group, so issue 2's group is the only match again.
        const expected = [
            { title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ title: tIssue.title })
            .groupBy('title')
            .having(tIssue.title.replaceAllIfValue('navbar', 'header').equals('Redesign header'))
            .orderBy('title')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue group by title having replace(title, ?, ?) = ? order by title"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "navbar",
            "header",
            "Redesign header",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/aggregate-fragment-reports-aggregation', async () => {
        // `aggregateFragmentWithType(...)` is how a caller writes a custom
        // aggregate the fluent API does not model: the fragment DECLARES itself
        // an aggregate, and that declaration is what has to be honoured — its
        // interpolated parameter here is a plain column, so nothing else in the
        // query can supply the verdict. Grouping the four issues by project
        // gives project 1 two issues, project 2 one and project 3 one.
        const expected = [
            { projectId: 1, size: 2 },
            { projectId: 2, size: 1 },
            { projectId: 3, size: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                size:      connection.aggregateFragmentWithType('int', 'required').sql`count(${tIssue.id})`,
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) as size from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; size: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/plain-fragment-with-an-aggregating-param-reports-aggregation', async () => {
        // The mirror: a fragment built with the ordinary, non-aggregate builder,
        // so it declares nothing — but the expression interpolated INTO it is an
        // aggregate. The verdict has to come from walking the fragment's
        // parameters. The counts are the same per-project issue counts, wrapped
        // in a function that leaves them unchanged.
        const expected = [
            { projectId: 1, size: 2 },
            { projectId: 2, size: 1 },
            { projectId: 3, size: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                size:      connection.fragmentWithType('int', 'required').sql`abs(${connection.count(tIssue.id)})`,
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, abs(count(id)) as size from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; size: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/plain-fragment-with-plain-params-reports-false', async () => {
        // The negative twin of both fragment tests: same non-aggregate builder,
        // same wrapping function, and the interpolated expression is a plain
        // column. An implementation that treated any fragment as aggregating
        // would report `true` here while both positives still passed. The
        // grouping column is its own absolute value, so the projects come back
        // as 1, 2 and 3.
        const expected = [
            { projectId: 1, size: 1 },
            { projectId: 2, size: 2 },
            { projectId: 3, size: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                size:      connection.fragmentWithType('int', 'required').sql`abs(${tIssue.projectId})`,
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, abs(project_id) as size from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; size: number }>>>()
        expect(rows).toEqual(expected)
    })
})
