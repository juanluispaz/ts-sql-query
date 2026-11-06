// Documentation snippets for docs/api/error-management/overview.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:api-errors/catching-an-error', async () => {
        // The seed already has the issue 1 of the project 1: on a real database the unique constraint rejects the insert.
        ctx.mockNext(1)
        const connection = ctx.conn
        let rejectedByTheUniqueConstraint = false

        // doc-start
        try {
            await connection.insertInto(tIssue).set({ projectId: 1, number: 1, title: 'x', status: 'open', priority: 1 }).executeInsert()
        } catch (error) {
            if (error instanceof TsSqlQueryExecutionError
                && error.errorReason.reason === 'SQL_CONSTRAINT_VIOLATED'
                && error.errorReason.constraintType === 'unique') {
                rejectedByTheUniqueConstraint = true
            } else {
                throw error
            }
        }
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
        expect(rejectedByTheUniqueConstraint).toBe(ctx.realDbEnabled)
    })
})
