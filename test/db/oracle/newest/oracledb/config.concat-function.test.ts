// Per-connection coverage of OracleConnection's `concatFunction` — Oracle-only.
//
// Oracle's `||` reads NULL as the empty string, which shows up twice: `concat` on a NULL
// receiver returns a present string where its declared type says the result is optional,
// and an affix predicate built on a NULL term collapses to `like '%'` and matches every
// row. Naming a null-propagating function routes BOTH through it — they are the same seam
// on purpose, since fixing one and not the other would just move the inconsistency.
//
// `string_util.concat_strict` is created by the schema (see domain/schema.sql). A subclass
// of `DBConnection` sets the option while sharing `ctx.conn`'s CaptureInterceptor, so the
// emitted SQL is captured in `ctx.lastSql` and runs against the real engine.
//
// `issue` row 1 is the one with `body = NULL`; row 2 has a value.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

class ConcatFunctionConnection extends DBConnection {
    protected override concatFunction = 'string_util.concat_strict'
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('concat-function: concat on a null receiver answers null', async () => {
        // `body` is NULL on issue 1, and the result type is optional — which is what the
        // other databases answer. Oracle's `||` would hand back the present string '!'.
        const conn = new ConcatFunctionConnection(ctx.conn.queryRunner)
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, tagged: tIssue.body.concat('!') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", string_util.concat_strict("body", :0) as "tagged" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tagged?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-function: concat on a present receiver is unchanged', async () => {
        const conn = new ConcatFunctionConnection(ctx.conn.queryRunner)
        const expected = [{ id: 2, tagged: 'Use new tokens!' }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, tagged: tIssue.body.concat('!') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", string_util.concat_strict("body", :0) as "tagged" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tagged?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-function: an affix predicate on a null term matches no row', async () => {
        // The half that silently corrupts a result set: with `||`, `title like (NULL || '%')`
        // is `title like '%'` and every issue comes back. Propagating the NULL makes the
        // pattern NULL, so nothing matches — which is what every other database does.
        const conn = new ConcatFunctionConnection(ctx.conn.queryRunner)
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.title.startsWith(tIssue.body))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like string_util.concat_strict(replace(replace(replace("body", '\\', '\\\\'), '%', '\\%'), '_', '\\_'), '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-function: an affix predicate on a present term still matches', async () => {
        // The function must not disable the predicate — only the NULL case changes.
        const conn = new ConcatFunctionConnection(ctx.conn.queryRunner)
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.title.startsWith('Redesign'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like string_util.concat_strict(:0, '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Redesign",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-function: contains glues the wildcard on both sides through the function', async () => {
        const conn = new ConcatFunctionConnection(ctx.conn.queryRunner)
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.title.contains('design'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like string_util.concat_strict(string_util.concat_strict('%', :0), '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "design",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-function: an embedded concat is not wrapped in parenthesis', async () => {
        // `||` is an operator, so a concat embedded in a larger expression is wrapped —
        // `(title || :0) = :1`. The function is not an operator: it already stands alone,
        // and wrapping it would only add noise. A nested concat is not wrapped either.
        const conn = new ConcatFunctionConnection(ctx.conn.queryRunner)
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.title.concat('!').equals('Redesign navbar!'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where string_util.concat_strict(title, :0) = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            "Redesign navbar!",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-function: a chained concat nests the function calls', async () => {
        const conn = new ConcatFunctionConnection(ctx.conn.queryRunner)
        const expected = [{ id: 2, v: 'Redesign navbarab' }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, v: tIssue.title.concat('a').concat('b') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", string_util.concat_strict(string_util.concat_strict(title, :0), :1) as "v" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            "b",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; v: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-function: unset, the connection keeps Oracle\'s own || semantics', async () => {
        // The default: nothing is paid, and an Oracle developer gets what they expect.
        // `ctx.conn` has no `concatFunction`, so the emission is the plain `||` one.
        const expected = [{ id: 2, tagged: 'Use new tokens!' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, tagged: tIssue.body.concat('!') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", "body" || :0 as "tagged" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tagged?: string }>>>()
        expect(rows).toEqual(expected)
    })
})
