// Coverage of the compound-operator variants
// [select.compound.test.ts](./select.compound.test.ts) leaves on the
// table: `intersectAll`, `exceptAll`, `minus`, `minusAll`. MariaDB's
// `MINUS` keyword only exists under `SET SQL_MODE=ORACLE` (which
// ts-sql-query never sets), so in the default mode every connection
// uses, `MINUS` is a parse error and `EXCEPT` is the portable form.
// The builder therefore renders `.minus(...)` / `.minusAll(...)` as
// `except` / `except all` (the same form PostgreSQL and MySQL emit),
// and each runs against the real engine asserting the result multiset
// (compound order is engine-defined).

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue intersect all select status as status from issue where priority <= ?"`)
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
        const expected = [{ status: 'closed' }, { status: 'open' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await all.exceptAll(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except all select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'open'])
    })

    test('minus-routes-through-the-dialect-alias', async () => {
        // `.minus(...)` renders as ` except ` on MariaDB (its MINUS keyword
        // is Oracle-mode only). Distinct left statuses
        // {open, in_progress, closed} minus right (id <= 2)
        // {open, in_progress} leaves {closed}.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await all.minus(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed'])
    })

    test('minus-all-routes-through-the-dialect-alias', async () => {
        // The `*All` flavour renders as ` except all ` (MINUS ALL is
        // Oracle-mode only on MariaDB). left = all statuses
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except all select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed', 'open'])
    })
})
