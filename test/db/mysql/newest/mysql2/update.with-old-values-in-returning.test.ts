// `tTable.oldValues()` exposes the row state BEFORE the UPDATE is applied,
// so a single statement can `RETURNING { old: oldX, new: newX }` for
// audit / event-sourcing flows. `_buildOldValuesForUpdate` emits a
// synthetic FROM-subquery that pre-projects the target table aliased as
// `_old_` so the RETURNING clause can refer to its columns alongside the
// freshly-updated row. The exact emitted form is pinned per cell by the
// snapshot below.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-old-and-new-single-column-via-oldValues', async () => {
        // Update project 1's name; return both the previous and the
        // new name in one round-trip. Seed: project 1 is 'Marketing
        // site'. After the update its name is 'Mktg site v2'.
        ctx.mockNext({ oldName: 'Marketing site', newName: 'Mktg site v2' })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Mktg site v2' })
                .where(tProject.id.equals(1))
                .returning({
                    oldName: oldProject.name,
                    newName: tProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning old.name as "oldName", name as "newName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mktg site v2",
                1,
              ]
            `)
            assertType<Exact<typeof row, { oldName: string; newName: string }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({ oldName: 'Marketing site', newName: 'Mktg site v2' })
            } else {
                expect(row.oldName).toBe('Marketing site')
                expect(row.newName).toBe('Mktg site v2')
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-old-and-new-two-columns-via-oldValues', async () => {
        // Two-column audit projection: pre/post name and pre/post
        // slug. The emission must reference `_old_.name`, `_old_.slug`
        // inside the synthesised FROM-subquery and the matching live
        // columns on the target table.
        ctx.mockNext({
            id: 2,
            oldName: 'Internal tools',
            newName: 'Internal apps',
            oldSlug: 'tools',
            newSlug: 'apps',
        })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Internal apps', slug: 'apps' })
                .where(tProject.id.equals(2))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                    oldSlug: oldProject.slug,
                    newSlug: tProject.slug,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1, slug = $2 where id = $3 returning id as id, old.name as "oldName", name as "newName", old.slug as "oldSlug", slug as "newSlug""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Internal apps",
                "apps",
                2,
              ]
            `)
            assertType<Exact<typeof row, {
                id: number
                oldName: string
                newName: string
                oldSlug: string
                newSlug: string
            }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({
                    id: 2,
                    oldName: 'Internal tools',
                    newName: 'Internal apps',
                    oldSlug: 'tools',
                    newSlug: 'apps',
                })
            } else {
                expect(row.id).toBe(2)
                expect(row.oldName).toBe('Internal tools')
                expect(row.newName).toBe('Internal apps')
                expect(row.oldSlug).toBe('tools')
                expect(row.newSlug).toBe('apps')
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-one-column-old-value-via-oldValues', async () => {
        // The bare single-column `returningOneColumn(oldProject.name)` form off an
        // UPDATE: it returns ONLY the previous value of `name` (pre-update) as a bare
        // `string`. Update project 1's name; the old name 'Marketing site' comes back.
        ctx.mockNext('Marketing site')
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const oldName = await ctx.conn.update(tProject)
                .set({ name: 'Mktg site v3' })
                .where(tProject.id.equals(1))
                .returningOneColumn(oldProject.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning old.name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mktg site v3",
                1,
              ]
            `)
            assertType<Exact<typeof oldName, string>>()
            expect(oldName).toBe('Marketing site')
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-computed-expression-over-old-value-via-oldValues', async () => {
        // A value-source EXPRESSION computed OVER an old column in RETURNING (not a
        // bare old column): `oldProject.name || ' [was]'` reads the pre-update value.
        // Update project 1’s name; RETURNING returns the previous name wrapped
        // ('Marketing site [was]') alongside the new name 'Mktg v4'.
        ctx.mockNext({ oldTag: 'Marketing site [was]', newName: 'Mktg v4' })
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Mktg v4' })
                .where(tProject.id.equals(1))
                .returning({
                    oldTag:  oldProject.name.concat(' [was]'),
                    newName: tProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { oldTag: string; newName: string }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({ oldTag: 'Marketing site [was]', newName: 'Mktg v4' })
            } else {
                expect(row.oldTag).toBe('Marketing site [was]')
                expect(row.newName).toBe('Mktg v4')
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-old-and-new-adapter-column-via-oldValues', async () => {
        // An ADAPTER column read through the `oldValues()` synthetic old-row
        // subquery in RETURNING: `score` carries the scaledTenthAdapter (÷10 read,
        // ×10 write). The SET writes 90 (→ binds 900); RETURNING reads the
        // pre-update `score` (raw 850 → 85) via the aliased old-row subquery AND the
        // post-update value (raw 900 → 90). Review 1's score is 850; runs inside
        // withRollback (tProjectReview is a leaf).
        ctx.mockNext({ oldScore: 850, newScore: 900 })
        await ctx.withRollback(async () => {
            const oldReview = tProjectReview.oldValues()
            const row = await ctx.conn.update(tProjectReview)
                .set({ score: 90 })
                .where(tProjectReview.id.equals(1))
                .returning({
                    oldScore: oldReview.score,
                    newScore: tProjectReview.score,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { oldScore: number; newScore: number }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({ oldScore: 85, newScore: 90 })
            } else {
                expect(row.oldScore).toBe(85)
                expect(row.newScore).toBe(90)
            }
        })
    })
    */
    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-old-and-new-folded-into-nested-audit-object-via-oldValues', async () => {
        // `oldValues()` folded into a nested sub-object:
        // `returning({ id, audit: { old: oldProject.name, new: tProject.name } })`
        // emits the dotted-old-alias form `old.name as "audit.old"`. Update project
        // 1's name; the audit object carries the pre-update name ('Marketing site')
        // and the new name ('Mktg nested').
        ctx.mockNext({ id: 1, 'audit.old': 'Marketing site', 'audit.new': 'Mktg nested' })
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Mktg nested' })
                .where(tProject.id.equals(1))
                .returning({
                    id:    tProject.id,
                    audit: { old: oldProject.name, new: tProject.name },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, old.name as "audit.old", name as "audit.new""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mktg nested",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; audit: { old: string; new: string } }>>()
            expect(row).toEqual({ id: 1, audit: { old: 'Marketing site', new: 'Mktg nested' } })
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-old-optional-column-as-nullable-via-oldValues', async () => {
        // An OPTIONAL old column returned via `oldValues()` driven through
        // `projectingOptionalValuesAsNullable()`. `tProject.archivedAt` is optional,
        // so `old.archived_at` in RETURNING is normally `oldArchivedAt?: Date`;
        // under the nullable projector it flips to a present `Date | null`. This is
        // the `_old_`-aliased synthetic-subquery projection × the nullable projector
        // — the two never co-occurred before. Project 2 (Internal tools) is active
        // (archived_at = NULL), and only its `name` is updated, so the OLD
        // archived_at is null (present, not absent) with no temporal write.
        ctx.mockNext({ oldArchivedAt: null, newName: 'Internal tools v2' })
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Internal tools v2' })
                .where(tProject.id.equals(2))
                .returning({
                    oldArchivedAt: oldProject.archivedAt,
                    newName:       tProject.name,
                })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { oldArchivedAt: Date | null; newName: string }>>()
            expect(row).toEqual({ oldArchivedAt: null, newName: 'Internal tools v2' })
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
    /*
    test('returning-old-optional-column-default-projector-drops-null-via-oldValues', async () => {
        // The default-projector twin of the test above: the SAME optional old
        // column (`tProject.archivedAt`) read via `oldValues()`, but WITHOUT
        // `.projectingOptionalValuesAsNullable()`. Under the default projector an
        // optional column whose value is NULL is DROPPED (absent key), not
        // surfaced as `| null` — so the RETURNING type is `{ oldArchivedAt?: Date }`
        // and the old NULL archived_at leaves `oldArchivedAt` absent from the row.
        // A distinct type-path (`?: Date` vs `| null`) and inhabitant (absent-key
        // vs present-null) over the `_old_`-aliased synthetic-subquery projection.
        // Project 2 (Internal tools) is active (archived_at = NULL) and only its
        // `name` is updated, so the OLD archived_at is null (→ dropped) with no
        // temporal write. The emitted SQL is identical to the nullable-projector
        // twin — the projector changes the result shape, not the query.
        ctx.mockNext({ oldArchivedAt: null, newName: 'Internal tools v2' })
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Internal tools v2' })
                .where(tProject.id.equals(2))
                .returning({
                    oldArchivedAt: oldProject.archivedAt,
                    newName:       tProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { oldArchivedAt?: Date; newName: string }>>()
            expect(row).toEqual({ newName: 'Internal tools v2' })
            expect('oldArchivedAt' in row).toBe(false)
        })
    })
    */
})
