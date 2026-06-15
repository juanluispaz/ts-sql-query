// Behavioral coverage of the NULL-safe equality operators `.is(...)` and
// `.isNot(...)`. They are part of the public surface but no other test
// exercises them. Each dialect renders them its own way, pinned per cell
// by the snapshot below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('is-with-null', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.is(null))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is not distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
    })

    test('is-with-value', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.is(2))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is not distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    test('is-not-with-null', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.isNot(null))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
    })

    test('is-not-with-value', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.isNot(2))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    test('is-with-column-comparison', async () => {
        // Comparing two columns of the same table; expresses NULL-safe
        // equality between parent_id and assignee_id.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.is(tIssue.parentId))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is not distinct from parent_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
