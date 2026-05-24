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
import type { DynamicCondition } from '../../../../../src/dynamicCondition.js'
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
        const extension = {
            withinRange: ((_v: number) => 'not-a-value-source') as any,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { withinRange: (v: number) => any }>
        const filter: Filter = { id: { withinRange: 5 } as any }

        let thrown: any
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter) as any)
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        expect(String(thrown.message)).toContain('Expected a boolean value source')
        expect(thrown.extensionResult).toBe('not-a-value-source')
        expect(thrown.processedValue).toBe(5)
        expect(thrown.rule).toBe('withinRange')
        expect(thrown.path).toBe('id')
    })

    test('column-rule-extension-returning-non-boolean-value-source-throws-with-type-name', async () => {
        // Same shape as above, but the callback returns a REAL
        // ValueSource whose value type is `string`, not `boolean`.
        // L122-129 fires; the thrown error additionally carries
        // `returnedTypeName` (asserted via the message).
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            stringifyId: ((_v: number) => tIssue.title) as any,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { stringifyId: (v: number) => any }>
        const filter: Filter = { id: { stringifyId: 7 } as any }

        let thrown: any
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter) as any)
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        expect(String(thrown.message)).toContain('found a value source with type')
        expect(String(thrown.message)).toContain('string')
        expect(thrown.processedValue).toBe(7)
        expect(thrown.rule).toBe('stringifyId')
        expect(thrown.path).toBe('id')
    })
})
