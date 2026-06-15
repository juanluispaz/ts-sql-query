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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id in (select id as "result" from project where name = :0)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id not in (select id as "result" from project)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where not exists(select id as "result" from project where id = issue.project_id)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where status = :0 or priority < :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                0,
              ]
            `)
        })
    })
})
