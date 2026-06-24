// Coverage of DELETE with a subquery in the WHERE clause — the most
// portable cross-dialect way to delete rows that match a derived set
// (works on every supported backend because it's pure standard SQL).
//
//   - `.deleteFrom(t).where(t.id.in(connection.selectFrom(...))...)`
//   - `.deleteFrom(t).where(connection.subSelectUsing(t)...exists())`
//
// All cases are mock-only by default but execute against the real
// DB when `--docker` is on. Mutations are wrapped in `withRollback`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-where-id-in-subquery', async () => {
        // Standard idiom: delete every issue whose `project_id`
        // matches a derived set of project ids. The `connection.selectFrom`
        // is rendered inline as `IN (select ...)`.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const affected = await connection.deleteFrom(tIssue)
                .where(tIssue.projectId.in(
                    connection.selectFrom(tProject)
                        .where(tProject.name.equals('does-not-exist'))
                        .selectOneColumn(tProject.id),
                ))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id in (select id as [result] from project where name = @0)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "does-not-exist",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('delete-where-id-not-in-subquery', async () => {
        // Negation of the same shape — `NOT IN (select ...)`. The
        // separation matters because the SqlBuilder routes `_in` and
        // `_notIn` through distinct codepaths.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            await connection.deleteFrom(tIssue)
                .where(tIssue.projectId.notIn(
                    connection.selectFrom(tProject)
                        .selectOneColumn(tProject.id),
                ))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id not in (select id as [result] from project)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        })
    })

    test('delete-where-not-exists-correlated-subquery', async () => {
        // Correlated `NOT EXISTS (select 1 from project where ...)`
        // built with `subSelectUsing(tIssue)` so the outer-row
        // reference (`tIssue.projectId`) is visible to the subquery.
        // Per docs, `subSelectUsing` is the documented pattern for
        // correlated subqueries in this library.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            await connection.deleteFrom(tIssue)
                .where(connection.notExists(
                    connection.subSelectUsing(tIssue)
                        .from(tProject)
                        .where(tProject.id.equals(tIssue.projectId))
                        .selectOneColumn(tProject.id),
                ))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where not exists(select id as [result] from project where id = issue.project_id)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        })
    })

    test('delete-with-or-joined-conditions', async () => {
        // Two predicates joined with OR — the SqlBuilder needs to
        // parenthesize around the OR so the surrounding `WHERE` glue
        // doesn't change precedence.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            await connection.deleteFrom(tIssue)
                .where(tIssue.status.equals('archived').or(tIssue.priority.lessThan(0)))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where status = @0 or priority < @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                0,
              ]
            `)
        })
    })

    test('delete-where-then-or-extends-the-where-predicate', async () => {
        // The builder-level `.or(...)` chained after `.where(...)` extends
        // the DELETE's WHERE clause itself — distinct from the
        // `a.or(b)`-on-a-single-value-source form above, which builds one
        // compound predicate before `.where(...)`. Deletes every issue that
        // is either closed or unassigned: seed ids 3 (no assignee) and 4
        // (closed) → 2 rows.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.status.equals('closed'))
                .or(tIssue.assigneeId.isNull())
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where status = @0 or assignee_id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('delete-dynamic-where-then-or-builds-the-same-predicate', async () => {
        // Paired dynamic form: `.dynamicWhere()` opens an empty WHERE, so
        // the first `.or(...)` becomes the initial predicate (the
        // empty-WHERE branch) and the second `.or(...)` extends it (the
        // existing-WHERE branch). Emits SQL + params identical to the
        // static `.where(...).or(...)` above.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .dynamicWhere()
                .or(tIssue.status.equals('closed'))
                .or(tIssue.assigneeId.isNull())
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where status = @0 or assignee_id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('delete-dynamic-where-then-and-builds-conjunction', async () => {
        // `.dynamicWhere()` opens an empty WHERE; the first `.and(...)`
        // becomes the initial predicate (the empty-WHERE branch) and the
        // second `.and(...)` conjoins to it. Deletes issues in project 1
        // whose priority is above 1: seed id 1 (project 1, priority 2)
        // matches; id 2 (priority 1) is excluded → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .dynamicWhere()
                .and(tIssue.projectId.equals(1))
                .and(tIssue.priority.greaterThan(1))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = @0 and priority > @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

})
