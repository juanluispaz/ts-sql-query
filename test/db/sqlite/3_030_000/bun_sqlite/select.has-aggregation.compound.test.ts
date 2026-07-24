// Aggregation introspection over a built COMPOUND select (`union` /
// `unionAll` / …): `queryHasAggregation(query)` answers "does this query
// contain an aggregate anywhere?" without rendering SQL, by walking the same
// clauses the SQL builder renders.
//
// A compound is not a select with an extra clause — it is a node with two
// member queries under it, so the walker has its own traversal. It opens, in
// order: the FIRST member query, then the SECOND member query (joined by a
// short-circuiting `||`), then the compound's own `order by` terms that are
// value sources (plain string order-by names are output aliases and carry no
// expression to inspect), then the compound's `limit` / `offset`, then the
// compound's `customizeQuery` fragment slots. A single aggregate anywhere
// short-circuits to `true`.
//
// This file covers the two member-query positions and all four customization
// fragment slots a compound types.
//
// The compound's own `order by` is deliberately NOT covered. A bare aggregate
// is not assignable there — a compound types its value-source `orderBy(...)`
// as accepting only expressions that require no table or view, and an
// aggregate carries the aggregate marker in its source — but a self-contained
// aggregating subquery turned into a value with `forUseAsInlineQueryValue()`
// does have that source and would compile. It is left out because it emits
// `order by (<scalar subquery>)`, ordering by a one-row constant, which Oracle
// rejects outright. `limit` / `offset` on a compound take a plain `number`,
// so they are genuinely unreachable for an aggregate.
//
// Falsifiability is the organising principle of this file: every `true` is
// paired with a structurally similar `false`, so a walker that stopped
// inspecting one position would flip exactly one pair and fail. Concretely:
//
//   - the first test unions two plain member queries under a compound-level
//     `orderBy('<alias>')`, so it is the control — a walker that reported
//     `true` for any compound, or that mistook a member query's plain
//     projection for an aggregate, fails here and nowhere else;
//   - the two member-arm tests share one query shape and one aggregate, moved
//     from the first arm to the second, so a walker that only ever opened the
//     first arm passes one and fails the other;
//   - the customization tests share one compound and one set of four hooks,
//     and move a single aggregating expression from slot to slot: the negative
//     half holds a plain column in `afterQuery`, and one positive test per slot
//     puts the aggregate in `beforeWithQuery`, `beforeQuery`, `afterQuery` and
//     `afterWithQuery` in turn, so dropping any one slot from the walker flips
//     exactly one test.
//
// A compound types only FOUR customization hooks — `beforeWithQuery`,
// `beforeQuery`, `afterQuery`, `afterWithQuery`; the five projection- and
// ordering-level hooks a plain select accepts cannot be set on a compound at
// all, so they are not tested here.
//
// Every query here is ordinary SQL: an aggregate appears only in the
// projection of a grouped member query, or inside a scalar subquery embedded
// in a SQL comment — never bare in a position no engine accepts. Because a
// compound's rows come from two member queries, every test gives the compound
// its own `orderBy(...)` so the result array is stable on every engine.
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

    test('has-aggregation/compound-with-no-aggregate-in-either-arm-reports-false', async () => {
        // The control for the whole file: every project that either belongs to
        // organization 1 or is referenced by an issue. Both member queries are
        // plain, and the compound orders by the output alias — the string form,
        // which carries no expression for the walker to inspect. Organization 1
        // owns projects 1 and 2; the four issues point at projects 1, 1, 2 and
        // 3, so the union collapses to projects 1, 2 and 3.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({ projectId: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ projectId: tIssue.projectId }),
            )
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as projectId from project where organization_id = ? union select project_id as projectId from issue order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/compound-with-aggregate-in-the-first-arm-reports-aggregation', async () => {
        // The backlog size of every project that has issues, plus the archived
        // project: the FIRST member query counts the issues of each project
        // (its projection is the only aggregate in the whole compound), the
        // SECOND is plain and contributes the archived project, which has no
        // issues in the seed. Nothing outside the first arm aggregates, so the
        // `true` can only come from the walker opening the first member query.
        //
        // Per-project issue counts are project 1 → 2 (issues 1 and 2), project
        // 2 → 1 (issue 3) and project 3 → 1 (issue 4). Project 4 ('Legacy app')
        // is the only project with an `archived_at`, and it has no issues in
        // the seed, so the second arm contributes exactly one zero row.
        const expected = [
            { projectId: 1, issueCount: 2 },
            { projectId: 2, issueCount: 1 },
            { projectId: 3, issueCount: 1 },
            { projectId: 4, issueCount: 0 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId:  tIssue.projectId,
                issueCount: connection.count(tIssue.id),
            })
            .groupBy('projectId')
            .union(
                connection.selectFrom(tProject)
                    .where(tProject.archivedAt.isNotNull())
                    .select({
                        projectId:  tProject.id,
                        issueCount: connection.const(0, 'int'),
                    }),
            )
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) as issueCount from issue group by project_id union select id as projectId, ? as issueCount from project where archived_at is not null order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; issueCount: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/compound-with-aggregate-only-in-the-second-arm-reports-aggregation', async () => {
        // The mirror of the test above, and the important one: the two member
        // queries are swapped, so the FIRST arm is entirely plain and the only
        // aggregate of the compound sits in the SECOND. The walker joins the
        // two arms with a short-circuiting `||`; an implementation that only
        // ever inspected the first arm would still pass the previous test and
        // fail here alone.
        //
        // The compound describes the same backlog sizes and returns the same
        // rows: project 1 → 2 issues, project 2 → 1, project 3 → 1, and the
        // archived project 4 → 0.
        const expected = [
            { projectId: 1, issueCount: 2 },
            { projectId: 2, issueCount: 1 },
            { projectId: 3, issueCount: 1 },
            { projectId: 4, issueCount: 0 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .where(tProject.archivedAt.isNotNull())
            .select({
                projectId:  tProject.id,
                issueCount: connection.const(0, 'int'),
            })
            .union(
                connection.selectFrom(tIssue)
                    .select({
                        projectId:  tIssue.projectId,
                        issueCount: connection.count(tIssue.id),
                    })
                    .groupBy('projectId'),
            )
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as projectId, ? as issueCount from project where archived_at is not null union select project_id as projectId, count(id) as issueCount from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; issueCount: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/compound-customization-without-aggregate-reports-false', async () => {
        // The negative half of the customization pair: the control compound
        // carries all four hooks a compound types, and the one that holds an
        // expression — `afterQuery` — holds a plain column. The walker has to
        // open every fragment slot and come back empty, so a walker that
        // treated any value source inside a customization fragment as evidence
        // of an aggregate would report `true` here.
        //
        // At a compound root the with-hooks have no attachment point and render
        // nothing, so only `beforeQuery` and `afterQuery` appear in the emitted
        // SQL; the annotation rides inside a comment, which every engine
        // ignores. The rows are the control's: projects 1, 2 and 3.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({ projectId: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ projectId: tIssue.projectId }),
            )
            .orderBy('projectId')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail keyed-by=${tProject.slug} */`,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select id as projectId from project where organization_id = ? union select project_id as projectId from issue order by projectId  /* tail keyed-by=project.slug */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/compound-customization-with-an-aggregate-in-a-fragment-reports-aggregation', async () => {
        // The positive half of the customization pair: the same compound, the
        // same four hooks and the same `afterQuery` slot, but the expression
        // interpolated there is a scalar subquery that counts the issues. Both
        // member queries stay plain and the compound's own order-by is the
        // string form, so the `true` can only come from the walker opening the
        // customization fragments and descending through the subquery into its
        // projection.
        //
        // The annotation is a SQL comment, so the subquery is syntactically
        // inert on every engine and contributes no parameter — the compound
        // still returns projects 1, 2 and 3.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({ projectId: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ projectId: tIssue.projectId }),
            )
            .orderBy('projectId')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail issues=${issueCount} */`,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select id as projectId from project where organization_id = ? union select project_id as projectId from issue order by projectId  /* tail issues=(select count(id) as result from issue) */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/compound-customization-with-an-aggregate-in-the-before-query-fragment-reports-aggregation', async () => {
        // The same aggregate, moved to the `beforeQuery` slot. The walker
        // inspects the four slots in a fixed order and stops at the first one
        // that aggregates, so each slot needs its own test: dropping
        // `beforeQuery` from the walker flips this test and leaves the
        // `afterQuery` twin green. Like its twin, the annotation rides inside a
        // comment, so the compound still returns projects 1, 2 and 3.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({ projectId: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ projectId: tIssue.projectId }),
            )
            .orderBy('projectId')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                beforeQuery:     connection.rawFragment`/* head issues=${issueCount} */ `,
                afterQuery:      connection.rawFragment` /* tail */`,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head issues=(select count(id) as result from issue) */  select id as projectId from project where organization_id = ? union select project_id as projectId from issue order by projectId  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/compound-customization-with-an-aggregate-in-the-before-with-query-fragment-reports-aggregation', async () => {
        // The aggregate now sits in `beforeWithQuery`, the first slot the
        // walker inspects — and the strongest test of the four, because at a
        // compound root the with-hooks have no attachment point and render
        // nothing at all. The emitted SQL is therefore identical to the
        // control's, and the introspection verdict is the ONLY observable that
        // distinguishes them: the walker is deliberately stricter than the
        // renderer. The compound still returns projects 1, 2 and 3.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({ projectId: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ projectId: tIssue.projectId }),
            )
            .orderBy('projectId')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head issues=${issueCount} */ `,
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail */`,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select id as projectId from project where organization_id = ? union select project_id as projectId from issue order by projectId  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/compound-customization-with-an-aggregate-in-the-after-with-query-fragment-reports-aggregation', async () => {
        // The last of the four slots, and the one the walker reaches only after
        // every other has come back empty — so this test also pins that the
        // three preceding checks do not abandon the traversal. Like
        // `beforeWithQuery`, it renders nothing at a compound root, leaving the
        // verdict as the sole observable. Projects 1, 2 and 3 again.
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({ projectId: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ projectId: tIssue.projectId }),
            )
            .orderBy('projectId')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail */`,
                afterWithQuery:  connection.rawFragment` /* with-tail issues=${issueCount} */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select id as projectId from project where organization_id = ? union select project_id as projectId from issue order by projectId  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })
})
