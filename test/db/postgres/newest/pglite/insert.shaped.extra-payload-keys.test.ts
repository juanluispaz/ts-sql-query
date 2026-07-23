// Shaped INSERT fed payload objects that are WIDER than the declared shape.
// `shapedAs({...})` declares which source-object keys map to which columns, and
// the documented contract is that only the values included in the shape are
// inserted — so a caller may hand a whole HTTP request body, extra keys and all,
// straight to the builder and the surplus properties are silently skipped rather
// than rejected.
//
// The extra property has to survive TypeScript's excess-property check, which
// fires only on FRESH object literals — hence every payload below is a named
// `const` whose inferred type carries the surplus key, exactly as a real
// caller's `const body = req.body` would.
//
// These are BLACK-BOX nets over shape-driven emission, not pins on any single
// guard: the builder composes the column list by walking the shape, so a key the
// shape does not declare has no way to reach the statement. That is worth
// holding down precisely because it is the property the documented contract
// rests on — an emission rewritten to walk the payload instead would break the
// promise, and these tests are what would notice.
//
// Dialect-independent: the emitted SQL is a plain INSERT under the real column
// names the shape maps back to.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-conditional-set-family-skips-payload-keys-outside-the-shape', async () => {
        // Every member of the single-row conditional-set family is handed a payload
        // carrying `notInShape`, a property the shape never declares. Each one drops
        // it and applies its declared key normally, so each conditional call
        // resolves to the renamed column below (`set` seeds six of them):
        //   set                    → the five required columns + the optional `summary`
        //   setIfValue             → state    (incoming has a value)
        //   setIfSet               → rank     (already staged)
        //   setIfSetIfValue        → rank     (staged AND incoming has a value)
        //   setIfNotSet            → assignee (never staged)
        //   setIfNotSetIfValue     → parent   (never staged AND incoming has a value)
        //   setIfHasValue          → summary  (currently holds a value)
        //   setIfHasValueIfValue   → summary  (holds a value AND incoming has one)
        //   setIfHasNoValue        → hours    (currently holds nothing)
        //   setIfHasNoValueIfValue → ref      (holds nothing AND incoming has a value)
        // `notInShape` never reaches the column list, so the emitted SQL names only
        // shape-mapped columns.
        const basePayload            = { project: 1, seq: 8801, heading: 'Base heading', state: 'open', rank: 1, summary: 'Base body', notInShape: 'csrf-token-from-the-request-body' }
        const ifValuePayload         = { state: 'triage', notInShape: 'ignored' }
        const ifSetPayload           = { rank: 2, notInShape: 'ignored' }
        const ifSetIfValuePayload    = { rank: 3, notInShape: 'ignored' }
        const ifNotSetPayload        = { assignee: 2, notInShape: 'ignored' }
        const ifNotSetIfValuePayload = { parent: 1, notInShape: 'ignored' }
        const ifHasValuePayload      = { summary: 'Body via setIfHasValue', notInShape: 'ignored' }
        const ifHasValueIfValueP     = { summary: 'Body via setIfHasValueIfValue', notInShape: 'ignored' }
        const ifHasNoValuePayload    = { hours: 4.5, notInShape: 'ignored' }
        const ifHasNoValueIfValueP   = { ref: '0a8f9c1e-8801-4222-8333-444455556666', notInShape: 'ignored' }

        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tIssue)
                .shapedAs({
                    project:  'projectId',
                    seq:      'number',
                    heading:  'title',
                    state:    'status',
                    rank:     'priority',
                    summary:  'body',
                    assignee: 'assigneeId',
                    parent:   'parentId',
                    hours:    'estimatedHours',
                    ref:      'externalRef',
                })
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
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body, assignee_id, parent_id, estimated_hours, external_ref) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                8801,
                "Base heading",
                "triage",
                3,
                "Body via setIfHasValueIfValue",
                2,
                1,
                4.5,
                "0a8f9c1e-8801-4222-8333-444455556666",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-multi-row-set-for-all-family-skips-payload-keys-outside-the-shape', async () => {
        // The multi-row twin family. Two places carry `notInShape` here: the ROW
        // objects passed to `values([r1, r2])`, and the payload of every
        // `setForAll*` call. Both surpluses are dropped, and each `setForAll*`
        // still applies its declared key to BOTH rows:
        //   setForAll                    → state    (unconditional)
        //   setForAllIfValue             → rank     (incoming has a value)
        //   setForAllIfSet               → summary  (staged in both rows)
        //   setForAllIfSetIfValue        → summary  (staged AND incoming has a value)
        //   setForAllIfNotSet            → assignee (staged in neither row)
        //   setForAllIfNotSetIfValue     → parent   (unstaged AND incoming has a value)
        //   setForAllIfHasValue          → heading  (both rows hold a value)
        //   setForAllIfHasValueIfValue   → heading  (holds a value AND incoming has one)
        //   setForAllIfHasNoValue        → hours    (neither row holds anything)
        //   setForAllIfHasNoValueIfValue → ref      (holds nothing AND incoming has a value)
        // `seq` is deliberately left untouched so the two rows stay distinct under
        // the (project_id, number) unique constraint.
        const rows = [
            { project: 1, seq: 8810, heading: 'Batch A', state: 'open', rank: 1, summary: 'Body A', notInShape: 'csrf-token-from-the-request-body' },
            { project: 1, seq: 8811, heading: 'Batch B', state: 'open', rank: 1, summary: 'Body B', notInShape: 'csrf-token-from-the-request-body' },
        ]
        const forAllPayload              = { state: 'triage', notInShape: 'ignored' }
        const forAllIfValuePayload       = { rank: 3, notInShape: 'ignored' }
        const forAllIfSetPayload         = { summary: 'Body via setForAllIfSet', notInShape: 'ignored' }
        const forAllIfSetIfValuePayload  = { summary: 'Body via setForAllIfSetIfValue', notInShape: 'ignored' }
        const forAllIfNotSetPayload      = { assignee: 2, notInShape: 'ignored' }
        const forAllIfNotSetIfValueP     = { parent: 1, notInShape: 'ignored' }
        const forAllIfHasValuePayload    = { heading: 'Heading via setForAllIfHasValue', notInShape: 'ignored' }
        const forAllIfHasValueIfValueP   = { heading: 'Heading via IfHasValueIfValue', notInShape: 'ignored' }
        const forAllIfHasNoValuePayload  = { hours: 4.5, notInShape: 'ignored' }
        const forAllIfHasNoValueIfValueP = { ref: '7b3e9d20-8810-4c55-9b66-dddd00009999', notInShape: 'ignored' }

        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tIssue)
                .shapedAs({
                    project:  'projectId',
                    seq:      'number',
                    heading:  'title',
                    state:    'status',
                    rank:     'priority',
                    summary:  'body',
                    assignee: 'assigneeId',
                    parent:   'parentId',
                    hours:    'estimatedHours',
                    ref:      'externalRef',
                })
                .values(rows)
                .setForAll(forAllPayload)
                .setForAllIfValue(forAllIfValuePayload)
                .setForAllIfSet(forAllIfSetPayload)
                .setForAllIfSetIfValue(forAllIfSetIfValuePayload)
                .setForAllIfNotSet(forAllIfNotSetPayload)
                .setForAllIfNotSetIfValue(forAllIfNotSetIfValueP)
                .setForAllIfHasValue(forAllIfHasValuePayload)
                .setForAllIfHasValueIfValue(forAllIfHasValueIfValueP)
                .setForAllIfHasNoValue(forAllIfHasNoValuePayload)
                .setForAllIfHasNoValueIfValue(forAllIfHasNoValueIfValueP)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body, assignee_id, parent_id, estimated_hours, external_ref) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10), ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                8810,
                "Heading via IfHasValueIfValue",
                "triage",
                3,
                "Body via setForAllIfSetIfValue",
                2,
                1,
                4.5,
                "7b3e9d20-8810-4c55-9b66-dddd00009999",
                1,
                8811,
                "Heading via IfHasValueIfValue",
                "triage",
                3,
                "Body via setForAllIfSetIfValue",
                2,
                1,
                4.5,
                "7b3e9d20-8810-4c55-9b66-dddd00009999",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })
})
