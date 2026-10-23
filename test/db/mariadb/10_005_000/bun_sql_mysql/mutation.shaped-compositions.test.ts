// A SHAPED insert/update chained into `customizeQuery(...)` and into the `returning`
// surface — the `shaped × customizeQuery` and `shaped × returning` combinations for
// both INSERT and UPDATE.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-insert-customize-query', async () => {
        // `insertInto(t).shapedAs({...}).set({...}).customizeQuery({...})` — the
        // shaped insert chained through the customization seam (a leading
        // comment fragment). The renamed keys still map to the real columns.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const inserted = await connection.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'Shaped + customize', projectSlug: 'shaped-customize' })
                .customizeQuery({ beforeQuery: connection.rawFragment`/* shaped-insert */ ` })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* shaped-insert */  insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped + customize",
                "shaped-customize",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-insert-returning-last-inserted-id', async () => {
        // `insertInto(t).shapedAs({...}).set({...}).returningLastInsertedId()` —
        // the shaped insert chained into the last-inserted-id returning seam.
        const mockId = 100
        ctx.mockNext(mockId)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'Shaped + returning id', projectSlug: 'shaped-ret-id' })
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped + returning id",
                "shaped-ret-id",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            // The generated id is non-deterministic on a real engine (seed
            // reserves project ids 1-4); the mock pins the exact queued value.
            if (!ctx.realDbEnabled) expect(id).toBe(mockId)
            else expect(id).toBeGreaterThan(4)
        })
    })

    test('shaped-update-customize-query', async () => {
        // `update(t).shapedAs({...}).set({...}).where(...).customizeQuery({...})` —
        // the shaped update chained through the customization seam.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Shaped update + customize' })
                .where(tProject.id.equals(1))
                .customizeQuery({ beforeQuery: connection.rawFragment`/* shaped-update */ ` })
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* shaped-update */  update project set name = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Shaped update + customize",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('shaped-update-returning-one-row', async () => {
        // `update(t).shapedAs({...}).set({...}).where(...).returning({...})` — the
        // shaped update chained into the RETURNING projection seam. The renamed
        // key drives the SET; the returning object reads the real columns back.
        // Project 1 is renamed and the new row is returned.
        const expected = { id: 1, name: 'Shaped update + returning' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Shaped update + returning' })
                .where(tProject.id.equals(1))
                .returning({ id: tProject.id, name: tProject.name })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ? where id = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Shaped update + returning",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('shaped-update-returning-nested-object', async () => {
        // A `shapedAs({...}).set({...})` update whose RETURNING folds the real columns
        // into a nested `audit` sub-object. The shaped SET map (renamed keys) is
        // orthogonal to the returning projection, which reads the REAL columns. The
        // mock is keyed by the flat emitted aliases (`audit.name`, `audit.slug`); the
        // complex projection reassembles them. Project 1 renamed; slug unchanged.
        const expected = { id: 1, audit: { name: 'Shaped nested returning', slug: 'mktg-site' } }
        ctx.mockNext({ id: 1, 'audit.name': 'Shaped nested returning', 'audit.slug': 'mktg-site' })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Shaped nested returning' })
                .where(tProject.id.equals(1))
                .returning({ id: tProject.id, audit: { name: tProject.name, slug: tProject.slug } })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number; audit: { name: string; slug: string } }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    test('shaped-update-extend-shape-then-dynamic-set', async () => {
        // `update(t).shapedAs({...}).extendShape({...}).dynamicSet({...})` on the
        // where-REQUIRED update path. `extendShape` is a shape *widener*, so it
        // stays in the opener family: `dynamicSet`/`set`/`setIfValue` remain
        // callable after it, matching the `updateAllowingNoWhere` twin and the
        // INSERT `extendShape`. The widened shape drives a two-column SET.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.update(tProject)
                .shapedAs({ projectName: 'name' })
                .extendShape({ projectSlug: 'slug' })
                .dynamicSet({ projectName: 'Widened shape', projectSlug: 'widened-shape' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ?, slug = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Widened shape",
                "widened-shape",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-update-extend-shape-then-set', async () => {
        // The `.set(...)` arm after `extendShape` on the where-REQUIRED update path
        // — the sibling of `shaped-update-extend-shape-then-dynamic-set` above (which
        // uses `.dynamicSet`). `set` reaches the same widened shape but through the
        // static setter opener, driving the same two-column SET.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.update(tProject)
                .shapedAs({ projectName: 'name' })
                .extendShape({ projectSlug: 'slug' })
                .set({ projectName: 'Widened via set', projectSlug: 'widened-via-set' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ?, slug = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Widened via set",
                "widened-via-set",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })


    test('shaped-update-extend-shape-then-no-arg-dynamic-set-opener', async () => {
        // The NO-ARG `dynamicSet()` opener on the shaped+extended where-REQUIRED
        // update builder — the sibling of `shaped-update-extend-shape-then-dynamic-set`
        // (which passes the columns straight to `dynamicSet({...})`). `dynamicSet()`
        // opens an empty dynamic set that a following `.set({...})` fills against the
        // widened shape, driving the same two-column SET.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .extendShape({ projectSlug: 'slug' })
                .dynamicSet()
                .set({ projectName: 'No-arg opener', projectSlug: 'no-arg-opener' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ?, slug = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "No-arg opener",
                "no-arg-opener",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-update-allowing-no-where-extend-shape-then-no-arg-dynamic-set-opener', async () => {
        // The same shaped+extended NO-ARG `dynamicSet()` opener on the
        // `updateAllowingNoWhere` twin — executable WITHOUT a WHERE, so it touches
        // every project row. Widens to (name, organization_id); organization 1 exists,
        // so re-pointing every project to it keeps the FK valid for all rows.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .extendShape({ orgId: 'organizationId' })
                .dynamicSet()
                .set({ projectName: 'No-where widened', orgId: 1 })
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ?, organization_id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "No-where widened",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })
})
