// Two paths into the INSERT emitter. Other insert.* files do call `query()` and
// `params()` on a built insert, but always once each and always in that order, so
// neither of the two behaviours below is exercised anywhere:
//
//   - The CACHE itself: `query()`'s second-call early return, and `params()`
//     building on demand when nothing has been built yet. Both matter because the
//     builder appends into ONE params array: a lost cache does not merely re-render
//     the SQL, it re-binds every value and renumbers every placeholder.
//   - The UNCACHED path taken when a BUILT insert is interpolated into a
//     `rawFragment`. It re-runs the same four-way dispatch (INSERT … SELECT /
//     multi-row / DEFAULT VALUES / plain) against the HOST statement's params
//     array instead of the builder's own.
//
// The rawFragment test builds without executing. The four embedded statements bind
// their own placeholders, and those placeholders sit inside the `/* … */` comment
// where the server's parser cannot see them — so the driver would supply more bind
// parameters than the parsed statement declares and the engine would reject it.
// Reading `query()` / `params()` captures the emission without dispatching
// anything, and does so identically in mock and real modes. Note that putting a
// fragment in a comment position is the exception here, not the default — a
// fragment meant to survive a real engine goes in an executable hook position
// instead.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue, tLedgerEntry, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('query-called-twice-returns-the-cached-sql-without-re-binding-params', () => {
        // `query()` memoises. The second call must hand back the identical string
        // AND leave `params()` untouched: the builder appends into one array that
        // is never cleared, so a lost cache would bind the five values a second
        // time and renumber the placeholders of the second rendering.
        const built = ctx.conn.insertInto(tIssue)
            .values({ projectId: 1, number: 9450, title: 'Cached', status: 'open', priority: 1 })

        const first = built.query()
        const second = built.query()
        expect(second).toBe(first)

        expect(first).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?)"`)
        expect(built.params()).toMatchInlineSnapshot(`
          [
            1,
            9450,
            "Cached",
            "open",
            1,
          ]
        `)
    })

    test('params-before-query-builds-on-demand', () => {
        // `params()` is legal as the FIRST call on a builder: with nothing built
        // yet it triggers the build itself rather than handing back the empty array
        // the builder starts life with. A later `query()` then finds the cache warm
        // and renders the statement those params belong to.
        const built = ctx.conn.insertInto(tIssue)
            .values({ projectId: 1, number: 9451, title: 'Params first', status: 'open', priority: 1 })

        const params = built.params()
        expect(params).toMatchInlineSnapshot(`
          [
            1,
            9451,
            "Params first",
            "open",
            1,
          ]
        `)

        expect(built.query()).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?)"`)
    })

    test('rawfragment-embeds-all-four-insert-forms', () => {
        // One fragment, four interpolated INSERT builders — one per arm of the
        // emitter's dispatch: INSERT … SELECT, multi-row, DEFAULT VALUES, and plain
        // single-row. Each renders its own statement text into the host SELECT's
        // comment and pushes its bound values onto the HOST's params array, in
        // interpolation order. The snapshot is what distinguishes the four: a
        // mis-dispatched arm would render a different statement shape — a `select`
        // where a `values` tuple belongs, or the reverse — and reorder the
        // collected params with it.
        const connection = ctx.conn

        const fromSelect = connection.insertInto(tIssue)
            .from(connection.selectFrom(tIssue)
                .where(tIssue.status.equals('open'))
                .select({
                    projectId: tIssue.projectId,
                    number: tIssue.number,
                    title: tIssue.title,
                    status: tIssue.status,
                    priority: tIssue.priority,
                }))

        const multiRow = connection.insertInto(tIssue)
            .values([
                { projectId: 1, number: 9440, title: 'Batch A', status: 'open', priority: 1 },
                { projectId: 1, number: 9441, title: 'Batch B', status: 'open', priority: 1 },
            ])

        const defaultValues = connection.insertInto(tLedgerEntry)
            .defaultValues()

        const plain = connection.insertInto(tIssue)
            .values({ projectId: 1, number: 9442, title: 'Single', status: 'open', priority: 1 })

        const built = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* audit: ${fromSelect} | ${multiRow} | ${defaultValues} | ${plain} */`,
            })

        expect(built.query()).toMatchInlineSnapshot(`"select /* audit: insert into issue (project_id, \`number\`, title, \`status\`, priority) select project_id as projectId, \`number\` as \`number\`, title as title, \`status\` as \`status\`, priority as priority from issue where \`status\` = ? | insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?), (?, ?, ?, ?, ?) | insert into ledger_entry () values () | insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?) */ id as id from project where id = ?"`)
        expect(built.params()).toMatchInlineSnapshot(`
          [
            "open",
            1,
            9440,
            "Batch A",
            "open",
            1,
            1,
            9441,
            "Batch B",
            "open",
            1,
            1,
            9442,
            "Single",
            "open",
            1,
            1,
          ]
        `)
    })
})
