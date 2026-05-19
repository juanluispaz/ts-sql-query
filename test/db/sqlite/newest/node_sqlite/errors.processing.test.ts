// Behavioral coverage of the user-facing TsSqlProcessingError reasons
// that the SQL builders surface from public API misuse. The existing
// suite has plenty of `toThrow` calls but none assert the `reason:`
// code, so the per-reason branches in src/sqlBuilders/ remain unverified.
//
// Several of these reasons live behind a type-level guard that mirrors
// the runtime guard (e.g. `.executeDelete()` is not on
// `DeleteExpression` until you've added `.where(...)`). The runtime
// throw is exactly what we want to test, so each construction casts
// through `any` to bypass the static guard and reach the dynamic one.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete without where throws MISSING_WHERE', () => {
        let caught: unknown
        try {
            (ctx.conn.deleteFrom(tIssue) as any).executeDelete()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('MISSING_WHERE')
    })

    test('update without where throws MISSING_WHERE', () => {
        let caught: unknown
        try {
            (ctx.conn.update(tIssue).set({ title: 'x' }) as any).executeUpdate()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('MISSING_WHERE')
    })

    test('orderBy with bogus ordering throws INVALID_ORDER_BY_ORDERING', async () => {
        ctx.mockNext([])
        let caught: unknown
        try {
            await ctx.conn.selectFrom(tProject)
                .select({ id: tProject.id })
                // The OrderByMode union excludes 'bananas', cast to bypass
                // the static check and reach the runtime guard.
                .orderBy('id', 'bananas' as any)
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_ORDER_BY_ORDERING')
    })

    test('orderBy by alias not in select throws ORDER_BY_COLUMN_NOT_IN_SELECT', async () => {
        ctx.mockNext([])
        let caught: unknown
        try {
            await (ctx.conn.selectFrom(tProject)
                .select({ id: tProject.id }) as any)
                .orderBy('notSelected')
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('ORDER_BY_COLUMN_NOT_IN_SELECT')
    })
})
