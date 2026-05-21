// `RawFragmentImpl` ([src/internal/RawFragmentImpl.ts](../../../../../src/internal/RawFragmentImpl.ts))
// forwards `__addWiths`, `__registerTableOrView`,
// `__registerRequiredColumn`, `__getOldValues`,
// `__getValuesForInsert` and `__isAllowed` over every entry in its
// `__params` array. The forwarders are exercised when one of those
// params is a full sub-query (`IExecutableSelectQuery`) instead of
// a plain value source.
//
// Most tests here drive `rawFragment` through `customizeQuery` hooks
// that land in non-comment SQL positions (`beforeColumns` as an
// extra projection, `beforeOrderByItems` / `afterOrderByItems` as
// an extra sort key) so the embedded sub-query's placeholder sits
// in real SQL and the real DB cell actually executes it. The one
// exception is `rawfragment-hook-embeds-nested-subqueries-deeply`
// which uses `afterSelectKeyword` with a `/* ... */` tag: the
// scalar-aggregate wrapper has no non-comment hook position that
// accepts an embedded scalar sub-query universally, so that test is
// mock-only by design (some drivers strip comments and would
// mis-count the placeholders).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('rawfragment-hook-embeds-select-in-before-columns-as-extra-projection', async () => {
        // `beforeColumns` splices the fragment right before the
        // explicit column list, so the embedded SELECT renders as
        // an extra projection. The snapshot pins the inlined
        // sub-query's shape AND param ordering: the inner WHERE
        // placeholder lands first (before the outer columns).
        ctx.mockNext([{ openCount: 3, id: 1 }, { openCount: 1, id: 2 }])
        const connection = ctx.conn
        const openCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .selectOneColumn(connection.count(tIssue.id))

        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${openCount}) as "openCount", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select count(id) as result from issue where status = $1) as "openCount",  id as id from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-hook-embeds-select-in-before-order-by-items', async () => {
        // `beforeOrderByItems` splices the fragment as an extra
        // ORDER BY item, comma-joined ahead of the explicit ones.
        // Embedded sub-queries work here because the placeholder
        // ends up inside a real SQL expression that the driver
        // counts.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const connection = ctx.conn
        const openCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .selectOneColumn(connection.count(tIssue.id))

        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`(${openCount}) asc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by (select count(id) as result from issue where status = $1) asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-hook-embeds-multiple-subqueries-in-single-fragment', async () => {
        // One fragment, two embedded sub-queries. The forwarder has
        // to visit both `__params` entries; the snapshot pins the
        // emitted param order (inner sub-query #1 first, then #2).
        ctx.mockNext([{ openCount: 3, closedCount: 1, id: 1 }])
        const connection = ctx.conn
        const openCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .selectOneColumn(connection.count(tIssue.id))
        const closedCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .selectOneColumn(connection.count(tIssue.id))

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${openCount}) as "openCount", (${closedCount}) as "closedCount", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select count(id) as result from issue where status = $1) as "openCount", (select count(id) as result from issue where status = $2) as "closedCount",  id as id from project where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-hook-embeds-nested-subqueries-deeply', async () => {
        // Outer SELECT's hook embeds scalar sub-query A; A's own
        // customize hook embeds scalar sub-query B as part of a
        // metadata comment in the `afterSelectKeyword` slot - a
        // natural position for tag-style annotations next to a
        // scalar aggregate. The forwarder has to recurse through
        // the embedded query's own customization tree without
        // dropping B's params.
        //
        // Mock-only because some drivers strip comments before
        // counting placeholders and would reject the extra param at
        // execution (same reason as
        // `customize-select-hook-fragment-with-bound-param`).
        if (ctx.realDbEnabled) return
        ctx.mockNext([{ wrapped: 7, id: 1 }])
        const connection = ctx.conn

        const closedCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .selectOneColumn(connection.count(tIssue.id))

        const wrapper = connection.selectFrom(tIssue)
            .where(tIssue.priority.greaterOrEqual(2))
            .selectOneColumn(connection.count(tIssue.id))
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* closed=(${closedCount}) */`,
            })

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${wrapper}) as "wrapped", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select /* closed=(select count(id) as result from issue where status = $1) */ count(id) as result from issue where priority >= $2) as "wrapped",  id as id from project where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "closed",
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })
})
