// Shaped UPDATE fed payload objects that are WIDER than the declared shape.
// `shapedAs({...})` declares which source-object keys map to which columns, and
// properties outside the shape are silently skipped rather than rejected — so a
// caller can hand a whole HTTP request body straight to `dynamicSet()` and the
// setter family that follows.
//
// The extra property has to survive TypeScript's excess-property check, which
// fires only on FRESH object literals — hence every payload below is a named
// `const` whose inferred type carries the surplus key, exactly as a real
// caller's `const body = req.body` would.
//
// The first test is the discriminating one: with EVERY key outside the shape the
// set list ends up empty and the update resolves 0 without touching the
// database. The second is a black-box net over shape-driven emission — the
// builder composes the SET clause by walking the shape, so a surplus key has no
// route into the statement.
//
// Dialect-independent: the emitted SQL is a plain UPDATE under the real column
// names the shape maps back to.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-payload-of-only-out-of-shape-keys-updates-nothing', async () => {
        // The degenerate case, and the one that proves the skip is real: a payload
        // whose every key is outside the shape leaves the set list EMPTY, so the
        // update resolves 0 without dispatching a statement — so no non-transaction
        // SQL reaches the wire (lastNoTransactionSql stays empty); only the enclosing
        // transaction's own begin/rollback does. Were
        // the surplus key to survive, `update issue set  where id = $1` would reach
        // the engine instead.
        const body = { notInShape: 'csrf-token-from-the-request-body' }

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .shapedAs({ heading: 'title' })
                .dynamicSet()
                .set(body)
                .where(tIssue.id.equals(2))
                .executeUpdate()

            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })

    test('shaped-dynamic-set-conditional-family-skips-payload-keys-outside-the-shape', async () => {
        // `.shapedAs({...}).dynamicSet()` opens an empty shaped set, then every
        // member of the conditional-set family is handed a payload carrying
        // `notInShape`, a property the shape never declares. Each one drops it and
        // applies its declared key normally, so each conditional call resolves to
        // the renamed column below (`set` seeds four of them):
        //   set                    → heading, summary, state, rank
        //   setIfValue             → state    (incoming has a value)
        //   setIfSet               → rank     (already staged)
        //   setIfSetIfValue        → rank     (staged AND incoming has a value)
        //   setIfNotSet            → assignee (never staged)
        //   setIfNotSetIfValue     → parent   (never staged AND incoming has a value)
        //   setIfHasValue          → summary  (currently holds a value)
        //   setIfHasValueIfValue   → summary  (holds a value AND incoming has one)
        //   setIfHasNoValue        → hours    (currently holds nothing)
        //   setIfHasNoValueIfValue → ref      (holds nothing AND incoming has a value)
        // `notInShape` never reaches the SET clause, so the emitted SQL assigns only
        // shape-mapped columns. Issue 2 is the target, so `parent: 1` is a real
        // parent link and not a self-reference.
        const basePayload            = { heading: 'Base heading', summary: 'Base body', state: 'open', rank: 1, notInShape: 'csrf-token-from-the-request-body' }
        const ifValuePayload         = { state: 'triage', notInShape: 'ignored' }
        const ifSetPayload           = { rank: 2, notInShape: 'ignored' }
        const ifSetIfValuePayload    = { rank: 3, notInShape: 'ignored' }
        const ifNotSetPayload        = { assignee: 2, notInShape: 'ignored' }
        const ifNotSetIfValuePayload = { parent: 1, notInShape: 'ignored' }
        const ifHasValuePayload      = { summary: 'Body via setIfHasValue', notInShape: 'ignored' }
        const ifHasValueIfValueP     = { summary: 'Body via setIfHasValueIfValue', notInShape: 'ignored' }
        const ifHasNoValuePayload    = { hours: 4.5, notInShape: 'ignored' }
        const ifHasNoValueIfValueP   = { ref: '0a8f9c1e-2222-4222-8333-444455556666', notInShape: 'ignored' }

        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .shapedAs({
                    heading:  'title',
                    summary:  'body',
                    state:    'status',
                    rank:     'priority',
                    assignee: 'assigneeId',
                    parent:   'parentId',
                    hours:    'estimatedHours',
                    ref:      'externalRef',
                })
                .dynamicSet()
                .set(basePayload)
                .setIfValue(ifValuePayload)
                .setIfSet(ifSetPayload)
                .setIfSetIfValue(ifSetIfValuePayload)
                .setIfNotSet(ifNotSetPayload)
                .setIfNotSetIfValue(ifNotSetIfValuePayload)
                .setIfHasValue(ifHasValuePayload)
                .setIfHasValueIfValue(ifHasValueIfValueP)
                .setIfHasNoValue(ifHasNoValuePayload)
                .setIfHasNoValueIfValue(ifHasNoValueIfValueP)
                .where(tIssue.id.equals(2))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = @0, body = @1, status = @2, priority = @3, assignee_id = @4, parent_id = @5, estimated_hours = @6, external_ref = @7 where id = @8"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Base heading",
                "Body via setIfHasValueIfValue",
                "triage",
                3,
                2,
                1,
                4.5,
                "0a8f9c1e-2222-4222-8333-444455556666",
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
})
