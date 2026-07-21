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

    // NOT-APPLICABLE: This dialect does not support UPDATE ... RETURNING, so the returning() form of an UPDATE is typed never here.
    /*
    test('update-returning-rule1-gate-null-drops-object-default', async () => {
        // Object-form RETURNING with a RULE-1 gate: `meta.gate` is
        // `tReleaseDraft.stage.asRequiredInOptionalObject()` (a requiredInOptionalObject
        // leaf) and `meta.sibling` is a value-bearing `tReleaseDraft.title`. When the
        // gate column is NULL the whole `meta` object DROPS from the row (rule-1) even
        // though the sibling carries a value — the UPDATE-returning entry applies rule-1.
        // Draft 2's stage is NULL, so under the default projector `meta` is absent.
        const expected = { id: 2 }
        // Mock primed with the FLAT db row (gate null, sibling present); the projector
        // drops `meta` because its gate leaf is null.
        ctx.mockNext({ id: 2, 'meta.sibling': 'Nightly build v2', 'meta.gate': null })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tReleaseDraft)
                .set({ title: 'Nightly build v2' })
                .where(tReleaseDraft.id.equals(2))
                .returning({
                    id:   tReleaseDraft.id,
                    meta: { sibling: tReleaseDraft.title, gate: tReleaseDraft.stage.asRequiredInOptionalObject() },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number; meta?: { sibling: string; gate: ReleaseStage } }>>()
            expect(row).toEqual(expected)
            expect('meta' in row).toBe(false)
        })
    })
    */

    // NOT-APPLICABLE: This dialect does not support UPDATE ... RETURNING, so the returning() form of an UPDATE is typed never here.
    /*
    test('update-returning-rule1-gate-null-drops-object-as-nullable', async () => {
        // The same rule-1 gate under `projectingOptionalValuesAsNullable()`: the whole
        // `meta` object becomes `{...} | null`, and a null gate still surfaces it as
        // `meta: null` (the object is dropped/nulled, not surfaced with the sibling).
        // Draft 2's stage is NULL, so `meta` comes back present-null.
        const expected = { id: 2, meta: null }
        ctx.mockNext({ id: 2, 'meta.sibling': 'Nightly build v2', 'meta.gate': null })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tReleaseDraft)
                .set({ title: 'Nightly build v2' })
                .where(tReleaseDraft.id.equals(2))
                .returning({
                    id:   tReleaseDraft.id,
                    meta: { sibling: tReleaseDraft.title, gate: tReleaseDraft.stage.asRequiredInOptionalObject() },
                })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number; meta: { sibling: string; gate: ReleaseStage } | null }>>()
            expect(row).toEqual(expected)
            expect('meta' in row).toBe(true)
            expect(row.meta).toBe(null)
        })
    })
    */
    // MariaDB's UPDATE has no RETURNING clause; the library refuses
    // `.returningOneColumn(...).executeUpdateMany()` at compile time. Kept
    // commented for symmetry.
    // NOT-APPLICABLE: MariaDB has no RETURNING on UPDATE.
    /*
    test('update-returning-one-column-many-coerces-undefined-to-null', async () => {
        // `returningOneColumn(<optional col>)` consumed by `executeUpdateMany()`
        // maps each returned scalar, coercing a driver-returned `undefined` element
        // to `null` (the per-element coercion line that a single-row path never
        // hits). The mock primes `[undefined, 'x']` to force that path; on a real
        // engine the actual bodies come back (issues 1 and 2 of project 1: NULL and
        // 'Use new tokens'). The element type stays `string | null`.
        await ctx.withRollback(async () => {
            ctx.mockNext([undefined, 'Use new tokens'])
            const bodies = await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.projectId.equals(1))
                .returningOneColumn(tIssue.body)
                .executeUpdateMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof bodies, Array<string | null>>>()
            const sortedBodies = [...bodies].sort((a, b) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)))
            expect(sortedBodies).toEqual([null, 'Use new tokens'])
        })
    })
    */
    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-nested-object-optional-leaf-default', async () => {
        // object-form RETURNING whose nested `meta` group holds a SINGLE OPTIONAL
        // leaf (`archivedAt`) under the DEFAULT projector → `meta?: { archivedAt?: Date }`. Two boundary rows: project 4 (archived_at present) → `meta` + `archivedAt`
        // present; project 1 (archived_at NULL) → `meta` absent.
        await ctx.withRollback(async () => {
            ctx.mockNext({ id: 4, 'meta.archivedAt': new Date(Date.UTC(2024, 5, 15, 8, 30, 0)) })
            const present = await ctx.conn.update(tProject)
                .set({ name: 'Legacy app v2' })
                .where(tProject.id.equals(4))
                .returning({
                    id:   tProject.id,
                    meta: { archivedAt: tProject.archivedAt },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof present, { id: number; meta?: { archivedAt?: Date } }>>()
            expect(present.id).toBe(4)
            expect('meta' in present).toBe(true)
            expect(present.meta && 'archivedAt' in present.meta).toBe(true)
            expect(present.meta!.archivedAt).toBeInstanceOf(Date)

            ctx.mockNext({ id: 1, 'meta.archivedAt': null })
            const absent = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v2' })
                .where(tProject.id.equals(1))
                .returning({
                    id:   tProject.id,
                    meta: { archivedAt: tProject.archivedAt },
                })
                .executeUpdateOne()
            assertType<Exact<typeof absent, { id: number; meta?: { archivedAt?: Date } }>>()
            expect(absent.id).toBe(1)
            expect('meta' in absent).toBe(false)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no UPDATE ... RETURNING clause.
    /*
    test('update-returning-temporal-plain-kinds-round-trip', async () => {
        // RETURNING the plain temporal kinds (localDate + localTime) on UPDATE, then
        // reading the same row back — RETURNING == SELECT for the updated row.
        await ctx.withRollback(async () => {
            const reviewDate = new Date(Date.UTC(2026, 8, 9))
            const reviewTime = new Date(Date.UTC(1970, 0, 1, 7, 5, 0))
            ctx.mockNext({ reviewDate, reviewTime })
            const ret = await ctx.conn.update(tProjectReview)
                .set({ reviewDate, reviewTime })
                .where(tProjectReview.id.equals(1))
                .returning({ reviewDate: tProjectReview.reviewDate, reviewTime: tProjectReview.reviewTime })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_review set review_date = $1, review_time = $2 where id = $3 returning review_date as "reviewDate", review_time as "reviewTime""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2026-09-09T00:00:00.000Z,
                "07:05:00",
                1,
              ]
            `)
            assertType<Exact<typeof ret, { reviewDate?: Date; reviewTime: Date }>>()
            expect(ret.reviewTime).toBeInstanceOf(Date)
            expect(ret.reviewDate).toBeInstanceOf(Date)

            ctx.mockNext({ reviewDate, reviewTime })
            const sel = await ctx.conn.selectFrom(tProjectReview)
                .where(tProjectReview.id.equals(1))
                .select({ reviewDate: tProjectReview.reviewDate, reviewTime: tProjectReview.reviewTime })
                .executeSelectOne()
            expect(ret.reviewDate).toEqual(sel.reviewDate)
            expect(ret.reviewTime).toEqual(sel.reviewTime)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no UPDATE ... RETURNING clause.
    /*
    test('update-returning-temporal-custom-kinds-round-trip', async () => {
        // RETURNING the branded custom temporal kinds on UPDATE — customLocalDate,
        // customLocalTime, customLocalDateTime — then reading the same row back.
        await ctx.withRollback(async () => {
            const releasedOn = new Date(Date.UTC(2026, 3, 4))
            const cutoffTime = new Date(Date.UTC(1970, 0, 1, 22, 10, 0))
            const publishedAt = new Date(Date.UTC(2026, 3, 5, 6, 20, 0))
            ctx.mockNext({ releasedOn, cutoffTime, publishedAt })
            const ret = await ctx.conn.update(tProjectRelease)
                .set({ releasedOn, cutoffTime, publishedAt })
                .where(tProjectRelease.id.equals(1))
                .returning({
                    releasedOn:  tProjectRelease.releasedOn,
                    cutoffTime:  tProjectRelease.cutoffTime,
                    publishedAt: tProjectRelease.publishedAt,
                })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_release set released_on = $1, cutoff_time = $2, published_at = $3 where id = $4 returning released_on as "releasedOn", cutoff_time as "cutoffTime", published_at as "publishedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2026-04-04T00:00:00.000Z,
                "22:10:00",
                2026-04-05T06:20:00.000Z,
                1,
              ]
            `)
            assertType<Exact<typeof ret, { releasedOn: Date; cutoffTime: Date; publishedAt: Date }>>()
            expect(ret.releasedOn).toBeInstanceOf(Date)
            expect(ret.cutoffTime).toBeInstanceOf(Date)
            expect(ret.publishedAt).toBeInstanceOf(Date)

            ctx.mockNext({ releasedOn, cutoffTime, publishedAt })
            const sel = await ctx.conn.selectFrom(tProjectRelease)
                .where(tProjectRelease.id.equals(1))
                .select({
                    releasedOn:  tProjectRelease.releasedOn,
                    cutoffTime:  tProjectRelease.cutoffTime,
                    publishedAt: tProjectRelease.publishedAt,
                })
                .executeSelectOne()
            expect(ret.releasedOn).toEqual(sel.releasedOn)
            expect(ret.cutoffTime).toEqual(sel.cutoffTime)
            expect(ret.publishedAt).toEqual(sel.publishedAt)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no UPDATE ... RETURNING clause.
    /*
    test('update-returning-one-column-temporal-real-value', async () => {
        // `returningOneColumn(<localTime>)` on UPDATE returns a REAL (non-null) Date.
        await ctx.withRollback(async () => {
            const reviewTime = new Date(Date.UTC(1970, 0, 1, 13, 45, 0))
            ctx.mockNext(reviewTime)
            const v = await ctx.conn.update(tProjectReview)
                .set({ reviewTime })
                .where(tProjectReview.id.equals(1))
                .returningOneColumn(tProjectReview.reviewTime)
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_review set review_time = $1 where id = $2 returning review_time as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "13:45:00",
                1,
              ]
            `)
            assertType<Exact<typeof v, Date>>()
            expect(v).toBeInstanceOf(Date)
        })
    })
    */
})
