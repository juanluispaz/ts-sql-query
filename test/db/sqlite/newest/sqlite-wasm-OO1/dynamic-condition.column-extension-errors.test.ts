// `DynamicConditionBuilder.processColumnFilter` at
// [src/queryBuilders/DynamicConditionBuilder.ts:109-129](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L109-L129)
// has its own extension-callback path — separate from the top-level
// `processFilter` extension path covered by
// [`dynamic-condition.nested-extension.test.ts`](./dynamic-condition.nested-extension.test.ts).
// It fires when the user supplies an extension whose key matches a
// per-column RULE name (e.g. a custom operator override). The function
// receives the per-rule value and must return a boolean ValueSource;
// the two error paths short-circuit otherwise:
//
//   - L114-121: returns a non-ValueSource → throws with
//     `extensionResult`, `processedValue`, `path` and `rule` attached.
//   - L122-129: returns a real ValueSource whose value type is not
//     `boolean` → throws with `returnedTypeName` additionally.
//
// Both are reached by passing an extension keyed by a rule name and a
// filter shape that hands the rule to `processColumnFilter`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'

// A publicly-typed boolean value source — the type an extension rule
// callback is contractually required to return.
type BoolRule<V> = (rule: V) => ReturnType<typeof tIssue.id.equals>
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('column-rule-extension-returning-non-value-source-throws-with-rule-and-path', async () => {
        // Custom rule `withinRange` registered at the extension's
        // TOP level — `processColumnFilter` sees it as `extension[key]`
        // when iterating filter rules for the `id` column.
        // The callback returns a plain string (not a ValueSource), so
        // L114-121 fires. The thrown error carries `path = 'id'` and
        // `rule = 'withinRange'`.
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        // The callback body returns a plain string instead of a boolean
        // value source — the single runtime-guard cast that lets us reach
        // the asserted throw (the typer would otherwise reject the body).
        const extension = {
            withinRange: ((_v: number) => 'not-a-value-source') as unknown as BoolRule<number>,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { withinRange: BoolRule<number> }>
        const filter = { id: { withinRange: 5 } } as Filter

        let thrown: unknown
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { extensionResult?: unknown; processedValue?: unknown; rule?: unknown; path?: unknown }
        expect(String(err.message)).toContain('Expected a boolean value source')
        expect(err.extensionResult).toBe('not-a-value-source')
        expect(err.processedValue).toBe(5)
        expect(err.rule).toBe('withinRange')
        expect(err.path).toBe('id')
    })

    test('column-rule-extension-returning-non-boolean-value-source-throws-with-type-name', async () => {
        // Same shape as above, but the callback returns a REAL
        // ValueSource whose value type is `string`, not `boolean`.
        // L122-129 fires; the thrown error additionally carries
        // `returnedTypeName` (asserted via the message).
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        // The callback returns a string value source (`tIssue.title`),
        // not a boolean — the single runtime-guard cast reaching the
        // asserted throw.
        const extension = {
            stringifyId: ((_v: number) => tIssue.title) as unknown as BoolRule<number>,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { stringifyId: BoolRule<number> }>
        const filter = { id: { stringifyId: 7 } } as Filter

        let thrown: unknown
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { processedValue?: unknown; rule?: unknown; path?: unknown }
        expect(String(err.message)).toContain('found a value source with type')
        expect(String(err.message)).toContain('string')
        expect(err.processedValue).toBe(7)
        expect(err.rule).toBe('stringifyId')
        expect(err.path).toBe('id')
    })
})
