// MySQL below 8.0 (compatibilityVersion 5_007_000) has neither recursive CTEs
// nor the VALUES row source, and a non-recursive WITH is inlined as a derived
// table instead. A recursive select or a `Values` source therefore cannot be
// expressed at all: the library refuses to build the query with
// UNSUPPORTED_QUERY before anything reaches the server. The file name embeds
// `mysql`, which excludes it from the cross-dialect symmetry audit.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

class VIssuePriority extends Values<DBConnection, 'issuePriority'> {
    id       = this.column('int')
    priority = this.column('int')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('recursive select throws UNSUPPORTED_QUERY', async () => {
        // Walking the parent chain of issue 1 needs a recursive CTE.
        let caught: unknown
        try {
            await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, parentId: tIssue.parentId })
                .recursiveUnionAllOn((child) => tIssue.id.equals(child.parentId))
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('UNSUPPORTED_QUERY')
        expect(ctx.history).toEqual([])
    })

    test('select from values throws UNSUPPORTED_QUERY', async () => {
        // A client-side priority list joined as a `Values` row source.
        const priorities = Values.create(VIssuePriority, 'issuePriority', [
            { id: 1, priority: 5 },
            { id: 2, priority: 4 },
        ])
        let caught: unknown
        try {
            await ctx.conn.selectFrom(priorities)
                .select({ id: priorities.id, priority: priorities.priority })
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('UNSUPPORTED_QUERY')
        expect(ctx.history).toEqual([])
    })
})
