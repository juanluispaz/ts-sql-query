// Aggregation introspection over the `customizeQuery({...})` fragment slots of
// a built PLAIN select: `queryHasAggregation(query)` answers "does this query
// contain an aggregate anywhere?" without rendering SQL, by walking the same
// clauses the SQL builder renders.
//
// `customizeQuery` is the one place a caller can smuggle a value source into a
// query through a FRAGMENT rather than a typed clause, so after the typed
// clauses the walker has to open every fragment slot and re-ask the question.
// A plain select types nine of them, inspected in this order and
// short-circuiting to `true` at the first that aggregates:
//
//   beforeWithQuery, beforeQuery, afterSelectKeyword, beforeColumns,
//   customWindow, beforeOrderByItems, afterOrderByItems, afterQuery,
//   afterWithQuery
//
// This file covers all nine. The typed clauses of a plain select — join `on`,
// `where`, `having`, `group by`, `order by`, the projection, `limit` /
// `offset` — and the compound (`union` / `intersect` / …) form of the walker
// are NOT covered here.
//
// Every test builds the SAME underlying query — the four seeded projects, two
// plain columns, ordered by id — and sets the SAME EIGHT companion hooks, each
// holding inert comment text or a plain column. Only the customization varies:
//
//   - the first test is the control. All eight companions are inert and no
//     typed clause aggregates, so the walker has to open every populated slot
//     and come back empty. A walker that reported `true` for any customised
//     query, or that mistook a plain column inside a fragment for an aggregate,
//     fails here and nowhere else;
//   - the nine positives each carry the SAME eight companions, with the slot
//     under test swapped for its aggregating variant — the same fragment, with
//     a scalar subquery added inside its comment. (The `customWindow` positive
//     is the exception in form only: since `customWindow` is not one of the
//     eight, it ADDS a ninth slot instead of replacing one.) That is what makes
//     the verdict attributable: every other slot is populated and answers "no
//     aggregate here", so a walker that stopped at the first slot that came
//     back negative would report `false`, and the `true` can only come from the
//     one slot that aggregates. Dropping that slot's check flips exactly one
//     test and leaves the rest green.
//     A walker that instead stopped at the first slot it found POPULATED is
//     caught by every positive except `before-with-query`, whose slot happens
//     to be the first the walker meets.
//
// `customWindow` is deliberately NOT one of the eight companions. It is the one
// slot that emits a keyword rather than a comment or an ordering term — a
// `window <name> as (...)` clause, which older engine versions do not accept —
// so it is confined to its own negative/positive pair (the second test and the
// `custom-window` positive) and every other test in the file stays free of the
// `window` keyword.
//
// The aggregate is always a scalar subquery turned into a value with
// `forUseAsInlineQueryValue()` — a bare `count(...)` is not assignable to a
// fragment's source type — and it is always interpolated INSIDE a SQL comment,
// so it is syntactically inert on every engine and contributes no bind
// parameter. The base query binds nothing either, so the params stay empty and
// a driver that strips comments cannot mis-count placeholders.
//
// `beforeWithQuery` and `afterWithQuery` render only when the select is
// materialised as a CTE; at a query root they have no attachment point and the
// renderer drops them. For those two slots the introspection verdict is
// therefore the sole observable, and their positives emit exactly the SQL the
// remaining companions alone would — the walker is deliberately stricter than
// the renderer. A render-side observable IS reachable: materialising the select
// with `forUseInQueryAs(...)` gives the two hooks a render site, and the
// aggregation walker then finds them on the select's own builder (not on the
// outer query — it does not descend into the tables and views a query selects
// from). That is the shape `select.allow-when.customize-query-hooks.test.ts`
// uses, and it is deliberately not taken here so that every test in this file
// stays the same single-statement shape and the eleven verdicts stay comparable
// side by side.
//
// Three slots cannot carry a bare comment, because the renderer splices them
// into a syntactic position that needs a real SQL term:
//
//   - `beforeOrderByItems` is spliced ahead of the explicit `order by` items
//     and comma-joined with them, so its fragment leads with the plain
//     `organization_id` column and carries its annotation as a trailing
//     comment. Organization 1 owns projects 1 and 2 and organization 2 owns
//     projects 3 and 4, so that leading key agrees with the seed's id order and
//     the rows are unchanged;
//   - `afterOrderByItems` is appended after them, likewise comma-joined, and
//     leads with the plain `name` column. `id` is already unique, so that
//     trailing key never reorders anything;
//   - `customWindow` supplies the body of the `window <name> as (...)` clause,
//     kept to a minimal `partition by`, with its annotation inside the
//     parentheses.
//
// No ordering column is ever repeated within one statement, so engines that
// reject a column named twice in the order-by list are satisfied.
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

    test('has-aggregation/customize-query-with-no-aggregate-in-any-hook-reports-false', async () => {
        // The control for the whole file: the eight companion slots every other
        // test also sets, all of them inert — six carry comment text, and the
        // two order-by slots carry a plain column. Nothing in the typed clauses
        // aggregates either, so the walker has to open all eight and come back
        // empty. A walker that treated any value source reachable through a
        // customization fragment as an aggregate would report `true` here.
        //
        // The seed holds four projects: 1 'Marketing site' and 2 'Internal
        // tools' under organization 1, 3 'Public API' and 4 'Legacy app' under
        // organization 2. Ordering by organization and then by id is the same
        // as ordering by id alone.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — the named WINDOW clause (customizeQuery.customWindow emits `window <name> as (…)`) requires SQL Server 2022+; 2019 rejects the `window` keyword (Incorrect syntax).
    // test('has-aggregation/customize-query-custom-window-hook-without-an-aggregate-reports-false', async () => {
    //     // The negative half of the `customWindow` pair, and the only other test
    //     // that mentions that slot: the control's eight companions plus an inert
    //     // `customWindow`, whose `partition by` is a plain column. The walker now
    //     // has all nine slots populated and none of them aggregates, so it has to
    //     // open the ninth too and still come back empty — a walker that took the
    //     // mere presence of a window definition, or of the column inside it, as
    //     // evidence of aggregation would report `true` here.
    //     //
    //     // The named window is never referenced by a projected column, so it does
    //     // not change the four seeded projects returned in id order.
    //     const expected = [
    //         { id: 1, name: 'Marketing site' },
    //         { id: 2, name: 'Internal tools' },
    //         { id: 3, name: 'Public API' },
    //         { id: 4, name: 'Legacy app' },
    //     ]
    //     ctx.mockNext(expected)
    //     const connection = ctx.conn
    //
    //     const query = connection.selectFrom(tProject)
    //         .select({
    //             id:   tProject.id,
    //             name: tProject.name,
    //         })
    //         .orderBy('id')
    //         .customizeQuery({
    //             beforeWithQuery:    connection.rawFragment`/* with-head */ `,
    //             beforeQuery:        connection.rawFragment`/* head */ `,
    //             afterSelectKeyword: connection.rawFragment`/* hint */`,
    //             beforeColumns:      connection.rawFragment`/* cols */ `,
    //             customWindow:       connection.rawFragment`w1 as (partition by ${tProject.organizationId})`,
    //             beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
    //             afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
    //             afterQuery:         connection.rawFragment` /* tail */`,
    //             afterWithQuery:     connection.rawFragment` /* with-tail */`,
    //         })
    //
    //     expect(queryHasAggregation(query)).toBe(false)
    //
    //     const rows = await query.executeSelectMany()
    //
    //     expect(ctx.lastSql).toMatchInlineSnapshot()
    //     expect(ctx.lastParams).toMatchInlineSnapshot()
    //     assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
    //     expect(rows).toEqual(expected)
    // })

    test('has-aggregation/customize-query-before-with-query-hook-with-an-aggregate-reports-aggregation', async () => {
        // `beforeWithQuery` is the FIRST slot the walker inspects, and the only
        // aggregating one here: the seven remaining companions are set and
        // inert, and no typed clause aggregates, so the `true` can only come
        // from this slot's check. Dropping it flips this test and leaves the
        // rest green.
        //
        // At a query root this hook has no attachment point and renders nothing,
        // so the introspection verdict is the only observable and the emitted
        // SQL is the control's. The four seeded projects, in id order.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head issues=${issueCount} */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/customize-query-before-query-hook-with-an-aggregate-reports-aggregation', async () => {
        // `beforeQuery` is spliced ahead of the whole statement, so the
        // annotation is the first thing the engine reads. It is the only
        // aggregating expression in the query — the seven remaining companions
        // are set and inert — so the `true` can only come from this slot's
        // check. Dropping it flips this test and leaves the rest green.
        //
        // The annotation rides inside a comment, so the statement still returns
        // the four seeded projects in id order.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head issues=${issueCount} */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head issues=(select count(id) as [result] from issue) */  select /* hint */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/customize-query-after-select-keyword-hook-with-an-aggregate-reports-aggregation', async () => {
        // `afterSelectKeyword` splices right after the `select` keyword — the
        // natural home for an optimiser hint or a tag-style annotation. It
        // carries the only aggregate of the query while the seven remaining
        // companions stay set and inert, so the `true` can only come from this
        // slot's check. Dropping it flips this test and leaves the rest green.
        //
        // The annotation is a comment, so the statement still returns the four
        // seeded projects in id order.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint issues=${issueCount} */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint issues=(select count(id) as [result] from issue) */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/customize-query-before-columns-hook-with-an-aggregate-reports-aggregation', async () => {
        // `beforeColumns` splices between the select keyword (and its
        // `afterSelectKeyword` slot) and the projection. It is the immediate
        // neighbour of `afterSelectKeyword`, which makes it the easiest slot to
        // conflate with it — and here that neighbour is set with an inert
        // fragment while `beforeColumns` carries the only aggregate, so the two
        // checks are told apart. Dropping the `beforeColumns` check flips this
        // test while its neighbour's stays green.
        //
        // The annotation is a comment, so the statement still returns the four
        // seeded projects in id order.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols issues=${issueCount} */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols issues=(select count(id) as [result] from issue) */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — the named WINDOW clause (customizeQuery.customWindow emits `window <name> as (…)`) requires SQL Server 2022+; 2019 rejects the `window` keyword (Incorrect syntax).
    // test('has-aggregation/customize-query-custom-window-hook-with-an-aggregate-reports-aggregation', async () => {
    //     // The positive half of the `customWindow` pair: the same nine slots as
    //     // its negative twin, with the aggregate added inside a comment in the
    //     // window definition. The `partition by` stays the plain column, so the
    //     // emitted clause is still a valid named window, and the eight companions
    //     // stay set and inert — the `true` can only come from this slot's check.
    //     // Dropping it flips this test and leaves its negative twin, and the rest
    //     // of the file, green.
    //     //
    //     // `customWindow` is the escape hatch for window functions, which the
    //     // fluent API does not model. The named window is never referenced by a
    //     // projected column and the annotation is a comment, so the statement
    //     // still returns the four seeded projects in id order.
    //     const expected = [
    //         { id: 1, name: 'Marketing site' },
    //         { id: 2, name: 'Internal tools' },
    //         { id: 3, name: 'Public API' },
    //         { id: 4, name: 'Legacy app' },
    //     ]
    //     ctx.mockNext(expected)
    //     const connection = ctx.conn
    //
    //     const issueCount = connection.selectFrom(tIssue)
    //         .selectOneColumn(connection.count(tIssue.id))
    //         .forUseAsInlineQueryValue()
    //
    //     const query = connection.selectFrom(tProject)
    //         .select({
    //             id:   tProject.id,
    //             name: tProject.name,
    //         })
    //         .orderBy('id')
    //         .customizeQuery({
    //             beforeWithQuery:    connection.rawFragment`/* with-head */ `,
    //             beforeQuery:        connection.rawFragment`/* head */ `,
    //             afterSelectKeyword: connection.rawFragment`/* hint */`,
    //             beforeColumns:      connection.rawFragment`/* cols */ `,
    //             customWindow:       connection.rawFragment`w1 as (partition by ${tProject.organizationId} /* issues=${issueCount} */)`,
    //             beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
    //             afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
    //             afterQuery:         connection.rawFragment` /* tail */`,
    //             afterWithQuery:     connection.rawFragment` /* with-tail */`,
    //         })
    //
    //     expect(queryHasAggregation(query)).toBe(true)
    //
    //     const rows = await query.executeSelectMany()
    //
    //     expect(ctx.lastSql).toMatchInlineSnapshot()
    //     expect(ctx.lastParams).toMatchInlineSnapshot()
    //     assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
    //     expect(rows).toEqual(expected)
    // })

    test('has-aggregation/customize-query-before-order-by-items-hook-with-an-aggregate-reports-aggregation', async () => {
        // `beforeOrderByItems` is spliced ahead of the explicit `order by` items
        // and comma-joined with them, so the fragment has to BE an ordering
        // term: it leads with the plain `organization_id` column and carries the
        // aggregate in a trailing comment. Ordering by organization first and by
        // id second is the seed's own id order (organization 1 owns projects 1
        // and 2, organization 2 owns projects 3 and 4), so the four rows come
        // back unchanged.
        //
        // The seven remaining companions are set and inert — including
        // `afterOrderByItems`, which holds the same shape on the other side of
        // the explicit items — so the `true` can only come from this slot's
        // check. Dropping it flips this test and leaves its twin green.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key issues=${issueCount} */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key issues=(select count(id) as [result] from issue) */, id, project.name /* tiebreak */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/customize-query-after-order-by-items-hook-with-an-aggregate-reports-aggregation', async () => {
        // `afterOrderByItems` is appended past the explicit `order by` items,
        // likewise comma-joined, so it too has to BE an ordering term: it leads
        // with the plain `name` column — a different column from every other
        // term in the list, which keeps engines that reject a repeated ordering
        // column happy — and carries the aggregate in a trailing comment. `id`
        // is already unique, so the trailing key never reorders the four rows.
        //
        // The seven remaining companions are set and inert — including
        // `beforeOrderByItems`, which sits on the other side of the explicit
        // items — so the `true` can only come from this slot's check. Dropping
        // it flips this test and leaves its twin green.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak issues=${issueCount} */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak issues=(select count(id) as [result] from issue) */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/customize-query-after-query-hook-with-an-aggregate-reports-aggregation', async () => {
        // `afterQuery` is appended past the ordering and any limit/offset — the
        // last statement slot, and the natural place for a trailing tag. It
        // holds the only aggregate of the query while the seven remaining
        // companions stay set and inert, so the `true` can only come from this
        // slot's check. Dropping it flips this test and leaves the rest green.
        //
        // The annotation is a comment, so the statement still returns the four
        // seeded projects in id order.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail issues=${issueCount} */`,
                afterWithQuery:     connection.rawFragment` /* with-tail */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak */  /* tail issues=(select count(id) as [result] from issue) */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/customize-query-after-with-query-hook-with-an-aggregate-reports-aggregation', async () => {
        // `afterWithQuery` is the LAST of the nine slots, and this is the test
        // that pins the traversal reaching it: the seven companions the walker
        // meets on the way are all SET and none of them aggregates, so a walker
        // that gave up at the first slot that came back negative would report
        // `false` here. Dropping this slot's check flips this test alone.
        //
        // Like `beforeWithQuery`, it renders only when the select is
        // materialised as a CTE; at a query root the renderer drops it, so the
        // introspection verdict is the sole observable. The four seeded projects
        // again.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const issueCount = connection.selectFrom(tIssue)
            .selectOneColumn(connection.count(tIssue.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery:    connection.rawFragment`/* with-head */ `,
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} /* first-key */`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} /* tiebreak */`,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterWithQuery:     connection.rawFragment` /* with-tail issues=${issueCount} */`,
            })

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id, name as name from project order by project.organization_id /* first-key */, id, project.name /* tiebreak */  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })
})
