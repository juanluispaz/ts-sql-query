// Coverage of `UPDATE ... RETURNING` / `OUTPUT inserted.*` paths.
//
// Each mutation runs inside `ctx.withRollback(...)`.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-one-row', async () => {
        const expectedMock = { id: 1, title: 'Patched', priority: 5 }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Patched', priority: 5 })
                .where(tIssue.id.equals(1))
                .returning({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    priority: tIssue.priority,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ? where id = ? returning id as id, title as title, priority as priority"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Patched",
                5,
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:       number
                title:    string
                priority: number
            }>>()

            if (ctx.realDbEnabled) {
                expect(row.id).toBe(1)
                expect(row.title).toBe('Patched')
                expect(row.priority).toBe(5)
            } else {
                expect(row).toEqual(expectedMock)
            }
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-one-column', async () => {
        ctx.mockNext('Renamed Acme')

        await ctx.withRollback(async () => {
            const newName = await ctx.conn.update(tOrganization)
                .set({ name: 'Renamed Acme' })
                .where(tOrganization.id.equals(1))
                .returningOneColumn(tOrganization.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update organization set name = ? where id = ? returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed Acme",
                1,
              ]
            `)
            assertType<Exact<typeof newName, string>>()

            expect(newName).toBe('Renamed Acme')
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-many', async () => {
        // Update every issue with priority 1 and return one row per
        // touched record. Exercises `executeUpdateMany`.
        const expectedMock = [
            { id: 1, title: 'Bumped 1' },
            { id: 2, title: 'Bumped 2' },
        ]
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const rows = await ctx.conn.update(tIssue)
                .set({ priority: 9 })
                .where(tIssue.priority.equals(1))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .executeUpdateMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = ? where priority = ? returning id as id, title as title"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9,
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()

            if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)
            else expect(Array.isArray(rows)).toBe(true)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-projecting-optional-values-as-nullable', async () => {
        // optional RETURNING columns become a present `| null` via
        // `projectingOptionalValuesAsNullable()` on an UPDATE builder. issue 3
        // has body = NULL, so the returned value is null (present), not absent.
        const expectedMock = { id: 3, body: null }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const updated = await ctx.conn.update(tIssue)
                .set({ status: 'in_progress' })
                .where(tIssue.id.equals(3))
                .returning({ id: tIssue.id, body: tIssue.body })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updated, { id: number; body: string | null }>>()
            expect(updated).toEqual({ id: 3, body: null })
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-one-column-computed-expression', async () => {
        // RETURNING a COMPUTED expression (a column combined with a const), not
        // a bare column, via `returningOneColumn`. The `priority + 100`
        // projection arm is shared with SELECT but exercised here on the UPDATE
        // RETURNING path. RETURNING sees the post-UPDATE value, so setting
        // priority=5 returns 105.
        ctx.mockNext(105)

        await ctx.withRollback(async () => {
            const bumped = await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.priority.add(100))
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = $1 where id = $2 returning priority + $3 as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                5,
                1,
                100,
              ]
            `)
            assertType<Exact<typeof bumped, number>>()
            expect(bumped).toBe(105)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-object-computed-expression', async () => {
        // Object-form RETURNING projecting a COMPUTED expression
        // (`title || ' [done]'`) alongside a plain column. The derived-value
        // projection arm is shared with SELECT but pinned here on the UPDATE
        // RETURNING path. RETURNING sees the post-UPDATE title, so setting
        // title='Patched' returns 'Patched [done]'.
        const expected = { id: 1, tag: 'Patched [done]' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Patched' })
                .where(tIssue.id.equals(1))
                .returning({
                    id:  tIssue.id,
                    tag: tIssue.title.concat(' [done]'),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = $1 where id = $2 returning id as id, title || $3 as tag"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Patched",
                1,
                " [done]",
              ]
            `)
            assertType<Exact<typeof row, { id: number; tag: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-nested-object-projection', async () => {
        // Object-form RETURNING containing a NESTED object projection (plain —
        // no `oldValues`). The `meta` group folds two projected columns into a
        // sub-object; the RETURNING clause emits both columns flat (aliased
        // `meta.title` / `meta.priority`) and the complex projector reshapes the
        // row. RETURNING sees post-UPDATE values: title='Patched', priority=5.
        const expected = { id: 1, meta: { title: 'Patched', priority: 5 } }
        // The mock is primed with the FLAT db row (dotted alias keys); the
        // projector folds it into the nested shape asserted below.
        ctx.mockNext({ id: 1, 'meta.title': 'Patched', 'meta.priority': 5 })

        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Patched', priority: 5 })
                .where(tIssue.id.equals(1))
                .returning({
                    id:   tIssue.id,
                    meta: { title: tIssue.title, priority: tIssue.priority },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = $1, priority = $2 where id = $3 returning id as id, title as "meta.title", priority as "meta.priority""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Patched",
                5,
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:   number
                meta: { title: string; priority: number }
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-object-none-or-one', async () => {
        // `executeUpdateNoneOrOne()` with an OBJECT-shape returning yields
        // `{...} | null`. Only the single-column branch (returningOneColumn) was
        // asserted for UPDATE noneOrOne; INSERT and DELETE both cover their
        // object noneOrOne — this pins the UPDATE object noneOrOne arm. Issue 1
        // exists, so the update matches exactly one row and returns it (the
        // `| null` arm is the type promise the None case would take).
        const expectedMock = { id: 1, title: 'Reordered' }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Reordered' })
                .where(tIssue.id.equals(1))
                .returning({ id: tIssue.id, title: tIssue.title })
                .executeUpdateNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number; title: string } | null>>()
            expect(row).toEqual(expectedMock)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-release-draft-returning-one-column-optional-branded', async () => {
        // `returningOneColumn(<optional branded column>)` on UPDATE → `ReleaseStage | null`.
        // RETURNING sees the post-update value; draft 1's `stage` ('candidate') is untouched by the
        // title update, so it comes back present.
        ctx.mockNext('candidate')
        await ctx.withRollback(async () => {
            const stage = await ctx.conn.update(tReleaseDraft)
                .set({ title: 'Alpha cut v2' })
                .where(tReleaseDraft.id.equals(1))
                .returningOneColumn(tReleaseDraft.stage)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof stage, ReleaseStage | null>>()
            expect(stage).toBe('candidate')
        })
    })
    */
    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-release-draft-returning-object-optional-branded-default', async () => {
        // Object-form RETURNING of an optional branded column on UPDATE. Under the default projector
        // the leaf is `stage?: ReleaseStage` (brand preserved). Draft 1's stage 'candidate' is
        // present.
        const expected = { id: 1, stage: 'candidate' as ReleaseStage }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tReleaseDraft)
                .set({ title: 'Alpha cut v2' })
                .where(tReleaseDraft.id.equals(1))
                .returning({ id: tReleaseDraft.id, stage: tReleaseDraft.stage })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number; stage?: ReleaseStage }>>()
            expect(row).toEqual(expected)
        })
    })
    */
    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-release-draft-returning-object-optional-branded-as-nullable', async () => {
        // The same under `projectingOptionalValuesAsNullable()` → `stage: ReleaseStage | null`.
        // Draft 2's stage is NULL, so the returned value is present-null.
        const expected = { id: 2, stage: null }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tReleaseDraft)
                .set({ title: 'Nightly build v2' })
                .where(tReleaseDraft.id.equals(2))
                .returning({ id: tReleaseDraft.id, stage: tReleaseDraft.stage })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number; stage: ReleaseStage | null }>>()
            expect(row).toEqual(expected)
        })
    })
    */
})
