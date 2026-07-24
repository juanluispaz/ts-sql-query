// Aggregation introspection over a built MUTATION: `queryHasAggregation(query)`
// answers "does this statement contain an aggregate anywhere?" without
// rendering SQL, by walking the same clauses the SQL builder renders. This is
// the INSERT / UPDATE / DELETE counterpart of the SELECT-side
// [`select.has-aggregation.test.ts`](./select.has-aggregation.test.ts).
//
// Each of the three statement kinds has its own walker, and each opens its
// value-source-bearing clauses in a fixed order, short-circuiting to `true` at
// the first one that aggregates:
//
//   - INSERT: the insert source of an `INSERT … SELECT`, the single-row set
//     values, the multiple-row set values, the RETURNING columns, the
//     `on conflict on constraint` target, the on-conflict target columns, the
//     on-conflict target `where`, the on-conflict DO UPDATE set values, the
//     on-conflict DO UPDATE `where`, then the `customizeQuery` fragments
//     `beforeQuery`, `afterInsertKeyword`, `afterQuery`;
//   - UPDATE: the set values, each join's `on`, `where`, the RETURNING columns,
//     then `beforeQuery`, `afterUpdateKeyword`, `afterQuery`;
//   - DELETE: each join's `on`, `where`, the RETURNING columns, then
//     `beforeQuery`, `afterDeleteKeyword`, `afterQuery`.
//
// Falsifiability is the organising principle, and it is enforced from BOTH
// sides. Every clause that can hold an aggregate gets a positive in which the
// aggregate sits in exactly THAT clause while every other populated clause is
// deliberately inert — so a walker that gave up after the first clause that
// came back negative would report `false`, and the `true` can only come from
// the clause under test. Every such clause also gets a negative in which the
// same clause is populated with something PLAIN — so a walker that reported
// `true` merely because a clause was present, or that mistook a plain column
// or a plain subquery for an aggregate, fails there. Dropping a clause's check
// flips its positive where one exists; hard-wiring a check to `true` flips
// every negative that populates that clause.
//
// Each walker's negatives are anchored by a portable control that populates the
// clauses every dialect supports — for INSERT the single-row set values plus
// the three fragments, for UPDATE the set value, a join's `on`, the `where` and
// the three fragments, for DELETE the `where` and the three fragments. The
// remaining negatives extend or vary that control, always staying
// aggregate-free: the three `*-returning-plain-columns` tests and
// `delete-join-on-with-plain-condition` add one clause to it,
// `insert-from-select-with-a-plain-projection` and
// `insert-multiple-rows-with-plain-values` swap its single-row set values for
// the sibling slot they cover, and the two on-conflict negatives are separate
// statements against the tables whose constraints they need (`project` for the
// column target, `app_user` for the named constraint). Keeping the controls
// clear of the narrower surfaces (`on conflict …` on INSERT, `using … join …`
// on DELETE) is deliberate: those clauses live in their own negative/positive
// pairs, so a dialect that cannot express them still keeps a working control.
//
// Reaching an aggregate from a mutation needs care, because an aggregate is
// only legal in a projection, in `having`, in the `order by` of a grouped query
// or inside a scalar subquery — never bare in a `set`, a `where`, a join `on`
// or an on-conflict clause. Two shapes carry it here:
//
//   - a scalar subquery promoted to a value with `forUseAsInlineQueryValue()`,
//     which the walker has to descend INTO to find the aggregate. `app_user`
//     holds three seeded users and `organization` two, so `count(...)` over
//     them is 3 and 2 respectively — values chosen so the statements stay valid
//     against the seed's foreign keys, and used in predicates whose outcome
//     really depends on them;
//   - for the `customizeQuery` fragment slots, that same scalar subquery
//     interpolated INSIDE a SQL comment. A bare `count(...)` is not assignable
//     to a fragment's source type, and text inside `/* … */` is inert on every
//     engine and contributes no bind parameter, so the emitted statement is
//     unchanged while the walker still sees the value source.
//
// Five of the walkers' checks get a negative but no positive: the INSERT
// on-conflict target columns, the INSERT on-conflict target `where`, and the
// RETURNING projection of each of the three statement kinds. Dropping any of
// those five checks therefore flips nothing here — the negatives lock only the
// other direction, that a populated clause is not mistaken for an aggregating
// one.
//
// The INSERT on-conflict TARGET columns and the on-conflict TARGET `where` both
// feed index inference — the target columns must name an indexed expression and
// the target `where` is an index predicate, which no engine lets a subquery
// into — so no aggregate could sit there in a statement that still runs. Both
// are populated, inert, by the on-conflict-target negative.
//
// The RETURNING projection of all three statement kinds is likewise covered by
// its negative half only: the walker is forced to open the projection, walk its
// leaves and come back empty. The positive half would need the aggregate inside
// a scalar subquery, since a bare aggregate is illegal in a RETURNING list
// everywhere, and whether each engine accepts a subquery there is not settled
// by anything this suite already records.
//
// Every mutation runs inside `ctx.withRollback(...)`, so the seed survives even
// though most of these statements really insert, update or delete a row.
//
// `queryHasAggregation` is the sanctioned introspection seam for the walkers,
// which have no public API yet; see test/LIMITATIONS.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { queryHasAggregation } from '../../../../lib/queryIntrospection.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ---------------------------------------------------------------------
    // INSERT
    // ---------------------------------------------------------------------

    test('has-aggregation/insert-no-aggregate-in-any-clause-reports-false', async () => {
        // The portable control for the INSERT walker: the single-row set values
        // and all three customization fragments populated, with nothing
        // aggregating anywhere. A walker that answered `true` for any insert —
        // or for any customised one, or that mistook a plain literal for an
        // aggregate — fails here and nowhere else. It is deliberately clear of
        // the `on conflict …` surface so it can run wherever an INSERT can.
        //
        // `issue` is unique on (project_id, number) and the seed gives project 1
        // the numbers 1 and 2, so number 940 does not collide and exactly one
        // row is inserted.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 940, title: 'Control row', status: 'open', priority: 3 })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                940,
                "Control row",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-from-select-with-a-plain-projection-reports-false', async () => {
        // The negative half of the insert-source pair: the row comes from an
        // `INSERT … SELECT` whose projection mixes literals with two PLAIN
        // COLUMNS of the source table. The walker has to descend into that
        // source and come back empty — a walker that reported `true` for any
        // insert fed by a select would fail here while its aggregating twin
        // still passed. The three fragments are populated and inert.
        //
        // The source is narrowed to project 1 ('Marketing site', organization
        // 1), so it yields exactly one row and the new issue takes that name as
        // its title and that organization id as its priority. Project 1 holds
        // numbers 1 and 2, so number 902 does not collide.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const source = connection.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    projectId: connection.const(1, 'int'),
                    number:    connection.const(902, 'int'),
                    title:     tProject.name,
                    status:    connection.const('open', 'string'),
                    priority:  tProject.organizationId,
                })

            const query = connection.insertInto(tIssue)
                .from(source)
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority) select ? as projectId, ? as number, name as title, ? as status, organization_id as priority from project where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                902,
                "open",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-from-select-with-an-aggregating-projection-reports-aggregation', async () => {
        // The insert source of an `INSERT … SELECT` is the FIRST clause the
        // walker opens, and the aggregate lives in that source's projection —
        // so the `true` can only come from the walker descending into the
        // source select. The three fragments are populated and inert, which is
        // what tells this apart from a walker that reported `true` for any
        // customised insert.
        //
        // Organization 1 owns projects 1 and 2, so the aggregate collapses
        // those two rows into one, `count(project.id)` is 2, and the single
        // synthesised row is issue (project 1, number 900, priority 2). Project
        // 1 holds numbers 1 and 2, so number 900 does not collide.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const source = connection.selectFrom(tProject)
                .where(tProject.organizationId.equals(1))
                .select({
                    projectId: connection.const(1, 'int'),
                    number:    connection.const(900, 'int'),
                    title:     connection.const('Rollup issue', 'string'),
                    status:    connection.const('open', 'string'),
                    priority:  connection.count(tProject.id),
                })

            const query = connection.insertInto(tIssue)
                .from(source)
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority) select ? as projectId, ? as number, ? as title, ? as status, count(id) as priority from project where organization_id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                900,
                "Rollup issue",
                "open",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-set-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The aggregate rides in ONE of the single-row set values, reached
        // through a scalar subquery — the only way an aggregate can appear in
        // a `values(...)` slot. Every other set value is a plain literal and
        // the three fragments are inert, so the `true` can only come from the
        // walker opening the set values and descending through the inline
        // subquery. The control above is the twin that keeps this honest: the
        // same clauses, all plain.
        //
        // The seed holds three users, so `count(app_user.id)` is 3 and the new
        // issue is assigned to user 3 — an id the seed really has, so the
        // foreign key holds. Project 1 holds numbers 1 and 2, so number 901
        // does not collide.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.insertInto(tIssue)
                .values({
                    projectId:  1,
                    number:     901,
                    title:      'Set from aggregate',
                    status:     'open',
                    priority:   3,
                    assigneeId: userCount,
                })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority, assignee_id) values (?, ?, ?, ?, ?, (select count(id) as result from app_user))  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                901,
                "Set from aggregate",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-multiple-rows-with-plain-values-reports-false', async () => {
        // The negative half of the multiple-row pair: the same two-row insert
        // as its twin below, with every value in both rows a plain literal. The
        // walker has to open the multiple-row slot, walk both rows and come
        // back empty — a walker that reported `true` for any multi-row insert
        // would fail here. The three fragments are populated and inert.
        //
        // Both rows land in project 1 with numbers 913 and 914, neither of
        // which collides with the seeded numbers 1 and 2, and they are assigned
        // to users 1 and 2, ids the seed really has. Two rows are inserted.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 913, title: 'Plain row A', status: 'open', priority: 3, assigneeId: 1 },
                    { projectId: 1, number: 914, title: 'Plain row B', status: 'open', priority: 3, assigneeId: 2 },
                ])
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority, assignee_id) values (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                913,
                "Plain row A",
                "open",
                3,
                1,
                1,
                914,
                "Plain row B",
                "open",
                3,
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('has-aggregation/insert-multiple-rows-with-an-aggregating-subquery-in-one-row-reports-aggregation', async () => {
        // The multiple-row set values are a SEPARATE walk from the single-row
        // ones, and only the SECOND row aggregates: the first row's values are
        // plain literals throughout. A walk that stopped after the first row —
        // or that only ever looked at the single-row slot — would report
        // `false` here while the single-row sibling still passed.
        //
        // Both rows land in project 1 with numbers 911 and 912, neither of
        // which collides with the seeded numbers 1 and 2, and the second row's
        // assignee is `count(app_user.id)` = 3, a user the seed really has. Two
        // rows are inserted.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 911, title: 'Multi row A', status: 'open', priority: 3, assigneeId: 1 },
                    { projectId: 1, number: 912, title: 'Multi row B', status: 'open', priority: 3, assigneeId: userCount },
                ])
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority, assignee_id) values (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, (select count(id) as result from app_user))  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                911,
                "Multi row A",
                "open",
                3,
                1,
                1,
                912,
                "Multi row B",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('has-aggregation/insert-returning-plain-columns-reports-false', async () => {
        // The portable control's statement plus a RETURNING projection of plain
        // columns. The walker now has to OPEN that projection — the clause the
        // control leaves absent — walk both of its leaves and come back empty,
        // so a walker that treated a RETURNING-bearing insert, or a projected
        // column, as evidence of aggregation would report `true` here while the
        // control still passed. The set values carry the same keys as the
        // control's — only the row's `number` and `title` differ — and the
        // three fragments are the control's verbatim.
        //
        // The projection reads back two columns the insert itself supplied, so
        // the row is deterministic without depending on the generated id.
        // Project 1 holds numbers 1 and 2, so number 921 does not collide.
        const expected = { title: 'Returning plain columns', status: 'open' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 921, title: 'Returning plain columns', status: 'open', priority: 3 })
                .returning({
                    title:  tIssue.title,
                    status: tIssue.status,
                })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const row = await query.executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?) returning title as title, status as status  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                921,
                "Returning plain columns",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof row, { title: string; status: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('has-aggregation/insert-on-conflict-target-with-no-aggregate-reports-false', async () => {
        // The on-conflict negative: four clauses the portable control cannot
        // reach — the conflict target columns, the conflict target `where`, the
        // DO UPDATE set values and the DO UPDATE `where` — populated at once
        // alongside the insert's own set values, and none of them aggregating.
        // It is what keeps the two DO UPDATE positives below honest, and what
        // covers the two target clauses that can never HAVE a positive: the
        // target columns must name an indexed expression and the target `where`
        // is an index predicate, neither of which admits a subquery. The three
        // fragments are populated and inert too.
        //
        // `project` is unique on (organization_id, slug), and the seed holds
        // project 1 = (organization 1, 'mktg-site', published, never archived),
        // so the insert collides, the target `where` and the DO UPDATE `where`
        // both hold, and exactly one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, name: 'Marketing site v2', slug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.published.equals(true))
                .doUpdateSet({ name: tProject.name.concat(' (v2)') })
                .where(tProject.archivedAt.isNull())
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) where (published = 't') = ? do update set name = project.name || ? where project.archived_at is null  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Marketing site v2",
                "mktg-site",
                1,
                " (v2)",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    // NOT-APPLICABLE: SQLite has no ON CONFLICT ON CONSTRAINT
    // test('has-aggregation/insert-on-conflict-on-constraint-with-a-plain-fragment-reports-false', async () => {
    //     // The negative half of the named-constraint pair: the constraint
    //     // fragment carries a scalar subquery too, but one that projects a plain
    //     // column instead of an aggregate. The walker has to descend through the
    //     // fragment INTO that subquery and come back empty — a walker that took
    //     // any value source reachable from a conflict target as an aggregate
    //     // would fail here while its twin still passed. The set values and the
    //     // three fragments are populated and inert.
    //     //
    //     // `app_user_email_key` is the unique constraint behind app_user's
    //     // `email` column. Re-inserting the seeded 'ada@acme.test' collides, DO
    //     // NOTHING suppresses the insert, and no row is written.
    //     ctx.mockNext(0)
    //     await ctx.withRollback(async () => {
    //         const connection = ctx.conn
    //
    //         const firstIssuePriority = connection.selectFrom(tIssue)
    //             .where(tIssue.id.equals(1))
    //             .selectOneColumn(tIssue.priority)
    //             .forUseAsInlineQueryValue()
    //
    //         const query = connection.insertInto(tAppUser)
    //             .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })
    //             .onConflictOnConstraint(connection.rawFragment`app_user_email_key /* priority=${firstIssuePriority} */`)
    //             .doNothing()
    //             .customizeQuery({
    //                 beforeQuery:        connection.rawFragment`/* head */ `,
    //                 afterInsertKeyword: connection.rawFragment`/* hint */`,
    //                 afterQuery:         connection.rawFragment` /* tail */`,
    //             })
    //
    //         expect(queryHasAggregation(query)).toBe(false)
    //
    //         const affected = await query.executeInsert()
    //
    //         expect(ctx.lastSql).toMatchInlineSnapshot()
    //         expect(ctx.lastParams).toMatchInlineSnapshot()
    //         assertType<Exact<typeof affected, number>>()
    //         expect(affected).toBe(0)
    //     })
    // })

    // NOT-APPLICABLE: SQLite has no ON CONFLICT ON CONSTRAINT
    // test('has-aggregation/insert-on-conflict-on-constraint-with-an-aggregating-fragment-reports-aggregation', async () => {
    //     // The named-constraint conflict target is a raw fragment, so it is the
    //     // one on-conflict TARGET slot an aggregate can reach: the subquery
    //     // rides inside a comment appended to the constraint name, leaving the
    //     // inferred constraint — and therefore the statement's meaning —
    //     // untouched. The set values and all three customization fragments are
    //     // populated and inert, so the `true` can only come from this slot.
    //     //
    //     // The subquery is never evaluated: it sits inside the comment, so the
    //     // baked statement carries its literal SQL text rather than any count,
    //     // and no bind parameter is added. Re-inserting the seeded
    //     // 'ada@acme.test' collides on `app_user_email_key`, DO NOTHING
    //     // suppresses the insert, and no row is written.
    //     ctx.mockNext(0)
    //     await ctx.withRollback(async () => {
    //         const connection = ctx.conn
    //
    //         const issueCount = connection.selectFrom(tIssue)
    //             .selectOneColumn(connection.count(tIssue.id))
    //             .forUseAsInlineQueryValue()
    //
    //         const query = connection.insertInto(tAppUser)
    //             .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })
    //             .onConflictOnConstraint(connection.rawFragment`app_user_email_key /* issues=${issueCount} */`)
    //             .doNothing()
    //             .customizeQuery({
    //                 beforeQuery:        connection.rawFragment`/* head */ `,
    //                 afterInsertKeyword: connection.rawFragment`/* hint */`,
    //                 afterQuery:         connection.rawFragment` /* tail */`,
    //             })
    //
    //         expect(queryHasAggregation(query)).toBe(true)
    //
    //         const affected = await query.executeInsert()
    //
    //         expect(ctx.lastSql).toMatchInlineSnapshot()
    //         expect(ctx.lastParams).toMatchInlineSnapshot()
    //         assertType<Exact<typeof affected, number>>()
    //         expect(affected).toBe(0)
    //     })
    // })

    test('has-aggregation/insert-on-conflict-do-update-set-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The DO UPDATE set values are their own walk, separate from the
        // insert's own set values: here the insert's values are plain literals,
        // the DO UPDATE `where` that follows is inert, and only the DO UPDATE
        // assignment aggregates through a scalar subquery. A walker that
        // conflated the two set-value loops, or that stopped at the insert's
        // own values, would report `false`.
        //
        // `issue` is unique on (project_id, number) and the seed holds issue 1
        // at (project 1, number 1), so the insert collides and the conflicting
        // row is reassigned to `count(app_user.id)` = 3 — a seeded user. Its
        // priority is 2, so the `> 0` guard holds and one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 1, title: 'Upsert hero copy', status: 'open', priority: 2 })
                .onConflictOn(tIssue.projectId, tIssue.number)
                .doUpdateSet({ assigneeId: userCount })
                .where(tIssue.priority.greaterThan(0))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?) on conflict (project_id, number) do update set assignee_id = (select count(id) as result from app_user) where issue.priority > ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                "Upsert hero copy",
                "open",
                2,
                0,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-on-conflict-do-update-where-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The DO UPDATE `where` is the last on-conflict slot the walker opens,
        // and the mirror of the sibling above: there the assignment aggregated
        // and this guard was inert, here the assignment is a plain literal and
        // the guard carries the scalar subquery. Dropping this slot's check
        // flips this test while its sibling stays green.
        //
        // The insert collides with seeded issue 1 at (project 1, number 1). Its
        // priority is 2 and `count(app_user.id)` is 3, so `2 <= 3` holds, the
        // DO UPDATE runs and one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 1, title: 'Upsert hero copy', status: 'open', priority: 2 })
                .onConflictOn(tIssue.projectId, tIssue.number)
                .doUpdateSet({ title: 'Upsert hero copy' })
                .where(tIssue.priority.lessOrEqual(userCount))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?) on conflict (project_id, number) do update set title = ? where issue.priority <= (select count(id) as result from app_user)  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                "Upsert hero copy",
                "open",
                2,
                "Upsert hero copy",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-before-query-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `beforeQuery` is the FIRST of the three insert fragment slots. It
        // carries the only aggregate — inside a comment, so the emitted
        // statement is unchanged — while the set values and the other two
        // fragments stay populated and inert, so the `true` can only come from
        // this slot's check.
        //
        // The row is a fresh issue in project 1 with number 931, which does not
        // collide with the seeded numbers 1 and 2, so one row is inserted.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 931, title: 'Head fragment', status: 'open', priority: 3 })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head users=${userCount} */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head users=(select count(id) as result from app_user) */  insert /* hint */ into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                931,
                "Head fragment",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-after-insert-keyword-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `afterInsertKeyword` is the MIDDLE fragment slot — the hint position
        // between the insert keyword and the target table. Its two neighbours
        // are populated and inert, which is what isolates a per-slot regression
        // instead of letting the other two mask it.
        //
        // Number 932 in project 1 does not collide with the seeded numbers 1
        // and 2, so one row is inserted; the annotation is a comment, so the
        // statement is unchanged.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 932, title: 'Hint fragment', status: 'open', priority: 3 })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint users=${userCount} */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint users=(select count(id) as result from app_user) */ into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                932,
                "Hint fragment",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-after-query-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `afterQuery` is the LAST slot the insert walker opens, and this is
        // the test that pins the traversal reaching it: every clause the walker
        // meets on the way — the set values and the two earlier fragments — is
        // populated and answers "no aggregate here", so a walker that gave up
        // at the first negative answer would report `false`.
        //
        // Number 933 in project 1 does not collide with the seeded numbers 1
        // and 2, so one row is inserted.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 933, title: 'Tail fragment', status: 'open', priority: 3 })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail users=${userCount} */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /* hint */ into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)  /* tail users=(select count(id) as result from app_user) */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                933,
                "Tail fragment",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    // ---------------------------------------------------------------------
    // UPDATE
    // ---------------------------------------------------------------------

    test('has-aggregation/update-no-aggregate-in-any-clause-reports-false', async () => {
        // The control for the UPDATE walker: the set value, a join's `on`, the
        // `where` and all three customization fragments populated at once, with
        // nothing aggregating anywhere. A walker that answered `true` for any
        // multi-table or customised update — or that mistook a plain column for
        // an aggregate — fails here and nowhere else.
        //
        // Issue 1 belongs to project 1 and is assigned to user 1 ('Ada
        // Lovelace'), so the join and the `where` both resolve and exactly one
        // project row is renamed.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /* hint */ project set name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/update-set-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The set values are the FIRST clause the update walker opens, and the
        // aggregate reaches the assignment through a scalar subquery — the only
        // way one can appear in a `set(...)`. The `where` and all three
        // fragments are populated and inert.
        //
        // The seed holds three users, so issue 1 is reassigned to user 3, an id
        // the seed really has, and exactly one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.update(tIssue)
                .set({ assigneeId: userCount })
                .where(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /* hint */ issue set assignee_id = (select count(id) as result from app_user) where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/update-join-on-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The join `on` of a multi-table update carries the only aggregate,
        // reached through a scalar subquery — a bare aggregate in an `on` is
        // rejected by every engine. The set value, the `where` and the three
        // fragments are populated and inert, so a walker that stopped at the
        // set values would report `false`. The control above is the twin that
        // keeps this honest: the same clauses, plain join condition.
        //
        // The seed holds two organizations, so the extra `on` term keeps
        // projects whose organization id is at most 2 — which is every seeded
        // project. Issue 1 belongs to project 1 and is assigned to user 1, so
        // exactly one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const organizationCount = connection.selectFrom(tOrganization)
                .selectOneColumn(connection.count(tOrganization.id))
                .forUseAsInlineQueryValue()

            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(
                    tAppUser.id.equals(tIssue.assigneeId)
                        .and(tProject.organizationId.lessOrEqual(organizationCount)),
                )
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /* hint */ project set name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id and project.organization_id <= (select count(id) as result from organization) where project.id = issue.project_id and issue.id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/update-where-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The `where` carries the only aggregate, again through a scalar
        // subquery. The set value is a plain literal and the three fragments
        // are inert, so a walker that stopped at the set values — the clause
        // immediately before this one — would report `false`.
        //
        // Issue 1 has priority 2 and the seed holds three users, so `2 <= 3`
        // keeps the row and exactly one is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.update(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.id.equals(1))
                    .and(tIssue.priority.lessOrEqual(userCount))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /* hint */ issue set status = ? where id = ? and priority <= (select count(id) as result from app_user)  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/update-returning-plain-columns-reports-false', async () => {
        // The update control's statement plus a RETURNING projection of plain
        // columns. The walker now has to OPEN that projection — the clause the
        // control leaves absent — walk both of its leaves and come back empty,
        // so a walker that treated a RETURNING-bearing update, or a projected
        // column, as evidence of aggregation would report `true` here while the
        // control still passed. The set value, the join `on`, the `where` and
        // all three fragments are the control's, unchanged and aggregate-free.
        //
        // Issue 1 belongs to project 1 and is assigned to user 1 ('Ada
        // Lovelace'), so that project is renamed to the assignee's full name
        // and RETURNING reads the updated row back.
        const expected = { id: 1, name: 'Ada Lovelace' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .returning({
                    id:   tProject.id,
                    name: tProject.name,
                })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const row = await query.executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /* hint */ project set name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = ? returning project.id as id, project.name as name  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('has-aggregation/update-before-query-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `beforeQuery` is the FIRST of the three update fragment slots and
        // carries the only aggregate, inside a comment so the emitted statement
        // is unchanged. The set value, the `where` and the other two fragments
        // are populated and inert.
        //
        // Issue 1 is archived, so exactly one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.update(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head users=${userCount} */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head users=(select count(id) as result from app_user) */  update /* hint */ issue set status = ? where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/update-after-update-keyword-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `afterUpdateKeyword` is the MIDDLE fragment slot — the hint position
        // right after the update keyword. Its two neighbours are populated and
        // inert, which is what makes a regression confined to this slot visible
        // here instead of masked by them.
        //
        // Issue 1 is archived, so exactly one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.update(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint users=${userCount} */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /* hint users=(select count(id) as result from app_user) */ issue set status = ? where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/update-after-query-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `afterQuery` is the LAST slot the update walker opens, and this is
        // the test that pins the traversal reaching it: the set value, the
        // `where` and the two earlier fragments are all populated and answer
        // "no aggregate here", so a walker that gave up at the first negative
        // answer would report `false`.
        //
        // Issue 1 is archived, so exactly one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.update(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail users=${userCount} */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /* hint */ issue set status = ? where id = ?  /* tail users=(select count(id) as result from app_user) */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    // ---------------------------------------------------------------------
    // DELETE
    // ---------------------------------------------------------------------

    test('has-aggregation/delete-no-aggregate-in-any-clause-reports-false', async () => {
        // The portable control for the DELETE walker: the `where` and all three
        // customization fragments populated, with nothing aggregating anywhere.
        // A walker that answered `true` for any delete, or that mistook a plain
        // column inside a fragment for an aggregate, fails here and nowhere
        // else. It is deliberately clear of `using … join …` so it can run
        // wherever a DELETE can.
        //
        // Issue 4 ('Document /v2/users', project 3) carries no worklog and no
        // webhook event, so the delete touches no dependent row and exactly one
        // row goes. The rollback puts it back.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterDeleteKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  delete /* hint */ from issue where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    // NOT-APPLICABLE: SQLite does not support DELETE … USING; the library type-excludes it for sqlite connections.
    // test('has-aggregation/delete-join-on-with-plain-condition-reports-false', async () => {
    //     // The control's statement widened into a multi-table delete whose join
    //     // `on` is a plain column-to-column condition. The walker now has to
    //     // OPEN the join conditions — the clause the control leaves absent — and
    //     // come back empty, so a walker that treated a joined delete as
    //     // aggregating would report `true` here while the control still passed.
    //     // The three fragments are the control's verbatim; its `where` gains the
    //     // term that ties the delete target to the USING table.
    //     //
    //     // Issue 4 belongs to project 3 ('Public API'), which belongs to
    //     // organization 2, so the join resolves and exactly one row goes.
    //     ctx.mockNext(1)
    //     await ctx.withRollback(async () => {
    //         const connection = ctx.conn
    //
    //         const query = connection.deleteFrom(tIssue)
    //             .using(tProject)
    //             .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
    //             .where(tIssue.projectId.equals(tProject.id))
    //                 .and(tIssue.id.equals(4))
    //             .customizeQuery({
    //                 beforeQuery:        connection.rawFragment`/* head */ `,
    //                 afterDeleteKeyword: connection.rawFragment`/* hint */`,
    //                 afterQuery:         connection.rawFragment` /* tail */`,
    //             })
    //
    //         expect(queryHasAggregation(query)).toBe(false)
    //
    //         const affected = await query.executeDelete()
    //
    //         expect(ctx.lastSql).toMatchInlineSnapshot()
    //         expect(ctx.lastParams).toMatchInlineSnapshot()
    //         assertType<Exact<typeof affected, number>>()
    //         expect(affected).toBe(1)
    //     })
    // })

    // NOT-APPLICABLE: SQLite does not support DELETE … USING; the library type-excludes it for sqlite connections.
    // test('has-aggregation/delete-join-on-with-an-aggregating-subquery-reports-aggregation', async () => {
    //     // The join `on` is the FIRST clause the delete walker opens, and it
    //     // carries the only aggregate, reached through a scalar subquery — a
    //     // bare aggregate in an `on` is rejected by every engine. The `where`
    //     // and the three fragments are populated and inert, and the sibling
    //     // above is the same statement with a plain `on`.
    //     //
    //     // Issue 4 belongs to project 3, which belongs to organization 2, and
    //     // the seed holds three users, so the extra `on` term (`2 < 3`) keeps
    //     // the joined row and exactly one issue goes. Had the aggregate come
    //     // back as 2 or less, nothing would have been removed.
    //     ctx.mockNext(1)
    //     await ctx.withRollback(async () => {
    //         const connection = ctx.conn
    //
    //         const userCount = connection.selectFrom(tAppUser)
    //             .selectOneColumn(connection.count(tAppUser.id))
    //             .forUseAsInlineQueryValue()
    //
    //         const query = connection.deleteFrom(tIssue)
    //             .using(tProject)
    //             .innerJoin(tOrganization).on(
    //                 tOrganization.id.equals(tProject.organizationId)
    //                     .and(tOrganization.id.lessThan(userCount)),
    //             )
    //             .where(tIssue.projectId.equals(tProject.id))
    //                 .and(tIssue.id.equals(4))
    //             .customizeQuery({
    //                 beforeQuery:        connection.rawFragment`/* head */ `,
    //                 afterDeleteKeyword: connection.rawFragment`/* hint */`,
    //                 afterQuery:         connection.rawFragment` /* tail */`,
    //             })
    //
    //         expect(queryHasAggregation(query)).toBe(true)
    //
    //         const affected = await query.executeDelete()
    //
    //         expect(ctx.lastSql).toMatchInlineSnapshot()
    //         expect(ctx.lastParams).toMatchInlineSnapshot()
    //         assertType<Exact<typeof affected, number>>()
    //         expect(affected).toBe(1)
    //     })
    // })

    test('has-aggregation/delete-where-with-an-aggregating-subquery-reports-aggregation', async () => {
        // The `where` carries the only aggregate, through a scalar subquery.
        // The three fragments are populated and inert, so the `true` can only
        // come from the walker opening the `where` and descending through the
        // inline subquery.
        //
        // Issue 4 has priority 2 and the seed holds three users, so `2 <= 3`
        // keeps the row and exactly one issue goes — the predicate really
        // decides the outcome, since a smaller count would have spared it.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                    .and(tIssue.priority.lessOrEqual(userCount))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterDeleteKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  delete /* hint */ from issue where id = ? and priority <= (select count(id) as result from app_user)  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/delete-returning-plain-columns-reports-false', async () => {
        // The control's statement plus a RETURNING projection of plain columns.
        // The walker now has to OPEN that projection — the clause the control
        // leaves absent — walk both of its leaves and come back empty, so a
        // walker that treated a RETURNING-bearing delete, or a projected
        // column, as evidence of aggregation would report `true` here while the
        // control still passed. The `where` and the three fragments are the
        // control's, unchanged.
        //
        // Issue 4 is removed and its own columns come back: id 4 and the seeded
        // title 'Document /v2/users'.
        const expected = { id: 4, title: 'Document /v2/users' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterDeleteKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(false)

            const row = await query.executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  delete /* hint */ from issue where id = ? returning id as id, title as title  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof row, { id: number; title: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('has-aggregation/delete-before-query-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `beforeQuery` is the FIRST of the three delete fragment slots and
        // carries the only aggregate, inside a comment so the emitted statement
        // is unchanged. The `where` and the other two fragments are populated
        // and inert.
        //
        // Issue 4 carries no worklog and no webhook event, so the delete
        // touches no dependent row and exactly one row goes.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head users=${userCount} */ `,
                    afterDeleteKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head users=(select count(id) as result from app_user) */  delete /* hint */ from issue where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/delete-after-delete-keyword-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `afterDeleteKeyword` is the MIDDLE fragment slot — the hint position
        // right after the delete keyword. Its two neighbours are populated and
        // inert, which is what makes a regression confined to this slot visible
        // here instead of masked by them.
        //
        // Issue 4 carries no worklog and no webhook event, so the delete
        // touches no dependent row and exactly one row goes.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterDeleteKeyword: connection.rawFragment`/* hint users=${userCount} */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  delete /* hint users=(select count(id) as result from app_user) */ from issue where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/delete-after-query-fragment-with-an-aggregating-subquery-reports-aggregation', async () => {
        // `afterQuery` is the LAST slot the delete walker opens, and this is
        // the test that pins the traversal reaching it: the `where` and the two
        // earlier fragments are all populated and answer "no aggregate here",
        // so a walker that gave up at the first negative answer would report
        // `false`.
        //
        // Issue 4 carries no worklog and no webhook event, so the delete
        // touches no dependent row and exactly one row goes.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const userCount = connection.selectFrom(tAppUser)
                .selectOneColumn(connection.count(tAppUser.id))
                .forUseAsInlineQueryValue()

            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterDeleteKeyword: connection.rawFragment`/* hint */`,
                    afterQuery:         connection.rawFragment` /* tail users=${userCount} */`,
                })

            expect(queryHasAggregation(query)).toBe(true)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  delete /* hint */ from issue where id = ?  /* tail users=(select count(id) as result from app_user) */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/insert-without-a-customization-reports-false', async () => {
        // The portable INSERT control with `customizeQuery(...)` omitted
        // entirely. Every other test in this file attaches all three fragment
        // hooks, so none of them exercises the walker against a statement that
        // carries no customization at all — the shape most real code has. The
        // walker must reach its final verdict without a customization block to
        // open. Project 1 holds issue numbers 1 and 2, so 941 is free.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.insertInto(tIssue)
                .values({ projectId: 1, number: 941, title: 'No customization', status: 'open', priority: 3 })

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                941,
                "No customization",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/update-without-a-customization-reports-false', async () => {
        // The UPDATE twin: the portable control's statement — set, from, join
        // `on` and where all populated and none aggregating — with no
        // customization block. Issue 1 belongs to project 1 and is assigned to
        // user 1 ('Ada Lovelace'), so exactly one project row is touched.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('has-aggregation/delete-without-a-customization-reports-false', async () => {
        // The DELETE twin. Issue 4 carries no worklog and no webhook event, so
        // the delete touches no dependent row, and the whole thing is rolled
        // back regardless.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))

            expect(queryHasAggregation(query)).toBe(false)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
})
