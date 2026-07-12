// Behavioral coverage of `_appendCustomBooleanRemapForColumnIfRequired`
// for the column-to-column case: comparing two `CustomBooleanTypeAdapter`
// columns whose true/false values agree (no remap needed) and whose
// values disagree (remap with case). The existing
// `docs.advanced.custom-booleans-values.test.ts` covers only the
// column-vs-literal path, so the column-vs-column branches are otherwise
// unreached.
//
// The seed schema includes two custom-boolean columns that share a
// mapping (`organization.verified` and `app_user.verified`, both Y/N)
// and one with a deliberately different mapping (`project.published`,
// stored as t/f). This file exercises the comparisons across that pair.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssueWorklog, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where: custom boolean column equals column with same adapter', async () => {
        // organization.verified and app_user.verified both store Y/N.
        // The right-hand side needs no case-based remap; the SQL builder
        // emits the raw column name.
        //
        // Acme Corp (id=1) has verified=Y; the verified users are Ada
        // (id=1, Y) and Grace (id=2, Y), so the join yields two rows.
        const expected = [{ orgId: 1, userId: 1 }, { orgId: 1, userId: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tAppUser).on(tAppUser.verified.equals(tOrganization.verified))
            .where(tOrganization.id.equals(1))
            .select({
                orgId:  tOrganization.id,
                userId: tAppUser.id,
            })
            .orderBy('userId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, app_user.id as userId from organization inner join app_user on app_user.verified = organization.verified where organization.id = ? order by userId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('where: custom boolean column equals column with different adapter', async () => {
        // organization.verified is Y/N; project.published is t/f.
        // The SQL builder must remap the right-hand side with a case
        // expression so the comparison reads `<org.verified-mapped-bool>
        // = <project.published-mapped-bool>`.
        //
        // Matches per the seed: Acme (Y/true) + Marketing (t/true) →
        // projectId 1; Globex (N/false) + Legacy (f/false) → projectId 4.
        const expected = [
            { orgId: 1, projectId: 1 },
            { orgId: 2, projectId: 4 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .where(tOrganization.verified.equals(tProject.published))
            .select({
                orgId:     tOrganization.id,
                projectId: tProject.id,
            })
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, project.id as projectId from organization inner join project on project.organization_id = organization.id where (organization.verified = 'Y') = (project.published = 't') order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('where: custom boolean column equals a boolean value source', async () => {
        // RHS is a derived BooleanValueSource (id > 0), not a column.
        // The builder hits the `isValueSource(value)` branch and emits a
        // case expression matching the adapter-stored values.
        //
        // (id > 0) is true for every row, so the predicate reduces to
        // verified=true; only Acme (id=1) qualifies.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.equals(tOrganization.id.greaterThan(0)))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') = (id > ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('update set: custom boolean column from a boolean expression', async () => {
        // The SET path (`_appendValueForColumn` →
        // `_appendCustomBooleanRemapForColumnIfRequired`, the
        // `isValueSource` branch — the
        // existing tests only reach the remap from a WHERE comparison.
        // `project.published` stores t/f; setting it from a boolean
        // expression (`id > 0`) must wrap the expression in a case that
        // produces the adapter-stored literal.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .set({ published: tProject.id.greaterThan(0) })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set published = case when id > ? then 't' else 'f' end where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
                1,
              ]
            `)
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('update from: custom boolean column from a different-adapter column', async () => {
        // The column-to-column SET remap (the isColumn branch of
        // `update ... from`) makes another table's column available in
        // `set(...)`. Setting
        // `project.published` (t/f) from `organization.verified` (Y/N)
        // forces the case-based remap on the assigned value.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ published: tOrganization.verified })
                .where(tProject.organizationId.equals(tOrganization.id))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set published = case when organization.verified = 'Y' then 't' else 'f' end from organization where project.organization_id = organization.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            if (!ctx.realDbEnabled) expect(affected).toBe(2)
        })
    })

    test('insert set: custom boolean column from a boolean expression', async () => {
        // Same `_appendValueForColumn` remap, reached through the INSERT
        // builder rather than UPDATE. A new project sets `published`
        // (t/f) from a boolean expression.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .set({
                    organizationId: 1,
                    name:           'Remap insert',
                    slug:           'remap-insert',
                    published:      ctx.conn.const(1, 'int').greaterThan(0),
                })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, published) values (?, ?, ?, case when ? > ? then 't' else 'f' end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Remap insert",
                "remap-insert",
                1,
                0,
              ]
            `)
            if (!ctx.realDbEnabled) expect(inserted).toBe(1)
        })
    })

    test('insert custom boolean then read it back round-trips to true', async () => {
        // A CustomBooleanTypeAdapter value threaded write -> read end to end:
        // inserting verified=true writes the adapter's 'Y' literal (the write
        // remap), then re-selecting the column reads `(verified = 'Y')` back as
        // a boolean (the read remap), round-tripping to `true`.
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Initech', plan: 'pro', verified: true })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan", verified) values (?, ?, case when ? then 'Y' else 'N' end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "pro",
                true,
              ]
            `)
            expect(typeof inserted).toBe('number')

            ctx.mockNext({ verified: true })
            const row = await ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.name.equals('Initech'))
                .select({ verified: tOrganization.verified })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select (verified = 'Y') as verified from organization where name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
              ]
            `)
            expect(row.verified).toBe(true)
        })
    })

    test('numeric custom boolean adapter reads as (col = trueValue)', async () => {
        // The numeric CustomBooleanTypeAdapter overload (1/0 on `invoiced`) reads
        // as `(invoiced = 1)` — the integer-literal shape, distinct from the
        // string overload's `(verified = 'Y')`. invoiced {1,0,1} -> isInvoiced
        // {true,false,true}.
        const expected = [
            { id: 1, isInvoiced: true }, { id: 2, isInvoiced: false }, { id: 3, isInvoiced: true },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({ id: tIssueWorklog.id, isInvoiced: tIssueWorklog.invoiced })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (invoiced = 1) as isInvoiced from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('numeric custom boolean adapter writes as case-when-then-trueValue', async () => {
        // The write remap of the numeric overload: setting the boolean column
        // from a boolean expression emits `case when ... then 1 else 0` (integer
        // literals) rather than the string overload's `then 'Y' else 'N'`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssueWorklog)
                .set({ invoiced: tIssueWorklog.id.greaterThan(0) })
                .where(tIssueWorklog.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set invoiced = case when id > ? then 1 else 0 end where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
                1,
              ]
            `)
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    // ── Boolean combinators with a custom-boolean column as the RECEIVER ──
    // `tProject.published` (t/f) used directly as a BooleanValueSource on the left
    // of `.negate()` / `.and()` / `.or()` / `.onlyWhen()` / `.ignoreWhen()` renders
    // the column as the `(published = 't')` predicate. Seed published: project 1
    // 't', 2 'f', 3 't', 4 'f'; project 4 is archived, 1–3 are not.

    test('combinator: custom boolean column negated reads as not (col = trueValue)', async () => {
        // `published.negate()` → `not (published = 't')`. The false-published
        // projects (2 'f', 4 'f') match.
        const expected = [{ id: 2 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.negate())
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where not published = 't' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: custom boolean column as the and receiver', async () => {
        // `published.and(archivedAt.isNull())` → `(published = 't') and
        // project.archived_at is null`. Published-true and not archived → 1, 3.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.and(tProject.archivedAt.isNull()))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' and archived_at is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: custom boolean column as the or receiver', async () => {
        // `published.or(archivedAt.isNotNull())` → `(published = 't') or
        // project.archived_at is not null`. Published-true (1, 3) plus the
        // archived project (4) → 1, 3, 4.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.or(tProject.archivedAt.isNotNull()))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' or archived_at is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: custom boolean column kept by only-when reads remapped', async () => {
        // `published.onlyWhen(true)` keeps the predicate, so the custom-boolean
        // receiver still remaps to `(published = 't')`. Published-true → 1, 3.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.onlyWhen(true))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: custom boolean column kept by ignore-when reads remapped', async () => {
        // `published.ignoreWhen(false)` keeps the predicate (ignoreWhen is the
        // inverse of onlyWhen), so the receiver remaps to `(published = 't')`.
        // Published-true → 1, 3.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.ignoreWhen(false))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    // ── Boolean combinators on the custom-boolean adapters ──────────
    // Each of these custom-boolean columns negates over a DISTINCT boolean literal
    // when used as a combinator receiver:
    //   - `organization.verified` (required, 'Y'/'N')  -> negates `verified = 'Y'`
    //   - `issue_worklog.approved` (nullable, 'A'/'R') -> negates `approved = 'A'`
    //   - `issue_worklog.invoiced` (required, 1/0)     -> negates `invoiced = 1`
    // Seed: organization.verified 1 'Y', 2 'N'. issue_worklog.approved 1 'A',
    // 2 'R', 3 NULL; invoiced 1 -> 1, 2 -> 0, 3 -> 1.

    test('combinator: verified custom boolean column negated reads as not (col = trueValue)', async () => {
        // `verified.negate()` negates the read remap on the required Y/N column.
        // The unverified organization (2, 'N') matches.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.negate())
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where not verified = 'Y' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: verified custom boolean column as the and receiver', async () => {
        // `verified.and(plan.equals('pro'))` -> `(verified = 'Y') and plan = $1`.
        // Acme (1, 'Y', plan 'pro') matches; Globex (2, 'N') fails the first arm.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.and(tOrganization.plan.equals('pro')))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where verified = 'Y' and "plan" = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "pro",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: verified custom boolean column as the or receiver', async () => {
        // `verified.or(id.equals(2))` -> `(verified = 'Y') or id = $1`. Acme (1)
        // via verified-true, Globex (2) via the id branch -> both organizations.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.or(tOrganization.id.equals(2)))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where verified = 'Y' or id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: approved nullable custom boolean column negated over its literal', async () => {
        // `approved.negate()` negates the read remap on the NULLABLE A/R column.
        // worklog 2 ('R') matches; worklog 1 ('A') fails and worklog 3 (NULL) is
        // excluded by NULL semantics.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.negate())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where not approved = 'A' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced numeric custom boolean column negated reads as not (col = 1)', async () => {
        // `invoiced.negate()` negates the numeric-literal read remap (1/0, distinct
        // from the string columns' 'Y'/'t'). The un-invoiced worklog (2, invoiced 0) matches.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.negate())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where not invoiced = 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced numeric custom boolean column as the and receiver', async () => {
        // `invoiced.and(id.greaterThan(0))` -> `invoiced = 1 and id > $1`. The
        // invoiced worklogs (1 and 3, invoiced 1) match; worklog 2 (invoiced 0)
        // fails the first arm.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.and(tIssueWorklog.id.greaterThan(0)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where invoiced = 1 and id > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    // ── onlyWhen / ignoreWhen kept on the custom-boolean receivers ──────
    // `onlyWhen(true)` / `ignoreWhen(false)` keep the predicate, so the custom-
    // boolean receiver still remaps to its adapter literal (`verified = 'Y'`,
    // `approved = 'A'`, `invoiced = 1`).

    test('combinator: verified custom boolean kept by only-when reads remapped', async () => {
        // `verified.onlyWhen(true)` keeps the predicate, so the Y/N column remaps
        // to `(verified = 'Y')`. The verified organization (1, 'Y') matches.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.onlyWhen(true))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where verified = 'Y' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: verified custom boolean kept by ignore-when reads remapped', async () => {
        // `verified.ignoreWhen(false)` keeps the predicate (the inverse of
        // onlyWhen), so the Y/N column still remaps to `(verified = 'Y')`.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.ignoreWhen(false))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where verified = 'Y' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: approved nullable custom boolean kept by only-when reads remapped', async () => {
        // `approved.onlyWhen(true)` keeps the predicate on the nullable A/R column,
        // remapping to `(approved = 'A')`. worklog 1 ('A') matches; 2 ('R') fails,
        // 3 (NULL) is excluded.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.onlyWhen(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: approved nullable custom boolean kept by ignore-when reads remapped', async () => {
        // `approved.ignoreWhen(false)` keeps the predicate, remapping to
        // `(approved = 'A')`.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.ignoreWhen(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced numeric custom boolean kept by only-when reads remapped', async () => {
        // `invoiced.onlyWhen(true)` keeps the predicate on the numeric 1/0 column,
        // remapping to `(invoiced = 1)`. Invoiced worklogs (1, 3) match.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.onlyWhen(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where invoiced = 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced numeric custom boolean kept by ignore-when reads remapped', async () => {
        // `invoiced.ignoreWhen(false)` keeps the predicate, remapping to
        // `(invoiced = 1)`.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.ignoreWhen(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where invoiced = 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    // ── approved.and/or and invoiced.or (the remaining and/or receivers) ──

    test('combinator: approved nullable custom boolean as the and receiver', async () => {
        // `approved.and(id.greaterThan(0))` -> `approved = 'A' and id > $1`.
        // worklog 1 ('A') matches; 2 ('R') fails, 3 (NULL) excluded.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.and(tIssueWorklog.id.greaterThan(0)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' and id > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: approved nullable custom boolean as the or receiver', async () => {
        // `approved.or(id.equals(2))` -> `approved = 'A' or id = $1`. worklog 1
        // ('A') via the first arm; worklog 2 ('R') via the id arm; worklog 3
        // (NULL or 3=2 false) stays NULL and is excluded.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.or(tIssueWorklog.id.equals(2)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' or id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced numeric custom boolean as the or receiver', async () => {
        // `invoiced.or(id.greaterThan(2))` -> `invoiced = 1 or id > $1`. Invoiced
        // worklogs 1, 3 via the first arm; worklog 2 (invoiced 0, id 2 not > 2)
        // stays false.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.or(tIssueWorklog.id.greaterThan(2)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where invoiced = 1 or id > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    // ── The custom-boolean ELIDE branch ────────────────────────────────
    // `onlyWhen(false)` / `ignoreWhen(true)` drop the predicate entirely; the
    // custom-boolean receiver's remap takes its elide branch (nothing is
    // appended) and the query emits with NO WHERE clause, returning every row.

    test('combinator: verified custom boolean elided by only-when-false drops the where', async () => {
        // `verified.onlyWhen(false)` elides — the sole WHERE disappears, so every
        // organization is returned.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.onlyWhen(false))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced custom boolean elided by ignore-when-true drops the where', async () => {
        // `invoiced.ignoreWhen(true)` elides — the sole WHERE disappears, so every
        // worklog is returned.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.ignoreWhen(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    // ── The literal-boolean overload of `.and` / `.or` on a REMAPPING receiver ──
    // `and(value: boolean)` / `or(value: boolean)` compose a bound literal with a
    // custom-boolean receiver, whose predicate remaps to its adapter's true-value.
    // Seed: organization.verified 1 'Y', 2 'N'; project.published 1 't',
    // 2 'f', 3 't', 4 'f'; issue_worklog.approved 1 'A', 2 'R', 3 NULL; invoiced 1->1,
    // 2->0, 3->1.

    test('combinator: verified custom boolean and literal true', async () => {
        // `verified.and(true)` → `<verified-remap> and $1`, param [true]. The
        // remapped predicate AND true reduces to the predicate: the verified
        // organization (1, 'Y') matches; 2 ('N') is excluded.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.and(true))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where verified = 'Y' and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: verified custom boolean or literal false', async () => {
        // `verified.or(false)` → `<verified-remap> or $1`, param [false]. The
        // remapped predicate OR false reduces to the predicate: organization 1
        // ('Y') matches; 2 ('N') is excluded.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.or(false))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where verified = 'Y' or ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: published custom boolean and literal true', async () => {
        // `published.and(true)` → `<published-remap> and $1`, param [true]. The
        // published-true projects (1 't', 3 't') match.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.and(true))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: published custom boolean or literal false', async () => {
        // `published.or(false)` → `<published-remap> or $1`, param [false]. The
        // published-true projects (1, 3) match; the false ones (2, 4) are excluded.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.or(false))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' or ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: approved nullable custom boolean and literal true', async () => {
        // `approved.and(true)` → `<approved-remap> and $1`, param [true]. worklog 1
        // ('A') matches; 2 ('R') fails; 3 (NULL) is excluded by NULL semantics.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.and(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: approved nullable custom boolean or literal false', async () => {
        // `approved.or(false)` → `<approved-remap> or $1`, param [false]. worklog 1
        // ('A') matches; 2 ('R' or false = false) and 3 (NULL or false = NULL) are
        // excluded.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.or(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' or ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced numeric custom boolean and literal true', async () => {
        // `invoiced.and(true)` → `<invoiced-remap> and $1`, param [true]. The invoiced
        // worklogs (1, 3) match; worklog 2 (invoiced 0) is excluded.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.and(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where invoiced = 1 and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('combinator: invoiced numeric custom boolean or literal false', async () => {
        // `invoiced.or(false)` → `<invoiced-remap> or $1`, param [false]. The invoiced
        // worklogs (1, 3) match; worklog 2 (invoiced 0 or false = false) is excluded.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.or(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where invoiced = 1 or ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        expect(rows).toEqual(expected)
    })
    // ==== Round-44 BOOLIF surface — required-string isNull/isNotNull remap,
    // custom-boolean *IfValue receivers (fire + elide), the remaining elide
    // branches, paren nesting, and double-remap and/or. ====

    // ── Group 1: isNull / isNotNull on the REQUIRED-string custom-boolean
    // adapters (verified 'Y'/'N', published 't'/'f'). The receiver remaps to the
    // adapter predicate, then `is [not] null` wraps THAT — `(verified = 'Y') is
    // null`. Neither column is ever NULL in the seed, so isNull matches nothing
    // and isNotNull matches every row.

    test('is-null-on-verified-required-custom-boolean-string-adapter', async () => {
        // `verified.isNull()` → `(verified = 'Y') is null`. verified is required and
        // never NULL, so no organization matches.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.isNull())
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-null-on-verified-required-custom-boolean-string-adapter', async () => {
        // `verified.isNotNull()` → `(verified = 'Y') is not null`. Every organization
        // carries a value, so both rows match.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.isNotNull())
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-null-on-published-required-custom-boolean-string-adapter', async () => {
        // `published.isNull()` → `(published = 't') is null`. published is required and
        // never NULL, so no project matches.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.isNull())
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where (published = 't') is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-null-on-published-required-custom-boolean-string-adapter', async () => {
        // `published.isNotNull()` → `(published = 't') is not null`. Every project
        // carries a value, so all four rows match.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.isNotNull())
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where (published = 't') is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ── Group 3: the *IfValue predicate family with a custom-boolean column as
    // the receiver. When the value is present the receiver remaps to its adapter
    // predicate inside the comparison (`(verified = 'Y') = $1`); when the value is
    // undefined the whole predicate elides (short-circuits BEFORE the remap), so
    // the sole WHERE disappears and every row returns. Each test pins BOTH arms.
    // Seed: verified 1 'Y', 2 'N'; published 1 't', 2 'f', 3 't', 4 'f'; approved 1
    // 'A', 2 'R', 3 NULL; invoiced 1 -> 1, 2 -> 0, 3 -> 1.

    test('equals-if-value-on-verified-custom-boolean-fires-and-elides', async () => {
        // `verified.equalsIfValue(true)` fires → `(verified = 'Y') = $1`; the verified
        // organization (1, 'Y') matches. undefined elides → every organization.
        const present: boolean | undefined = true
        const fired = [{ id: 1 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.equalsIfValue(present))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.equalsIfValue(absent))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('equals-if-value-on-approved-custom-boolean-fires-and-elides', async () => {
        // `approved.equalsIfValue(true)` fires → `(approved = 'A') = $1`; worklog 1
        // ('A') matches, worklog 2 ('R') fails, worklog 3 (NULL) is excluded. undefined
        // elides → every worklog.
        const present: boolean | undefined = true
        const fired = [{ id: 1 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.equalsIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (approved = 'A') = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.equalsIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('is-if-value-on-published-custom-boolean-fires-and-elides', async () => {
        // `published.isIfValue(true)` fires → the null-safe `(published = 't') is not
        // distinct from $1`; the published-true projects (1, 3) match. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.isIfValue(present))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where (published = 't') is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.isIfValue(absent))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('is-if-value-on-verified-custom-boolean-fires-and-elides', async () => {
        // `verified.isIfValue(true)` fires → `(verified = 'Y') is not distinct from $1`;
        // the verified organization (1) matches. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 1 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.isIfValue(present))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.isIfValue(absent))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('is-if-value-on-approved-custom-boolean-fires-and-elides', async () => {
        // `approved.isIfValue(true)` fires → `(approved = 'A') is not distinct from $1`;
        // worklog 1 ('A') matches; worklog 2 ('R') and worklog 3 (NULL, distinct from
        // true) do not. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 1 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.isIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (approved = 'A') is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.isIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('not-equals-if-value-on-invoiced-custom-boolean-fires-and-elides', async () => {
        // `invoiced.notEqualsIfValue(true)` fires → `(invoiced = 1) <> $1`; the
        // un-invoiced worklog (2, invoiced 0) matches, the invoiced ones (1, 3) do not.
        // undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 2 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.notEqualsIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.notEqualsIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('not-equals-if-value-on-verified-custom-boolean-fires-and-elides', async () => {
        // `verified.notEqualsIfValue(true)` fires → `(verified = 'Y') <> $1`; the
        // unverified organization (2, 'N') matches. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 2 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.notEqualsIfValue(present))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.notEqualsIfValue(absent))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('not-equals-if-value-on-approved-custom-boolean-fires-and-elides', async () => {
        // `approved.notEqualsIfValue(true)` fires → `(approved = 'A') <> $1`; worklog 2
        // ('R') matches; worklog 1 ('A') fails; worklog 3 (NULL) is excluded. undefined
        // elides.
        const present: boolean | undefined = true
        const fired = [{ id: 2 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.notEqualsIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (approved = 'A') <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.notEqualsIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('is-not-if-value-on-published-custom-boolean-fires-and-elides', async () => {
        // `published.isNotIfValue(true)` fires → `(published = 't') is distinct from $1`;
        // the published-false projects (2, 4) match. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 2 }, { id: 4 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.isNotIfValue(present))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where (published = 't') is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.isNotIfValue(absent))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('is-not-if-value-on-verified-custom-boolean-fires-and-elides', async () => {
        // `verified.isNotIfValue(true)` fires → `(verified = 'Y') is distinct from $1`;
        // the unverified organization (2, 'N') matches. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 2 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.isNotIfValue(present))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.isNotIfValue(absent))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('is-not-if-value-on-approved-custom-boolean-fires-and-elides', async () => {
        // `approved.isNotIfValue(true)` fires → `(approved = 'A') is distinct from $1`;
        // worklog 2 ('R') and worklog 3 (NULL, distinct from true) match; worklog 1
        // ('A') does not. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.isNotIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (approved = 'A') is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.isNotIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('is-not-if-value-on-invoiced-custom-boolean-fires-and-elides', async () => {
        // `invoiced.isNotIfValue(true)` fires → `(invoiced = 1) is distinct from $1`;
        // the un-invoiced worklog (2, invoiced 0) matches. undefined elides.
        const present: boolean | undefined = true
        const fired = [{ id: 2 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.isNotIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.isNotIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    // ── Group 5: the remaining custom-boolean ELIDE branches. `onlyWhen(false)` /
    // `ignoreWhen(true)` drop the predicate entirely, so the sole WHERE disappears
    // (the receiver's remap takes its elide arm — nothing is appended) and every
    // row returns. (verified.onlyWhen(false) and invoiced.ignoreWhen(true) are
    // covered above; these are the complementary adapter × direction cells.)

    test('published-custom-boolean-elided-by-only-when-false', async () => {
        // `published.onlyWhen(false)` elides — the sole WHERE disappears, so every
        // project returns.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.onlyWhen(false))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('published-custom-boolean-elided-by-ignore-when-true', async () => {
        // `published.ignoreWhen(true)` elides — the sole WHERE disappears, so every
        // project returns.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.ignoreWhen(true))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('approved-custom-boolean-elided-by-only-when-false', async () => {
        // `approved.onlyWhen(false)` elides — the sole WHERE disappears, so every
        // worklog returns.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.onlyWhen(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('approved-custom-boolean-elided-by-ignore-when-true', async () => {
        // `approved.ignoreWhen(true)` elides — the sole WHERE disappears, so every
        // worklog returns.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.ignoreWhen(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('invoiced-custom-boolean-elided-by-only-when-false', async () => {
        // `invoiced.onlyWhen(false)` elides — the sole WHERE disappears, so every
        // worklog returns.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.onlyWhen(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('verified-custom-boolean-elided-by-ignore-when-true', async () => {
        // `verified.ignoreWhen(true)` elides — the sole WHERE disappears, so every
        // organization returns.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.ignoreWhen(true))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ── Group 6: paren nesting around a remapping custom-boolean operand.

    test('paren-and-with-or-right-operand-remaps-custom-boolean', async () => {
        // `id.greaterThan(0).and(verified.or(plan.equals('pro')))` — the right operand
        // is an `_or` whose left arm is a custom-boolean remap, so the whole `_or` is
        // parenthesised as the RHS of the `and`. Org 1 (verified 'Y') matches via the
        // remap; org 2 (verified 'N', plan 'free' ≠ 'pro') fails both `_or` arms.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.greaterThan(0)
                .and(tOrganization.verified.or(tOrganization.plan.equals('pro'))))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where id > ? and (verified = 'Y' or "plan" = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            "pro",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('negate-and-with-remapping-custom-boolean', async () => {
        // `verified.and(plan.equals('pro')).negate()` → `not (<verified remap> and plan
        // = $1)`. Org 1 ('Y', 'pro') → not (true and true) = false; org 2 ('N', 'free')
        // → not (false and false) = true → the unverified organization matches.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.and(tOrganization.plan.equals('pro')).negate())
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where not (verified = 'Y' and "plan" = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "pro",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ── Group 7: double-remap — BOTH operands of `.and` / `.or` are custom-boolean
    // columns, so each renders its own adapter predicate. approved ('A'/'R', string)
    // and invoiced (1/0, numeric) remap independently.

    test('double-remap-and-approved-and-invoiced', async () => {
        // `approved.and(invoiced)` → `<approved remap> and <invoiced remap>`. worklog 1
        // (approved 'A' → true, invoiced 1 → true) matches; worklog 2 (false and false)
        // fails; worklog 3 (approved NULL, invoiced true) stays NULL and is excluded.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.and(tIssueWorklog.invoiced))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' and invoiced = 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('double-remap-or-approved-or-invoiced', async () => {
        // `approved.or(invoiced)` → `<approved remap> or <invoiced remap>`. worklog 1
        // (true or true) and worklog 3 (approved NULL or invoiced true = true) match;
        // worklog 2 (false or false) is excluded.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.or(tIssueWorklog.invoiced))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where approved = 'A' or invoiced = 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
    // ── Group 8: the IN-family on a remapping (custom-boolean) receiver. `in` is
    // covered elsewhere; the `not in` keyword, the *IfValue fire/elide arms, the
    // variadic inN/notInN forms, plain isNot, the or/and-of-inner-combinator shapes
    // and equalsIfValue().negate() on a cb receiver are emitted nowhere. Seed:
    // issue_worklog.invoiced 1 -> 1 (true), 2 -> 0 (false), 3 -> 1 (true);
    // organization.verified 1 'Y' (true), 2 'N' (false); project.published 1 't', 2
    // 'f', 3 't', 4 'f'; project 4 has archived_at set, 1-3 NULL.

    test('not-in-on-invoiced-custom-boolean-emits-numeric-remap', async () => {
        // `invoiced.notIn([false])` -> `(invoiced = 1) not in ($1)`. The invoiced
        // worklogs (1, 3) match; the un-invoiced one (2) does not.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.notIn([false]))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('not-in-on-verified-custom-boolean-emits-string-remap', async () => {
        // `verified.notIn([true])` -> `(verified = 'Y') not in ($1)`. The unverified
        // organization (2, 'N') matches.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.notIn([true]))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where (verified = 'Y') not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('in-if-value-on-invoiced-custom-boolean-fires-and-elides', async () => {
        // `invoiced.inIfValue([false])` fires -> `(invoiced = 1) in ($1)`; the
        // un-invoiced worklog (2) matches. A null/undefined array elides.
        const present: boolean[] | undefined = [false]
        const fired = [{ id: 2 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.inIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean[] | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.inIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('not-in-if-value-on-invoiced-custom-boolean-fires-and-elides', async () => {
        // `invoiced.notInIfValue([false])` fires -> `(invoiced = 1) not in ($1)`; the
        // invoiced worklogs (1, 3) match. A null/undefined array elides.
        const present: boolean[] | undefined = [false]
        const fired = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.notInIfValue(present))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean[] | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.notInIfValue(absent))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })

    test('in-n-variadic-on-invoiced-custom-boolean', async () => {
        // `invoiced.inN(true, false)` -> `(invoiced = 1) in ($1, $2)` (variadic form).
        // Both boolean values listed, so every worklog matches.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.inN(true, false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('not-in-n-variadic-on-invoiced-custom-boolean', async () => {
        // `invoiced.notInN(true, false)` -> `(invoiced = 1) not in ($1, $2)` (variadic
        // form). Both boolean values excluded, so no worklog matches.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.notInN(true, false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) not in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-on-invoiced-custom-boolean-plain', async () => {
        // `invoiced.isNot(true)` -> `(invoiced = 1) is distinct from $1` (null-safe).
        // Only `is` was covered plain on a cb receiver; isNot is the sibling. The
        // un-invoiced worklog (2, false) is distinct from true.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.isNot(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('or-of-and-from-published-custom-boolean-receiver', async () => {
        // `published.or(id > 3 and archived_at is not null)` ->
        // `published = 't' or (id > $1 and archived_at is not null)`. Published-true
        // projects (1, 3) match on the left; project 4 (id 4 > 3, archived) matches the
        // parenthesised right arm.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.or(tProject.id.greaterThan(3).and(tProject.archivedAt.isNotNull())))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' or (id > ? and archived_at is not null) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('and-of-or-from-published-custom-boolean-receiver', async () => {
        // `published.and(id < 3 or archived_at is not null)` ->
        // `published = 't' and (id < $1 or archived_at is not null)`. Of the
        // published-true projects (1, 3), only project 1 (id 1 < 3) satisfies the
        // parenthesised right arm; project 3 (id 3, archived_at null) is excluded.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.published.and(tProject.id.lessThan(3).or(tProject.archivedAt.isNotNull())))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where published = 't' and (id < ? or archived_at is not null) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('equals-if-value-negate-on-invoiced-custom-boolean-fires-and-elides', async () => {
        // `invoiced.equalsIfValue(true).negate()` fires -> `not ((invoiced = 1) = $1)`;
        // the un-invoiced worklog (2) is the only one NOT equal to true. undefined
        // elides (negate of a no-op is a no-op).
        const present: boolean | undefined = true
        const fired = [{ id: 2 }]
        ctx.mockNext(fired)
        const firedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.equalsIfValue(present).negate())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where not ((invoiced = 1) = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof firedRows, Array<{ id: number }>>>()
        expect(firedRows).toEqual(fired)

        const absent: boolean | undefined = undefined
        const elided = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(elided)
        const elidedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.equalsIfValue(absent).negate())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(elidedRows).toEqual(elided)
    })
})
