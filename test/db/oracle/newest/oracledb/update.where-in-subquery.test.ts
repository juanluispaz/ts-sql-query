// Coverage of `UPDATE ... WHERE col IN (select ...)`. The emitted form,
// including any dialect-specific identifier quoting, is pinned by the
// snapshot below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-where-in-subquery', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            // Close every issue belonging to an unpublished project.
            const unpublishedProjectIds = ctx.conn.selectFrom(tProject)
                .where(tProject.published.equals(false))
                .selectOneColumn(tProject.id)

            const affected = await ctx.conn.update(tIssue)
                .set({ status: 'closed' })
                .where(tIssue.projectId.in(unpublishedProjectIds))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = :0 where project_id in (select id as "result" from project where case when published = 't' then 1 else 0 end = :1)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
                0,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(2)
            else expect(typeof affected).toBe('number')
        })
    })

    test('update-where-then-or-extends-the-where-predicate', async () => {
        // The builder-level `.or(...)` chained after `.where(...)` extends
        // the UPDATE's WHERE clause itself — distinct from `a.or(b)` built
        // on a single value source before it reaches `.where(...)`. Bumps
        // the priority of every issue that is either closed or unassigned:
        // seed ids 3 (no assignee) and 4 (closed) → 2 rows, both changed.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ priority: 9 })
                .where(tIssue.status.equals('closed'))
                .or(tIssue.assigneeId.isNull())
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = :0 where status = :1 or assignee_id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9,
                "closed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('update-dynamic-where-then-or-builds-the-same-predicate', async () => {
        // Paired dynamic form: `.dynamicWhere()` opens an empty WHERE, so
        // the first `.or(...)` becomes the initial predicate (the
        // empty-WHERE branch) and the second `.or(...)` extends it (the
        // existing-WHERE branch). Emits SQL + params identical to the
        // static `.where(...).or(...)` above.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ priority: 9 })
                .dynamicWhere()
                .or(tIssue.status.equals('closed'))
                .or(tIssue.assigneeId.isNull())
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = :0 where status = :1 or assignee_id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9,
                "closed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('update-dynamic-where-then-and-builds-conjunction', async () => {
        // `.dynamicWhere()` opens an empty WHERE; the first `.and(...)`
        // becomes the initial predicate (the empty-WHERE branch) and the
        // second `.and(...)` conjoins to it. Closes issues in project 1
        // whose priority is above 1: seed id 1 (project 1, priority 2)
        // matches; id 2 (priority 1) is excluded → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ status: 'closed' })
                .dynamicWhere()
                .and(tIssue.projectId.equals(1))
                .and(tIssue.priority.greaterThan(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = :0 where project_id = :1 and priority > :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
                1,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

})
