// `allowWhen` / `disallowWhen` introspection over the one query region the other
// `select.allow-when.*` files do not reach: the raw-fragment hooks of
// `customizeQuery({...})`.
//
// The introspection walker mirrors the SQL builder clause by clause.
// `customizeQuery` is the one place a caller can smuggle a value source into a
// query through a FRAGMENT rather than a typed clause, so the walker has to open
// every fragment slot and re-ask the question. Two paths do this with two hook
// vocabularies:
//
//   - a PLAIN select accepts all nine hooks: `beforeWithQuery`, `beforeQuery`,
//     `afterSelectKeyword`, `beforeColumns`, `customWindow`, `beforeOrderByItems`,
//     `afterOrderByItems`, `afterQuery`, `afterWithQuery`;
//   - a COMPOUND select types only four of them — `beforeWithQuery`,
//     `beforeQuery`, `afterQuery`, `afterWithQuery`. The other five cannot be set
//     on a compound at all, so they are not tested here.
//
// `afterOrderByItems` on a plain select is already pinned by
// `select.allow-when.limit-offset-compound.test.ts` and is deliberately absent.
//
// Every test asserts the gate CLOSED, because that is the only falsifiable
// direction: `isQueryAllowed(query) === false` can only be produced by the walker
// actually opening that hook's fragment. An open-gate mirror would report `true`
// whether or not the walker descended, so it would pin nothing.
//
// Where the hook has a render site in the shape under test, the test also asserts
// the second, independent observable: the build throws before any SQL reaches the
// driver. The `with`-query hooks only render once the query is materialised as a
// CTE, so those tests use `forUseInQueryAs(...)`. The one exception is the compound
// all-hooks test, where the with-hooks have no attachment point at a compound root
// and are silently dropped — there the walker's verdict is the only signal, and the
// emitted SQL is snapshotted to prove the renderer saw nothing.
//
// The throw is SYNCHRONOUS — the query renders before the promise chain is entered
// — hence `try { await … } catch` rather than `.rejects`. `isQueryAllowed` is the
// sanctioned introspection seam; see test/LIMITATIONS.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/queryIntrospection.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('allow-when/plain-before-query-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `beforeQuery` is spliced ahead of the whole statement.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head ${tProject.slug.disallowWhen(true, 'plain before-query gate blocks')} */ `,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain before-query gate blocks')
    })

    test('allow-when/plain-after-select-keyword-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `afterSelectKeyword` splices right after the `select` keyword.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint ${tProject.slug.disallowWhen(true, 'plain after-select-keyword gate blocks')} */`,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain after-select-keyword gate blocks')
    })

    test('allow-when/plain-before-columns-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `beforeColumns` splices between the select keyword and the projection.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`/* cols ${tProject.slug.disallowWhen(true, 'plain before-columns gate blocks')} */ `,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain before-columns gate blocks')
    })

    test('allow-when/plain-custom-window-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `customWindow` carries the `window <name> as (...)` clause — the escape
        // hatch for window functions, which the fluent API does not model. A gated
        // column inside the partition expression is exactly what the gate exists
        // to stop.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                customWindow: connection.rawFragment`w1 as (partition by ${tProject.organizationId.disallowWhen(true, 'plain custom-window gate blocks')})`,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain custom-window gate blocks')
    })

    test('allow-when/plain-before-order-by-items-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `beforeOrderByItems` renders even with no `orderBy(...)` at all — every
        // dialect keeps that no-ordering branch — so the gate is reachable on the
        // bare shape.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId.disallowWhen(true, 'plain before-order-by-items gate blocks')} asc`,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain before-order-by-items gate blocks')
    })

    test('allow-when/plain-after-query-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `afterQuery` is appended past limit/offset, the last statement slot.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                afterQuery: connection.rawFragment` /* tail ${tProject.slug.disallowWhen(true, 'plain after-query gate blocks')} */`,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain after-query gate blocks')
    })

    test('allow-when/plain-before-with-query-hook-gated-closed-in-cte-reports-disallowed-and-blocks-build', async () => {
        // `beforeWithQuery` only has a render site once the select is materialised
        // as a CTE, so the walker reaches it from the OUTER query via the with-view
        // and both observables live on the outer query.
        const connection = ctx.conn
        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* warmup ${tIssue.title.disallowWhen(true, 'plain before-with-query gate blocks')} */`,
            })
            .forUseInQueryAs('open_issues')

        const query = connection.selectFrom(openIssues)
            .select({ id: openIssues.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain before-with-query gate blocks')
    })

    test('allow-when/plain-after-with-query-hook-gated-closed-in-cte-reports-disallowed-and-blocks-build', async () => {
        // The closing with-hook, which renders after the CTE's parens.
        const connection = ctx.conn
        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .customizeQuery({
                afterWithQuery: connection.rawFragment`/* end-of-with ${tIssue.title.disallowWhen(true, 'plain after-with-query gate blocks')} */`,
            })
            .forUseInQueryAs('open_issues')

        const query = connection.selectFrom(openIssues)
            .select({ id: openIssues.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('plain after-with-query gate blocks')
    })

    test('allow-when/compound-customization-with-after-with-query-gated-closed-reports-disallowed-without-blocking-build', async () => {
        // All four compound hooks are set at once and only the LAST one the walker
        // inspects is gated closed, so the walker has to traverse the whole
        // customization block — every earlier hook passing — and still return
        // false.
        //
        // At any ROOT the with-hooks have no attachment point and render nothing —
        // that is why the plain-select twins in this file materialise the query as
        // a CTE — so the build SUCCEEDS and the SQL carries no trace of the gate. That makes the introspection verdict the sole observable here: the
        // walker is deliberately stricter than the renderer.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id }),
            )
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head ${tProject.slug.disallowWhen(false, 'compound before-with-query gate open')} */ `,
                beforeQuery: connection.rawFragment`/* head */ `,
                afterQuery: connection.rawFragment` /* tail */`,
                afterWithQuery: connection.rawFragment` /* with-tail ${tProject.slug.disallowWhen(true, 'compound after-with-query gate blocks')} */`,
            })

        expect(isQueryAllowed(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select id as id from project union select id as id from issue order by id  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('allow-when/compound-before-with-query-hook-gated-closed-in-cte-reports-disallowed-and-blocks-build', async () => {
        // A compound materialised as a CTE is the shape where a compound's
        // with-hooks DO render, so here the renderer agrees with the walker and the
        // build refuses.
        const connection = ctx.conn
        const combined = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .union(
                connection.selectFrom(tProject)
                    .where(tProject.id.equals(2))
                    .select({ id: tProject.id }),
            )
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head ${tProject.slug.disallowWhen(true, 'compound before-with-query gate blocks')} */ `,
            })
            .forUseInQueryAs('combined')

        const query = connection.selectFrom(combined)
            .select({ id: combined.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('compound before-with-query gate blocks')
    })

    test('allow-when/compound-before-query-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `beforeQuery` on a compound renders ahead of the whole
        // `select … union select …`, so both observables are available on the root.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id }),
            )
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head ${tProject.slug.disallowWhen(true, 'compound before-query gate blocks')} */ `,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('compound before-query gate blocks')
    })

    test('allow-when/compound-after-query-hook-gated-closed-reports-disallowed-and-blocks-build', async () => {
        // `afterQuery` on a compound is appended past the compound's own order-by,
        // limit and offset.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id }),
            )
            .orderBy('id')
            .customizeQuery({
                afterQuery: connection.rawFragment` /* tail ${tProject.slug.disallowWhen(true, 'compound after-query gate blocks')} */`,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('compound after-query gate blocks')
    })
})
