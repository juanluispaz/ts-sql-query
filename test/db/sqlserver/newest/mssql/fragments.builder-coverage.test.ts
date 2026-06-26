// Fragment-builder fan-out via new domain helpers: the aggregate-fragment
// builders (`buildAggregateFragmentWith{Args,ArgsIfValue,MaybeOptionalArgs}`),
// `buildFragmentWith*` at extra arities (0-ary, 4-ary Args; 1-ary
// MaybeOptionalArgs), `arg` / `valueArg` over uuid and string keywords, and
// `rawFragment` with 5 and 7 interpolated value sources.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-fragment-builders-in-select-and-having', async () => {
        // The three aggregate-fragment factories: `aggSumColumn` (Args ->
        // sum), `aggMaxColumnOptional` (MaybeOptionalArgs -> max), and
        // `aggSumAboveIfValue` (ArgsIfValue -> a conditional `sum(...) > N`
        // aggregate predicate in HAVING). Threshold 2 keeps project 1 (sum 3)
        // and project 2 (sum 3), drops project 3 (sum 2).
        const expected = [
            { pid: 1, total: 3, mx: 2 },
            { pid: 2, total: 3, mx: 3 },
        ]
        ctx.mockNext(expected)
        const c = ctx.conn
        const rows = await c.selectFrom(tIssue)
            .select({
                pid:   tIssue.projectId,
                total: c.aggSumColumn(tIssue.priority),
                mx:    c.aggMaxColumnOptional(tIssue.priority),
            })
            .groupBy('pid')
            .having(c.aggSumAboveIfValue(tIssue.priority, 2))
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, sum(priority) as total, max(priority) as mx from issue group by project_id having sum(priority) > @0 order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; total: number; mx: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('build-fragment-with-args-zero-four-and-maybe-optional-one-arities', async () => {
        // 0-ary (`constFortyTwo`), 4-ary (`sumFourColumns`) Args, and 1-ary
        // MaybeOptionalArgs (`negateMaybeOptional`). The MaybeOptionalArgs
        // result is REQUIRED here because the arg is a required column
        // (`priority`) — the `optional` flag only applies when the arg is. Issue
        // 1: priority 2, id 1, number 1 -> sum4 = 2+2+1+1 = 6, neg = -2.
        const expected = { forty: 42, sum4: 6, neg: -2 }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                forty: c.constFortyTwo(),
                sum4:  c.sumFourColumns(tIssue.priority, tIssue.priority, tIssue.id, tIssue.number),
                neg:   c.negateMaybeOptional(tIssue.priority),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select 42 as forty, priority + priority + id + number as sum4, -priority as neg from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ forty: number; sum4: number; neg: number }>>>()
        expect(rows).toEqual([expected])
    })

    test('uuid-arg-coalesce-projected', async () => {
        // `coalesceUuid` exercises a `uuid` `arg`. Issue 1's plain-uuid
        // `external_ref` coalesced with itself.
        const REF1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = { key: REF1 }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                key: c.coalesceUuid(tIssue.externalRef, tIssue.externalRef),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(external_ref, external_ref) as [key] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ key?: string | undefined }>>>()
        expect(rows).toEqual([expected])
    })

    test('string-value-arg-if-value-in-where', async () => {
        // `equalsStringIfValue` exercises a `string` `valueArg`. With a present
        // value it emits `status = $1`; the two open issues match.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const c = ctx.conn
        const rows = await c.selectFrom(tIssue)
            .where(c.equalsStringIfValue(tIssue.status, 'open'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where status = @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('raw-fragment-with-five-and-seven-interpolations', async () => {
        // `rawFragment` carries a source union widened by the number of
        // interpolated value sources; here the 5- and 7-interpolation arms
        // (spliced as order-by items).
        ctx.mockNext([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])
        const c = ctx.conn
        const five = await c.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: c.rawFragment`${tIssue.priority} desc, ${tIssue.status} asc, ${tIssue.projectId} asc, ${tIssue.number} desc, ${tIssue.title} asc`,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.priority desc, issue.status asc, issue.project_id asc, issue.number desc, issue.title asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof five, Array<{ id: number }>>>()

        ctx.mockNext([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])
        const seven = await c.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: c.rawFragment`${tIssue.priority} desc, ${tIssue.status} asc, ${tIssue.projectId} asc, ${tIssue.number} desc, ${tIssue.title} asc, ${tIssue.assigneeId} asc, ${tIssue.parentId} desc`,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.priority desc, issue.status asc, issue.project_id asc, issue.number desc, issue.title asc, issue.assignee_id asc, issue.parent_id desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof seven, Array<{ id: number }>>>()
    })
})
