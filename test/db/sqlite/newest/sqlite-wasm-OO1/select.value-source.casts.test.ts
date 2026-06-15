// Coverage of the numeric cast surface on value sources. Each cast
// lands on a distinct `_asXxx` operator in
// [src/internal/ValueSourceImpl.ts](../../../../../src/internal/ValueSourceImpl.ts);
// the dialect's `_appendSqlOperation*` renders the concrete SQL — the
// snapshots are the source of truth for that per-dialect rendering.
//
//   - `.asDouble()`             → cast to real / float / numeric per dialect
//   - `.asInt()` on a double    → emulated via `round(...)`
//   - `.asBigint()` on a double → emulated via `round(...)`
//   - `.asInt()` / `.asBigint()` on an int — typed-only noop in SQL
//
// `.asString()` is only typed on UUID/CustomUuid value sources, so it
// is not exercised here; the seed schema has no UUID column. The wider
// `_asString` path is covered indirectly through aggregation tests
// (`select.aggregation*` for UUID dialects when added).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('asDouble-on-int-emits-cast', async () => {
        // `.asDouble()` always emits an explicit cast (sqlite uses
        // `cast(... as real)`; other dialects pick their own
        // floating-point type).
        const expected = [{ id: 1, d: 2.0 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                d:  tIssue.priority.asDouble(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(priority as real) as "d" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; d: number }>>>()
        expect(result).toEqual(expected)
    })

    test('asInt-on-int-is-noop-in-sql', async () => {
        // `.asInt()` on an already-int column emits no `cast(...)` —
        // the library returns a NoopValueSource. The snapshot proves
        // the SQL is identical to selecting the plain column.
        const expected = [{ id: 1, p: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                p:  tIssue.priority.asInt(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "p" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p: number }>>>()
        expect(result).toEqual(expected)
    })

    test('asBigint-on-int-is-noop-in-sql', async () => {
        // Same noop-in-SQL behaviour as `.asInt()` — the cast only
        // shifts the TS-level value type to `bigint`. The mock returns
        // a plain number; we only assert SQL shape and the TS surface.
        ctx.mockNext([{ id: 1, p: 2 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                p:  tIssue.priority.asBigint(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "p" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p: bigint }>>>()
    })

    test('asInt-on-double-uses-round', async () => {
        // When the source is a double, `.asInt()` is "unsafe" and the
        // library emits `round(...)` to make the conversion explicit.
        // Build a double via `.divide(...)` (which always upcasts) and
        // then cast back: priority(id=1)=2 / 3 = 0.666... → round → 1.
        const expected = [{ id: 1, rounded: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:      tIssue.id,
                rounded: tIssue.priority.divide(3).asInt(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(cast(priority as real) / cast(? as real)) as rounded from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; rounded: number }>>>()
        expect(result).toEqual(expected)
    })

    test('asBigint-on-double-uses-round', async () => {
        // Mirror of the above — same `_round` operator emitted when
        // the source is a double, just with a `bigint` TS-level type.
        ctx.mockNext([{ id: 1, rounded: 1 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:      tIssue.id,
                rounded: tIssue.priority.divide(3).asBigint(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(cast(priority as real) / cast(? as real)) as rounded from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; rounded: bigint }>>>()
    })

    test('asDouble-chain-roundtrips-int', async () => {
        // `.asDouble().asInt()` on an int column: the first cast goes
        // through a real `_asDouble` operator (renders as
        // `cast(... as real)` on sqlite), the second emits `round(...)`
        // because the source is now typed `double`.
        const expected = [{ id: 1, p: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                p:  tIssue.priority.asDouble().asInt(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(cast(priority as real)) as "p" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p: number }>>>()
        expect(result).toEqual(expected)
    })

    test('asDouble-on-nullable-column-keeps-optional', async () => {
        // `assigneeId` is `optionalColumn`, so the cast inherits the
        // optional flag. The TS result type still allows the property
        // to be absent under optional-as-undefined projection.
        ctx.mockNext([{ id: 1, a: 7.0 }, { id: 3 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                id: tIssue.id,
                a:  tIssue.assigneeId.asDouble(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(assignee_id as real) as "a" from issue where id in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; a?: number }>>>()
    })
})
