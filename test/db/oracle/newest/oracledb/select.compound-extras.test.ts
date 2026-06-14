// Coverage of the compound-operator variants
// [select.compound.test.ts](./select.compound.test.ts) leaves on the
// table: `intersectAll`, `exceptAll`, `minus`, `minusAll`. Each lands
// on `_appendCompoundOperator` in
// [src/sqlBuilders/AbstractSqlBuilder.ts](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts),
// which is overridden by
// [`OracleSqlBuilder._appendCompoundOperator`](../../../../../src/sqlBuilders/OracleSqlBuilder.ts)
// (maps `except`/`minus` to Oracle's native ` minus ` and
// `exceptAll`/`minusAll` to ` minus all `; `intersectAll` to
// ` intersect all `).
//
// Oracle 23ai (the matrix engine, verified) supports INTERSECT ALL /
// MINUS ALL / EXCEPT / EXCEPT ALL natively, and the fluent API types
// `.intersectAll` / `.exceptAll` / `.minusAll` for oracle, so each runs
// against the real engine asserting the result multiset (compound order
// is engine-defined).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('intersect-all-emits-intersect-all-syntax', async () => {
        // INTERSECT ALL keeps row-multiplicities (vs INTERSECT which
        // deduplicates). left = every issue status
        // (open, in_progress, open, closed); right (priority <= 3) = all
        // four rows, so the intersection is the full left multiset.
        const expected = [{ status: 'closed' }, { status: 'in_progress' }, { status: 'open' }, { status: 'open' }]
        ctx.mockNext(expected)
        const left = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const right = ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.lessOrEqual(3))
            .select({ status: tIssue.status })
        const result = await left.intersectAll(right).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status" from issue intersect all select status as "status" from issue where priority <= :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        // Compound result order is engine-defined; compare as a multiset.
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'in_progress', 'open', 'open'])
    })

    test('except-all-emits-except-all-syntax', async () => {
        // EXCEPT ALL preserves duplicates from the left side that have
        // no matching duplicate on the right. left = all statuses
        // (open, in_progress, open, closed); right (id <= 2) =
        // open, in_progress. Subtracting one of each leaves open, closed.
        // On Oracle the builder emits the native ` minus all ` form.
        const expected = [{ status: 'closed' }, { status: 'open' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await all.exceptAll(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status" from issue minus all select status as "status" from issue where id <= :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'open'])
    })

    test('minus-routes-through-the-dialect-alias', async () => {
        // On Oracle the fluent `.minus(...)` method routes through the
        // dialect override and emits ` minus ` (Oracle's native
        // set-difference operator). (Oracle 23ai also accepts `EXCEPT`, but
        // the builder emits `minus`.)
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        await all.minus(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status" from issue minus select status as "status" from issue where id <= :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    test('minus-all-routes-through-the-dialect-alias', async () => {
        // The `*All` flavour renders as ` minus all ` on Oracle (its
        // native multiset difference). left = all statuses
        // (open, in_progress, open, closed); right (id <= 2) =
        // open, in_progress. Subtracting one of each leaves open, closed.
        const expected = [{ status: 'closed' }, { status: 'open' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await all.minusAll(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status" from issue minus all select status as "status" from issue where id <= :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'open'])
    })
})
