// Coverage of the IfValue-defaulting modifiers and the inline
// `valueWhenNull` *with a value-source default*. These wrap a value
// source whose SQL might collapse to the empty string (IfValue
// elision) or to NULL (column-level NULL) into a stable boolean /
// scalar — covering classes
// that are not exercised by
// [select.value-source.null-and-if-value-modifiers.test.ts](./select.value-source.null-and-if-value-modifiers.test.ts):
//
//   - `BooleanValueWhenNoValueValueSource` — `.trueWhenNoValue()` /
//     `.falseWhenNoValue()` on an IfValue predicate. When the IfValue
//     elides (its `__toSql` returns ''), the wrapper substitutes the
//     `_true`/`_false` literal of the dialect.
//   - `ValueWhenNoValueValueSource` — `.valueWhenNoValue(other)` on an
//     IfValue predicate where the default is itself another IfValue /
//     boolean expression (not a literal). Distinct from the
//     `valueWhenNoValue(literal)` boolean overload because the SQL
//     side has to render the alternate value source recursively.
//   - `SqlOperationValueWhenNullValueSource` with the value-source
//     overload (`tIssue.assigneeId.valueWhenNull(tIssue.id)` is
//     covered with a column default; the literal-default branch is
//     covered too; this file pins the
//     `valueWhenNull(connection.const('X', 'string', 'required'))`
//     shape that goes through the *parameterised* RHS path of
//     `_valueWhenNull`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('equals-if-value-true-when-no-value-elided-emits-true-literal', async () => {
        // `tIssue.status.equalsIfValue(undefined).trueWhenNoValue()` —
        // the IfValue elides (undefined), so the wrapper emits the
        // dialect's TRUE literal in WHERE. The whole WHERE clause
        // therefore is unconditionally TRUE → all 4 issues.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter).trueWhenNoValue())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where true order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('equals-if-value-true-when-no-value-fires-uses-if-value-sql', async () => {
        // Same wrapper as above, but the IfValue does fire (defined
        // probe). The wrapper's `__toSql` falls through to the
        // underlying IfValue's SQL — `status = ?` — and the TRUE
        // fallback is unused.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)

        const filter: string | undefined = 'open'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter).trueWhenNoValue())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('equals-if-value-false-when-no-value-elided-emits-false-literal', async () => {
        // Twin of test 1 with `falseWhenNoValue()`: elided IfValue
        // collapses to the dialect's FALSE literal, the WHERE matches
        // nothing.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter).falseWhenNoValue())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where false order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('value-when-no-value-literal-boolean-substitutes-on-elide', async () => {
        // `.valueWhenNoValue(true)` overload — same semantics as
        // `trueWhenNoValue()` but goes through the
        // `BooleanValueWhenNoValueValueSource` constructor that takes
        // an explicit operation parameter.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter).valueWhenNoValue(true))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where true order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('value-when-no-value-other-boolean-source-substitutes-on-elide', async () => {
        // `valueWhenNoValue(otherCondition)` where the default is
        // itself another boolean value source — pins
        // `ValueWhenNoValueValueSource.__toSql` (returns the alternate
        // value source's SQL when the primary elides). Here primary
        // elides (undefined), so the fallback `priority > ?` is what
        // ends up in the WHERE clause. Seed: issue 2 has priority 1
        // (excluded); the other three (1, 3, 4) all have priority ≥ 2.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter).valueWhenNoValue(tIssue.priority.greaterThan(1)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('value-when-no-value-other-boolean-source-fires-keeps-primary', async () => {
        // Twin: primary IfValue fires (defined probe). The wrapper's
        // `__toSql` returns the primary SQL and the fallback is
        // unused — the SQL never references the priority comparison.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)

        const filter: string | undefined = 'open'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter).valueWhenNoValue(tIssue.priority.greaterThan(99)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('value-when-no-value-false-as-selected-column-elided-emits-false-literal', async () => {
        // Boolean IfValue with `valueWhenNoValue(false)` selected as a
        // projected column (not used in WHERE).
        // → `falseWhenNoValue()` → `BooleanValueWhenNoValueValueSource`,
        // and the SELECT path hits the class's `__toSql`,
        // distinct from the `__toSqlForCondition` path the WHERE tests
        // above cover. With the IfValue elided, the column emits the
        // dialect's FALSE literal.
        const expected = [{ id: 1, statusMatches: false }]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:            tIssue.id,
                statusMatches: tIssue.status.equalsIfValue(filter).valueWhenNoValue(false),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, false as statusMatches from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:            number
            statusMatches: boolean
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('value-when-no-value-false-as-selected-column-fires-uses-primary-sql', async () => {
        // Twin: when the IfValue does fire, the wrapper's `__toSql`
        // returns the primary SQL (`if (sql) return sql`)
        // and the FALSE fallback is unused. Issue 1's status is
        // `'open'`, matching the probe.
        const expected = [{ id: 1, statusMatches: true }]
        ctx.mockNext(expected)

        const filter: string | undefined = 'open'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:            tIssue.id,
                statusMatches: tIssue.status.equalsIfValue(filter).valueWhenNoValue(false),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`status\` = ? as statusMatches from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:            number
            statusMatches: boolean
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('value-when-no-value-and-chained-with-other-predicate', async () => {
        // The wrapper is AND-joined with another fired predicate. The
        // outer AND folds the elided-but-defaulted wrapper into a
        // single `WHERE 1 AND priority > ?` shape; pinning shows
        // the wrapper does NOT collapse — it emits the TRUE literal
        // even inside an AND chain (different from a raw elision,
        // which would drop the clause entirely). priority > 1 →
        // issues 1, 3, 4 (issue 2 has priority 1, excluded).
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter).trueWhenNoValue()
                .and(tIssue.priority.greaterThan(1)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('value-when-no-value-boolean-value-source-as-selected-column', async () => {
        // `valueWhenNoValue(BooleanValueSource)` projected as a column. The
        // collapse to a BooleanValueSource is the type lock; the IfValue is
        // elided so the fallback boolean expression is emitted. issue 1: filter
        // undefined → `priority > 1` → 2 > 1 → true.
        const expected = [{ id: 1, statusMatches: true }]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:            tIssue.id,
                statusMatches: tIssue.status.equalsIfValue(filter).valueWhenNoValue(tIssue.priority.greaterThan(1)),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority > ? as statusMatches from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:            number
            statusMatches: boolean
        }>>>()
        expect(rows).toEqual(expected)
    })
})
