// Coverage of the compound-operator variants
// [select.compound.test.ts](./select.compound.test.ts) leaves on the
// table: `intersectAll`, `exceptAll`, `minus`, `minusAll`. Each lands
// on `_appendCompoundOperator` in
// [src/sqlBuilders/AbstractSqlBuilder.ts:661](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L661),
// which is overridden by
// [`OracleSqlBuilder._appendCompoundOperator`](../../../../../src/sqlBuilders/OracleSqlBuilder.ts#L340)
// (maps both `except` and `minus` to Oracle's native ` minus `) and
// [`MariaDBSqlBuilder._appendCompoundOperator`](../../../../../src/sqlBuilders/MariaDBSqlBuilder.ts#L16)
// (preserves `minus` natively).
//
// The fluent API narrows `intersectAll` / `exceptAll` / `minusAll` to
// `postgres` / `mariadb` only and `minus` to everyone except `mysql`
// (see [src/expressions/select.ts:122-127](../../../../../src/expressions/select.ts#L122-L127));
// cells whose dialect is excluded by those narrowings comment the
// affected tests out with `TODO[LIMITATION]: see LIMITATIONS.md`.
//
// PostgreSQL accepts all four operators natively. The runtime arm is
// kept inside `try/catch` solely for symmetry with the wrapped-in-the-
// other-cells form — at this cell it always succeeds.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('intersect-all-emits-intersect-all-syntax', async () => {
        // INTERSECT ALL keeps row-multiplicities (vs INTERSECT which
        // deduplicates).
        const expected = [{ status: 'open' }, { status: 'open' }]
        ctx.mockNext(expected)
        const left = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const right = ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.lessOrEqual(3))
            .select({ status: tIssue.status })
        try {
            await left.intersectAll(right).executeSelectMany()
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue intersect all select status as status from issue where priority <= $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
    })

    test('except-all-emits-except-all-syntax', async () => {
        // EXCEPT ALL preserves duplicates from the left side that have
        // no matching duplicate on the right.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        try {
            await all.exceptAll(small).executeSelectMany()
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except all select status as status from issue where id <= $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    test('minus-routes-through-the-dialect-alias', async () => {
        // On PostgreSQL the default `_appendCompoundOperator` rewrites
        // `.minus(...)` to ` except `.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        try {
            await all.minus(small).executeSelectMany()
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except select status as status from issue where id <= $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    test('minus-all-routes-through-the-dialect-alias', async () => {
        // Same as `minus-routes-through-the-dialect-alias` but for the
        // `*All` flavour. PostgreSQL accepts the rewritten ` except
        // all ` form.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        try {
            await all.minusAll(small).executeSelectMany()
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except all select status as status from issue where id <= $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })
})
