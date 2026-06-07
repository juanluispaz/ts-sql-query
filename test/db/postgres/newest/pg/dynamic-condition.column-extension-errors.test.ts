// The per-column extension-callback path of the dynamic-condition
// builder — separate from the top-level extension path covered by
// `dynamic-condition.nested-extension.test.ts`. It fires when the user
// supplies an extension whose key matches a per-column RULE name (e.g.
// a custom operator override). The callback receives the per-rule value
// and must return a boolean ValueSource; two runtime guards short-circuit
// otherwise:
//
//   - a non-ValueSource return → throws with `extensionResult`,
//     `processedValue`, `path` and `rule` attached.
//   - a real ValueSource whose value type is not `boolean` → throws and
//     additionally carries the returned type name in the message.
//
// Both are reached by passing an extension keyed by a rule name and a
// filter shape that hands the rule to the per-column path.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition } from '../../../../../src/dynamicCondition.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A boolean value source as produced by the public API — the type an
// extension rule callback is contractually required to return.
type BooleanResult = ReturnType<typeof tIssue.id.equals>

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('column-rule-extension-returning-non-value-source-throws-with-rule-and-path', async () => {
        // Custom rule `withinRange` registered at the extension's TOP
        // level — the per-column path sees it when iterating filter rules
        // for the `id` column. The callback returns a plain string (not a
        // ValueSource), so the first guard fires. The thrown error carries
        // `path = 'id'` and `rule = 'withinRange'`.
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            withinRange: (_v: number): BooleanResult => 'not-a-value-source' as any,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { withinRange: (v: number) => BooleanResult }>
        const filter: Filter = { id: { withinRange: 5 } as any }

        let thrown: unknown
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter) as any)
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { extensionResult: unknown, processedValue: unknown, rule: unknown, path: unknown }
        expect(String(err.message)).toContain('Expected a boolean value source')
        expect(err.extensionResult).toBe('not-a-value-source')
        expect(err.processedValue).toBe(5)
        expect(err.rule).toBe('withinRange')
        expect(err.path).toBe('id')
    })

    test('column-rule-extension-returning-non-boolean-value-source-throws-with-type-name', async () => {
        // Same shape as above, but the callback returns a REAL
        // ValueSource whose value type is `string`, not `boolean`. The
        // second guard fires; the thrown error message names the returned
        // type.
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            stringifyId: (_v: number): BooleanResult => tIssue.title as any,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { stringifyId: (v: number) => BooleanResult }>
        const filter: Filter = { id: { stringifyId: 7 } as any }

        let thrown: unknown
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter) as any)
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { processedValue: unknown, rule: unknown, path: unknown }
        expect(String(err.message)).toContain('found a value source with type')
        expect(String(err.message)).toContain('string')
        expect(err.processedValue).toBe(7)
        expect(err.rule).toBe('stringifyId')
        expect(err.path).toBe('id')
    })
})
