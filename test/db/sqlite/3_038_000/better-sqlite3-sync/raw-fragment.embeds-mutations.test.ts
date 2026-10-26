// DELETE and UPDATE builders interpolated into a `rawFragment` that sits in a
// `customizeQuery` slot of a host SELECT (`RawFragmentArg` accepts every
// executable mutation). Each embedded statement renders its own text into the
// host and pushes its bound values onto the HOST's params array, in
// interpolation order; a WITH view the embedded statements read is hoisted to
// the host's WITH clause exactly once.
//
// The embedded statements sit inside a `/* … */` comment, so their placeholders
// are invisible to the server's parser and the driver would bind more parameters
// than the parsed statement declares: the tests execute on the mock only.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('rawfragment-embeds-delete-and-update-after-select-keyword', async () => {
        // An audit tag naming the clean-up a report is about to run: purge the
        // closed issues (returning their ids) and move issue 2 (in progress)
        // back to open.
        // MOCK-ONLY: the embedded statements bind their placeholders inside an SQL
        // comment, invisible to the server, which then rejects the bind count.
        ctx.mockOnlyConnection()
        const expected = { id: 3 }
        ctx.mockNext(expected)
        const connection = ctx.conn

        const purgeClosed = connection.deleteFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .returning({ id: tIssue.id })

        const reopen = connection.update(tIssue)
            .set({ status: 'open' })
            .where(tIssue.id.equals(2))

        const row = await connection.selectFrom(tProject)
            .where(tProject.id.equals(3))
            .select({ id: tProject.id })
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* audit: ${purgeClosed} | ${reopen} */`,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /* audit: delete from issue where status = ? returning id as id | update issue set status = ? where id = ? */ id as id from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "closed",
            "open",
            2,
            3,
          ]
        `)
        assertType<Exact<typeof row, { id: number }>>()
        expect(row).toEqual(expected)
    })

    test('rawfragment-embeds-mutations-reading-a-cte-hoists-the-with-once', async () => {
        // DELETE, UPDATE and INSERT … SELECT all read the same `closed_issue` WITH
        // view. The host has no other reference to it: it discovers the view only
        // through the fragment, and declares it once in its own WITH clause.
        // MOCK-ONLY: the embedded statements bind their placeholders inside an SQL
        // comment, invisible to the server, which then rejects the bind count.
        ctx.mockOnlyConnection()
        const expected = { id: 3 }
        ctx.mockNext(expected)
        const connection = ctx.conn

        const closedIssue = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .select({
                id: tIssue.id,
                projectId: tIssue.projectId,
                number: tIssue.number,
                title: tIssue.title,
                priority: tIssue.priority,
            })
            .forUseInQueryAs('closed_issue')

        const purgeClosed = connection.deleteFrom(tIssue)
            .where(tIssue.id.in(connection.selectFrom(closedIssue).selectOneColumn(closedIssue.id)))

        const reopenClosed = connection.update(tIssue)
            .set({ status: 'open' })
            .where(tIssue.id.in(connection.selectFrom(closedIssue).selectOneColumn(closedIssue.id)))

        const copyClosed = connection.insertInto(tIssue)
            .from(connection.selectFrom(closedIssue).select({
                projectId: closedIssue.projectId,
                number: closedIssue.number.add(100),
                title: closedIssue.title,
                status: connection.const('open', 'string'),
                priority: closedIssue.priority,
            }))

        const row = await connection.selectFrom(tProject)
            .where(tProject.id.equals(3))
            .select({ id: tProject.id })
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* audit: ${purgeClosed} | ${reopenClosed} | ${copyClosed} */`,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with closed_issue as (select id as id, project_id as projectId, number as number, title as title, priority as priority from issue where status = ?) select /* audit: delete from issue where id in (select id as result from closed_issue) | update issue set status = ? where id in (select id as result from closed_issue) | insert into issue (project_id, number, title, status, priority) select projectId as projectId, number + ? as number, title as title, ? as status, priority as priority from closed_issue */ id as id from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "closed",
            "open",
            100,
            "open",
            3,
          ]
        `)
        assertType<Exact<typeof row, { id: number }>>()
        expect(row).toEqual(expected)
    })
})
