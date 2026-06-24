// Coverage of UPDATE's "has value" / "if value" / "when" setter
// families that the docs page leaves unexercised:
//
//   - `setIfHasValue(...)` / `setIfHasNoValue(...)` — branch on whether
//     the currently staged value passes the value gate (non-null,
//     non-empty string/array, defined).
//   - `setIfSetIfValue` / `setIfNotSetIfValue` /
//     `setIfHasValueIfValue` / `setIfHasNoValueIfValue` — compose the
//     previous gate with the incoming-value gate.
//   - `ignoreIfHasValue(...)` / `ignoreIfHasNoValue(...)` — delete
//     conditionally.
//   - `disallowIfValue(...)` / `disallowIfNoValue(...)` — guard rules
//     that throw BEFORE the SQL ever runs.
//   - `*When(when, ...)` — every setter has a `When` flavour that
//     no-ops when `when === false`.
//
// All cases are mock-only: the conditional logic resolves entirely in
// the query builder, so the emitted SQL is exactly the SQL that would
// run if the same sets were built by hand. No `withRollback` is needed.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('set-if-has-value-updates-when-current-has-value', async () => {
        // Staged `title` has a value, so `setIfHasValue` overwrites it.
        // Staged `body` is null, so `setIfHasValue({ body: 'X' })` is a
        // no-op (the `body` column never reaches the SET clause).
        ctx.mockNext(1)
        const affected = await ctx.conn.update(tIssue)
            .set({ title: 'Triage', body: null })
            .setIfHasValue({ title: 'Triaged', body: 'should-be-ignored' })
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, body = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Triaged",
            null,
            1,
          ]
        `)
        assertType<Exact<typeof affected, number>>()
        expect(affected).toBe(1)
    })

    test('set-if-has-no-value-fills-only-empty-slots', async () => {
        // Mirror of the above: `setIfHasNoValue` only assigns columns
        // whose staged value fails the value gate (here `body: null`). The
        // already-valued `title` is left as-is.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ title: 'Triage', body: null })
            .setIfHasNoValue({ title: 'override-ignored', body: 'Backfilled' })
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, body = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Triage",
            "Backfilled",
            1,
          ]
        `)
    })

    test('set-if-set-if-value-requires-both-gates', async () => {
        // `setIfSetIfValue` writes only when (a) the column was already
        // set AND (b) the incoming value passes the value gate. With
        // `priority` already set and `title` not, only the priority
        // update lands; the null skip on priority is also a no-op.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ priority: 2 })
            .setIfSetIfValue({ priority: 5, title: 'never-set' })
            .setIfSetIfValue({ priority: null })
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            1,
          ]
        `)
    })

    test('set-if-not-set-if-value-skips-empty-and-already-set', async () => {
        // `setIfNotSetIfValue` writes only when the column was NOT set
        // before AND the incoming value passes the value gate. `status` is
        // already set so the override is dropped; `body: ''` fails the
        // value gate; `title` is new and non-empty so it sticks.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ status: 'open' })
            .setIfNotSetIfValue({ status: 'closed', body: '', title: 'New title' })
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ?, title = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "New title",
            1,
          ]
        `)
    })

    test('set-if-has-value-if-value-requires-both-current-and-incoming', async () => {
        // `setIfHasValueIfValue` updates only when BOTH the staged value
        // and the incoming value pass the value gate. Staged `body` is
        // null → skipped despite a valid new value; staged `title` is set
        // and the incoming title is valid → updated. Undefined incoming is
        // rejected for `priority`.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ title: 'Triage', body: null, assigneeId: 2 })
            .setIfHasValueIfValue({ title: 'Triaged', body: 'will-skip', assigneeId: undefined })
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, body = ?, assignee_id = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Triaged",
            null,
            2,
            1,
          ]
        `)
    })

    test('set-if-has-no-value-if-value-fills-only-empty-with-real-value', async () => {
        // Mirror of the above: only writes when the staged value fails the
        // gate AND the incoming value passes it. Empty incoming string for
        // `body` is rejected; non-empty `title` fills the empty-staged slot.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ body: null, assigneeId: null })
            .setIfHasNoValueIfValue({ body: 'Filled', assigneeId: undefined })
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set body = ?, assignee_id = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Filled",
            null,
            1,
          ]
        `)
    })

    test('ignore-if-has-value-drops-only-populated-sets', async () => {
        // `ignoreIfHasValue(col, ...)` deletes a previously-set column
        // only if its staged value passes the value gate. `body: null`
        // survives the sweep because it doesn't have a value.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ title: 'Triage', body: null, priority: 9 })
            .ignoreIfHasValue('title', 'body', 'priority')
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set body = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            1,
          ]
        `)
    })

    test('ignore-if-has-no-value-drops-only-empty-sets', async () => {
        // Mirror of the above: `ignoreIfHasNoValue` deletes only when
        // the staged value fails the value gate. `title` survives.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ title: 'Triage', body: null, priority: 9 })
            .ignoreIfHasNoValue('title', 'body', 'priority')
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Triage",
            9,
            1,
          ]
        `)
    })

    test('disallow-if-value-throws-when-set-has-value', () => {
        // `disallowIfValue(msg, ...cols)` throws synchronously if any
        // listed column's staged value passes the value gate. The error
        // shape carries `reason: 'DISALLOWED_BY_QUERY_RULE'` and the
        // offending property name.
        expect(() => {
            ctx.conn.update(tIssue)
                .set({ status: 'closed' })
                .disallowIfValue('status must stay null until workflow runs', 'status')
                .where(tIssue.id.equals(1))
        }).toThrow(/status must stay null until workflow runs/)
    })

    test('disallow-if-no-value-throws-when-set-is-empty', () => {
        // Mirror: `disallowIfNoValue(msg, ...cols)` throws when the
        // staged value fails the value gate (here `body: null`).
        expect(() => {
            ctx.conn.update(tIssue)
                .set({ body: null })
                .disallowIfNoValue('body cannot be cleared via this path', 'body')
                .where(tIssue.id.equals(1))
        }).toThrow(/body cannot be cleared via this path/)
    })

    test('set-when-false-is-noop-and-when-true-delegates', async () => {
        // The `*When(when, ...)` family is a single wrapper that
        // delegates to the non-When version only if `when === true`.
        // Both branches of the wrapper are exercised here.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ title: 'Base' })
            .setWhen(false, { title: 'NEVER' })
            .setWhen(true, { priority: 7 })
            .setIfValueWhen(false, { body: 'NEVER' })
            .setIfValueWhen(true, { body: 'When-true body' })
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ?, body = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Base",
            7,
            "When-true body",
            1,
          ]
        `)
    })

    test('ignore-if-set-when-and-ignore-if-has-value-when-toggle-cleanly', async () => {
        // Two `*When` flavours of the ignore family: the false branch
        // leaves staged columns intact, the true branch drops them.
        // `ignoreIfHasNoValueWhen(true, 'body')` drops the null-valued
        // `body` from the SET clause; `ignoreIfHasValueWhen(false, ...)`
        // is a no-op so `title` survives.
        ctx.mockNext(1)
        await ctx.conn.update(tIssue)
            .set({ title: 'Triage', body: null, priority: 9 })
            .ignoreIfSetWhen(false, 'title')
            .ignoreIfSetWhen(true,  'priority')
            .ignoreIfHasValueWhen(false, 'title')
            .ignoreIfHasNoValueWhen(true, 'body')
            .where(tIssue.id.equals(1))
            .executeUpdate()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Triage",
            1,
          ]
        `)
    })

    test('disallow-when-false-skips-the-throw', () => {
        // `disallow*When(false, ...)` must skip the throw entirely;
        // there is no exception even though the column is set.
        expect(() => {
            ctx.conn.update(tIssue)
                .set({ status: 'closed' })
                .disallowIfSetWhen(false, 'gated off', 'status')
                .disallowIfValueWhen(false, 'gated off', 'status')
                .where(tIssue.id.equals(1))
        }).not.toThrow()
    })

    test('disallow-guards-allow-the-update-when-no-rule-is-violated', async () => {
        // The mirror of the throwing tests above: each `disallow*` guard
        // returns the builder unchanged (no throw) when its condition is
        // not met, so a valid UPDATE proceeds. Only `title` is staged, so
        // `disallowIfNotSet`/`disallowIfNoValue` pass (title is set with a
        // value), `disallowIfSet`/`disallowIfValue` pass (the columns they
        // guard are absent), and `disallowAnyOtherSet` passes (title is the
        // sole staged column). The guards leave no trace in the emitted SQL.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ title: 'Renamed issue' })
                .disallowIfValue('status must stay unset', 'status')
                .disallowIfNoValue('title is required', 'title')
                .disallowIfSet('body cannot change here', 'body')
                .disallowIfNotSet('title is required', 'title')
                .disallowAnyOtherSet('only title may change', 'title')
                .where(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed issue",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

})
