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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select "organization".id as "orgId", app_user.id as "userId" from "organization" inner join app_user on app_user.verified = "organization".verified where "organization".id = :0 order by "userId""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select "organization".id as "orgId", project.id as "projectId" from "organization" inner join project on project.organization_id = "organization".id where case when "organization".verified = 'Y' then 1 else 0 end = case when project.published = 't' then 1 else 0 end order by "projectId""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from "organization" where case when verified = 'Y' then 1 else 0 end = (case when id > :0 then 1 else 0 end) order by "id""`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set published = case when id > :0 then 't' else 'f' end where id = :1"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.published = case when "organization".verified = 'Y' then 't' else 'f' end from "organization" where project.organization_id = "organization".id"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, published) values (:0, :1, :2, case when :3 > :4 then 't' else 'f' end)"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into "organization" (name, "plan", verified) values (:0, :1, case when (:2 = 1) then 'Y' else 'N' end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "pro",
                1,
              ]
            `)
            expect(typeof inserted).toBe('number')

            ctx.mockNext({ verified: true })
            const row = await ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.name.equals('Initech'))
                .select({ verified: tOrganization.verified })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when verified = 'Y' then 1 else 0 end as "verified" from "organization" where name = :0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when invoiced = 1 then 1 else 0 end as "isInvoiced" from issue_worklog order by "id""`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set invoiced = case when id > :0 then 1 else 0 end where id = :1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where not (published = 't') order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where (published = 't') and archived_at is null order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where (published = 't') or archived_at is not null order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where (published = 't') order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where (published = 't') order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })
})
