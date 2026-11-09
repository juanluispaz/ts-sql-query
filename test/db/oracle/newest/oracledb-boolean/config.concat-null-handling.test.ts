// Per-connection coverage of OracleConnection's NULL handling for concatenation —
// `.concat(...)` and the affix predicates (`startsWith` / `endsWith` / `contains` and their
// `Insensitive` variants) — Oracle-only.
//
// Oracle's `||` reads NULL as the empty string, so `'x' || null` is `'x'` where every other
// supported database answers NULL. This shows up twice: `concat` returns a present string
// where its declared type says the result is optional, and an affix predicate built on a NULL
// term collapses to `like '%'` and matches every row instead of none. `concat` and the affix
// predicates are one seam — a `startsWith` that propagates NULL while `concat` does not would
// only move the inconsistency. There are three modes, pinned here:
//   - default (neither option set) — EMULATE NULL propagation with a poison `CASE`, gated by
//     build-time optionality (required operands stay the bare `||`), matching the other dialects.
//   - `ignoreNullInConcat = true` — keep the bare native `||` (Oracle's own ignore-NULL semantics).
//   - `concatFunction` — route every concatenation through a user null-propagating function,
//     which poisons NULL itself without repeating the operand. `string_util.concat_strict` is
//     created by the schema (domain/schema.sql) — the same helper the docs tell users to create.
//
// A subclass of `DBConnection` sets the option while sharing `ctx.conn`'s CaptureInterceptor, so
// the emitted SQL is captured in `ctx.lastSql` and runs against the real engine. `issue` row 1
// is the one with `body = NULL`; row 2 has a value ('Use new tokens', title 'Redesign navbar').

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // === default: emulate NULL propagation with a poison CASE ===

    test('default: concat on an optional receiver poisons a NULL operand to NULL', async () => {
        // `body` is NULL on issue 1 and the result type is optional, so the emulated result is
        // NULL — what every other database answers. Oracle's bare `||` would hand back '!'.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, tagged: tIssue.body.concat('!') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when "body" is null then null else "body" || :0 end as "tagged" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tagged?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: concat of required operands stays the bare native ||', async () => {
        // `title` is required and '!' is a required literal, so nothing can be NULL — no CASE is
        // emitted, just `title || :0`. The result type is required too.
        const expected = [{ id: 2, tagged: 'Redesign navbar!' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, tagged: tIssue.title.concat('!') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title || :0 as "tagged" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tagged: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: a chained concat shares one flat poison CASE over the optional operands', async () => {
        // `body.concat('a').concat('b')` flattens to `body || :0 || :1`; only `body` can be NULL,
        // so the whole chain is wrapped in a single `CASE` that checks `body` once (not a nested
        // CASE per `||`). Issue 2 has a present body, so the value flows through the ELSE arm.
        const expected = [{ id: 2, v: 'Use new tokensab' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, v: tIssue.body.concat('a').concat('b') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when "body" is null then null else "body" || :0 || :1 end as "v" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            "b",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; v?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: a nested concatIfValue with an ignored value drops the dead operand', async () => {
        // `title.concatIfValue('').concat(body)`: the `''` is ignored (allowEmptyString:false), so
        // `concatIfValue('')` is a no-op that renders as just `title`. Nested under a further
        // `.concat(body)`, the structural concat walk treats that ignored node as a LEAF, so the
        // emitted chain is `title || "body"` with NO bound param for the dropped `''` — matching
        // every other dialect. (The pre-fix walk descended into the dead operand and emitted
        // `title || :0 || "body"` with `:0` bound to ''.) `body` is nullable, so a poison CASE
        // guards it. Issue 2 has body='Use new tokens', title='Redesign navbar'.
        const expected = [{ id: 2, v: 'Redesign navbarUse new tokens' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, v: tIssue.title.concatIfValue('').concat(tIssue.body) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when "body" is null then null else title || "body" end as "v" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; v?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: a nested concatIfValue(undefined) does not crash the concat walk', async () => {
        // `title.concatIfValue(undefined).concat(title)`: `undefined` is ignored, so `concatIfValue`
        // is a no-op rendering as just `title`, and the chain is `title || title`. Both operands are
        // required, so no poison CASE. The pre-fix walk fed the ignored `undefined` to `_isNull` and
        // threw `Cannot read properties of undefined (reading '__toSql')` on this type-checkable query.
        const expected = [{ id: 2, v: 'Redesign navbarRedesign navbar' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, v: tIssue.title.concatIfValue(undefined).concat(tIssue.title) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title || title as "v" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        // `concatIfValue` preserves the receiver's optionality (`title` is required), and
        // `.concat(title)` merges two required operands, so the result column is required.
        assertType<Exact<typeof rows, Array<{ id: number; v: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: a wrapped nested concat that reuses a receiver keeps its own poison CASE', async () => {
        // Regression guard: `body.concat(title).concat(body.concat(body).valueWhenNull('Z'))` reuses
        // the nullable `body` column as the receiver of BOTH the outer chain AND an INDEPENDENT
        // nested concat (wrapped in `valueWhenNull`, so it is absent from the outer null-check). The
        // nested concat must keep its OWN poison `CASE`: suppressing it by the shared receiver
        // (instead of the concat node) rendered it bare (`body || body`), which is what the nested
        // `CASE` in the snapshot pins. Its operand is the column, so the database is the one
        // deciding the null state and the `CASE` is emitted — a NULL the query already carries
        // would be settled while building instead (the test below).
        // Issue 2 has body='Use new tokens', title='Redesign navbar'.
        const nested = tIssue.body.concat(tIssue.body).valueWhenNull('Z')
        const expected = [{ id: 2, v: 'Use new tokensRedesign navbarUse new tokensUse new tokens' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, v: tIssue.body.concat(tIssue.title).concat(nested) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when "body" is null or nvl(case when "body" is null or "body" is null then null else "body" || "body" end, :0) is null then null else "body" || title || nvl(case when "body" is null or "body" is null then null else "body" || "body" end, :1) end as "v" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Z",
            "Z",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; v?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: a concat whose operand is already NULL is settled while the query is built', async () => {
        // The twin of the guard above with the NULL carried by the query instead of the row:
        // `body.concat(optionalConst(null)).valueWhenNull('Z')`. A NULL operand poisons the whole
        // concatenation and this one is known while building, so the nested concat is emitted as
        // NULL — no `CASE`, no operand, no parameter for the value that could not matter — and
        // `valueWhenNull` still answers 'Z'. Issue 2 has body='Use new tokens', title='Redesign navbar'.
        const nested = tIssue.body.concat(ctx.conn.optionalConst(null, 'string')).valueWhenNull('Z')
        const expected = [{ id: 2, v: 'Use new tokensRedesign navbarZ' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, v: tIssue.body.concat(tIssue.title).concat(nested) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when "body" is null or nvl(null, :0) is null then null else "body" || title || nvl(null, :1) end as "v" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Z",
            "Z",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; v?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: an affix predicate on an optional term matches no NULL-term row', async () => {
        // `title.startsWith(body)` on issue 1, whose `body` is NULL. The poisoned pattern is NULL,
        // so `title like NULL` excludes the row — what every other database does. Oracle's bare
        // `||` would make the pattern '%' and match issue 1 (see the ignoreNullInConcat test below).
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1).and(tIssue.title.startsWith(tIssue.body)))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where id = :0 and title like (case when replace(replace(replace("body", '\\', '\\\\'), '%', '\\%'), '_', '\\_') is null then null else replace(replace(replace("body", '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%' end) escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: an affix predicate on a required term stays the bare native pattern', async () => {
        // A required search term can never be NULL, so no poison is emitted — the plain
        // `title like (:0 || '%')`. Issue 2's title is 'Redesign navbar'.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWith('Redesign'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like (:0 || '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Redesign",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // === ignoreNullInConcat: keep Oracle's native || ===

    test('ignoreNullInConcat: concat keeps the bare native || (a NULL operand is ignored)', async () => {
        // The opt-out restores Oracle's own semantics: `body || :0` on the NULL row (issue 1)
        // returns '!' instead of NULL, no poison CASE.
        const conn = ctx.withIgnoreNullInConcat()
        const expected = [{ id: 1, tagged: '!' }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, tagged: tIssue.body.concat('!') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", "body" || :0 as "tagged" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tagged?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('ignoreNullInConcat: an affix predicate keeps the bare native || (a NULL term matches the row)', async () => {
        // The same query as the default affix test above, but with the opt-out: the NULL `body`
        // makes the pattern '%', so `title like '%'` matches issue 1 — the whole-table-match this
        // change exists to avoid by default.
        const conn = ctx.withIgnoreNullInConcat()
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1).and(tIssue.title.startsWith(tIssue.body)))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where id = :0 and title like (replace(replace(replace("body", '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // === concatFunction: route every concatenation through the user function ===

    test('concatFunction: concat on a null receiver answers null', async () => {
        // `body` is NULL on issue 1, and the result type is optional — which is what the
        // other databases answer. The function propagates NULL without repeating the operand.
        const conn = ctx.withConcatFunction('string_util.concat_strict')
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

    test('concatFunction: concat on a present receiver is unchanged', async () => {
        const conn = ctx.withConcatFunction('string_util.concat_strict')
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

    test('concatFunction: an affix predicate on a null term matches no row', async () => {
        // The half that silently corrupts a result set: with `||`, `title like (NULL || '%')`
        // is `title like '%'` and every issue comes back. Routing through the function makes the
        // pattern NULL, so nothing matches — which is what every other database does.
        const conn = ctx.withConcatFunction('string_util.concat_strict')
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

    test('concatFunction: an affix predicate on a present term still matches', async () => {
        // The function must not disable the predicate — only the NULL case changes.
        const conn = ctx.withConcatFunction('string_util.concat_strict')
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

    test('concatFunction: contains glues the wildcard on both sides through the function', async () => {
        const conn = ctx.withConcatFunction('string_util.concat_strict')
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

    test('concatFunction: an embedded concat is not wrapped in parenthesis', async () => {
        // `||` is an operator, so a concat embedded in a larger expression is wrapped —
        // `(title || :0) = :1`. The function is not an operator: it already stands alone,
        // and wrapping it would only add noise. A nested concat is not wrapped either.
        const conn = ctx.withConcatFunction('string_util.concat_strict')
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

    test('concatFunction: a chained concat nests the function calls', async () => {
        const conn = ctx.withConcatFunction('string_util.concat_strict')
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

    test('default: a concat whose operand is a concat over an optional column shares one flat poison CASE', async () => {
        // `title.concat(body.concat('!'))`: the inner concat is flattened into the
        // outer one, so the single CASE checks `body`, the only operand that can be
        // NULL. Issue 2: title 'Redesign navbar', body 'Use new tokens'.
        const expected = [{ id: 2, v: 'Redesign navbarUse new tokens!' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, v: tIssue.title.concat(tIssue.body.concat('!')) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when "body" is null then null else title || "body" || :0 end as "v" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; v?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('default: a concat over a NULL const receiver is settled as NULL while the query is built', async () => {
        // A NULL const poisons any concatenation it takes part in — as the receiver,
        // as the receiver of a chain, or nested as an operand — and that is known
        // while building, so each is emitted as a bare NULL and comes back absent.
        ctx.mockNext([{ id: 2, a: null, b: null, c: null }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                a:  ctx.conn.optionalConst(null, 'string').concat('!'),
                b:  ctx.conn.optionalConst(null, 'string').concat('!').concat(tIssue.title),
                c:  tIssue.title.concat(ctx.conn.optionalConst(null, 'string').concat('!')),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", null as "a", null as "b", null as "c" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; a?: string; b?: string; c?: string }>>>()
        expect(rows).toEqual([{ id: 2 }])
    })

    test('default: an insensitive affix predicate on an optional term matches no NULL-term row', async () => {
        // `title.startsWithInsensitive(body)` on issue 1, whose `body` is NULL: the
        // poisoned pattern is NULL inside `lower(...)`, so the row is excluded.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1).and(tIssue.title.startsWithInsensitive(tIssue.body)))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where id = :0 and lower(title) like lower(case when replace(replace(replace("body", '\\', '\\\\'), '%', '\\%'), '_', '\\_') is null then null else replace(replace(replace("body", '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%' end) escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('concatFunction: endsWith glues the wildcard on the left through the function', async () => {
        const conn = ctx.withConcatFunction('string_util.concat_strict')
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.title.endsWith('navbar'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like string_util.concat_strict('%', :0) escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "navbar",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('concatFunction: the insensitive affix predicates build the pattern through the function', async () => {
        // startsWith / endsWith / contains insensitive: each pattern is glued
        // through the function and lowered. Only issue 2 ('Redesign navbar')
        // matches all three.
        const conn = ctx.withConcatFunction('string_util.concat_strict')
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithInsensitive('REDESIGN'))
            .and(tIssue.title.endsWithInsensitive('NavBar'))
            .and(tIssue.title.containsInsensitive('SIGN'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(title) like lower(string_util.concat_strict(:0, '%')) escape '\\' and lower(title) like lower(string_util.concat_strict('%', :1)) escape '\\' and lower(title) like lower(string_util.concat_strict(string_util.concat_strict('%', :2), '%')) escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "REDESIGN",
            "NavBar",
            "SIGN",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
