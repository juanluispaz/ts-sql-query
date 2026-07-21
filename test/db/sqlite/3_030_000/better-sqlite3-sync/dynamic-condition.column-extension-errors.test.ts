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
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

// A publicly-typed boolean value source — the type an extension rule
// callback is contractually required to return.
type BoolRule<V> = (rule: V) => ReturnType<typeof tIssue.id.equals>

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
            withinRange: ((_v: number) => 'not-a-value-source') as unknown as BoolRule<number>,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { withinRange: BoolRule<number> }>
        const filter = { id: { withinRange: 5 } } as Filter

        let thrown: unknown
        try {
            sync(connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany())
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { extensionResult?: unknown; processedValue?: unknown; rule?: unknown; path?: unknown }
        expect(String(err.message)).toContain('Expected a boolean value source')
        expect(err.extensionResult).toBe('not-a-value-source')
        expect(err.processedValue).toBe(5)
        expect(err.rule).toBe('withinRange')
        expect(err.path).toBe('id')
        expect(thrown instanceof TsSqlError ? thrown.errorReason.reason : undefined).toBe('DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE')
    })

    test('column-rule-extension-returning-non-boolean-value-source-throws-with-type-name', async () => {
        // Same shape as above, but the callback returns a REAL
        // ValueSource whose value type is `string`, not `boolean`. The
        // second guard fires; the thrown error message names the returned
        // type.
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            stringifyId: ((_v: number) => tIssue.title) as unknown as BoolRule<number>,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { stringifyId: BoolRule<number> }>
        const filter = { id: { stringifyId: 7 } } as Filter

        let thrown: unknown
        try {
            sync(connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany())
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { processedValue?: unknown; rule?: unknown; path?: unknown }
        expect(String(err.message)).toContain('found a value source with type')
        expect(String(err.message)).toContain('string')
        expect(err.processedValue).toBe(7)
        expect(err.rule).toBe('stringifyId')
        expect(err.path).toBe('id')
    })

    test('column-rule-extension-nested-column-returning-non-value-source-throws-path-depth-2', async () => {
        // The per-column extension error carries the offending column's FULL dotted
        // path even one level down a nested projection. `withinRange` is a custom
        // rule registered under the `project` projection scope; it is seen when the
        // per-column path iterates filter rules for the nested `project.id` column.
        // The callback returns a plain string (not a ValueSource), so the first
        // guard fires and the thrown error reports `path = 'project.id'` (the nested
        // column, not the bare `id` or the enclosing `project` scope) and
        // `rule = 'withinRange'`.
        const connection = ctx.conn
        const project = tProject.forUseInLeftJoin()
        const selectFields = {
            id:      tIssue.id,
            project: { id: project.id, name: project.name },
        }
        const extension = {
            project: {
                withinRange: ((_v: number) => 'not-a-value-source') as unknown as BoolRule<number>,
            },
        }
        const filter = { project: { id: { withinRange: 5 } } } as DynamicCondition<{
            id: 'int', project: { id: 'int', name: 'string' },
        }>

        let thrown: unknown
        try {
            sync(connection.selectFrom(tIssue)
                .leftJoin(project).on(project.id.equals(tIssue.projectId))
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany())
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { extensionResult?: unknown; processedValue?: unknown; rule?: unknown; path?: unknown }
        expect(String(err.message)).toContain('Expected a boolean value source')
        expect(err.extensionResult).toBe('not-a-value-source')
        expect(err.processedValue).toBe(5)
        expect(err.rule).toBe('withinRange')
        expect(err.path).toBe('project.id')
        expect(thrown instanceof TsSqlError ? thrown.errorReason.reason : undefined).toBe('DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE')
        expect(thrown instanceof TsSqlError && 'path' in thrown.errorReason ? thrown.errorReason.path : undefined).toBe('project.id')
    })
})
