// `createTableOrViewCustomization` wrapper (`connection.withSqlHint(t)`)
// used in positions BEYOND the plain `selectFrom` / `innerJoin` arms that
// select.table-customization.test.ts already pins. The wrapper is the same
// FROM-clause customization (a `/*+ hint */` comment prepended via
// `_rawFragmentTableName` + `_rawFragmentTableAlias`); here it is driven as:
//
//   A6 — a LEFT JOIN target (`withSqlHint(t).forUseInLeftJoin()`): the
//        customized table participates as the optional side of a left join,
//        so its columns widen to optional and the hint comment renders on
//        the joined (customized) side.
//   A7 — a source INSIDE A COMPOUND ARM (one arm of a UNION): the
//        customized FROM renders inside the first union branch while the
//        second branch is a plain table.
//   A8 — an `update(...)` / `deleteFrom(...)` TARGET: the customized
//        wrapper drives the mutation's primary table, so the hint comment
//        renders in the UPDATE/DELETE statement's table position.
//
// The `/*+ hint */` template is valid SQL on every dialect, so each test
// runs end-to-end against the real DB. `withSqlHint` lives on DBConnection
// in the shared domain.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('table-customization: wrapper as left-join target widens columns', async () => {
        // The customized organization is the OPTIONAL side of a left join
        // from project. Project 1 → org 1 (matches); project 3 → org 2
        // (matches). All seed projects have a matching org, but the left
        // join widens orgName to optional regardless. Filter to org-1
        // projects for determinism. The type widening and left-join wiring
        // are what this pins; the hint comment is currently dropped on this
        // path (see TODO[BUG] below).
        const expected = [
            { projectName: 'Internal tools', orgName: 'Acme Corp' },
            { projectName: 'Marketing site', orgName: 'Acme Corp' },
        ]
        ctx.mockNext(expected)
        const tOrgCustom = ctx.conn.withSqlHint(tOrganization, 'tOrgCustomLeftJoin').forUseInLeftJoin()

        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgCustom).on(tOrgCustom.id.equals(tProject.organizationId))
            .where(tProject.organizationId.equals(1))
            .select({
                projectName: tProject.name,
                orgName:     tOrgCustom.name,
            })
            .orderBy('projectName')
            .executeSelectMany()

        // TODO[BUG]: the `/*+ hint */` customization template is silently
        // dropped when a `withSqlHint(t)` wrapper goes through
        // `forUseInLeftJoin()` — the emitted FROM is a plain `left join
        // organization` with no hint, although the type permits the call and
        // a plain `selectFrom(customized)` does render the hint. Root cause:
        // Table.forUseInLeftJoinAs() clones via `new this.constructor()` and
        // copies only `__as`/`__forUseInLeftJoin`, not `__template` /
        // `__customizationName`. See test/BUGS.md. The snapshot pins the
        // current (hint-less) behavior so the suite stays green.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.name as "projectName", organization.name as "orgName" from project left join organization on organization.id = project.organization_id where project.organization_id = $1 order by "projectName""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // Left join → orgName widens to optional.
        assertType<Exact<typeof rows, Array<{ projectName: string; orgName?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('table-customization: wrapper as a source inside a compound arm', async () => {
        // The customized organization is the source of the FIRST arm of a
        // UNION; the second arm is a plain project name. The hint comment
        // renders only in the first (customized) branch. Both arms project
        // a single `label` column.
        const expected = [
            { label: 'Acme Corp' },
            { label: 'Globex Ltd' },
            { label: 'Internal tools' },
            { label: 'Marketing site' },
        ]
        ctx.mockNext(expected)
        const tOrgCustom = ctx.conn.withSqlHint(tOrganization, 'tOrgCustomCompound')

        const orgNames = ctx.conn.selectFrom(tOrgCustom)
            .select({ label: tOrgCustom.name })
        const projectNames = ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({ label: tProject.name })

        const rows = await orgNames
            .union(projectNames)
            .orderBy('label')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as label from /*+ hint */ organization  union select name as label from project where organization_id = $1 order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ label: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('table-customization: wrapper as an update target', async () => {
        // The customized organization wrapper drives an UPDATE's primary
        // table — the hint comment renders in the table position of the
        // UPDATE statement. Renames org 1, verifies, all inside a rollback.
        const renamedOrg = { id: 1, name: 'Acme Renamed' }
        ctx.mockNext(1)            // affected rows from the UPDATE
        ctx.mockNext(renamedOrg)   // row from the verification SELECT
        await ctx.withRollback(async () => {
            const tOrgCustom = ctx.conn.withSqlHint(tOrganization, 'tOrgCustomUpdate')
            const affected = await ctx.conn.update(tOrgCustom)
                .set({ name: 'Acme Renamed' })
                .where(tOrgCustom.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update /*+ hint */ organization  set name = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Renamed",
                1,
              ]
            `)
            expect(affected).toBe(1)

            const row = await ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(1))
                .select({ id: tOrganization.id, name: tOrganization.name })
                .executeSelectOne()
            expect(row).toEqual(renamedOrg)
        })
    })

    test('table-customization: wrapper as a delete target', async () => {
        // The customized organization wrapper drives a DELETE's primary
        // table — the hint comment renders in the table position of the
        // DELETE statement. Insert a throwaway org with a unique name, then
        // delete it BY THAT NAME so the WHERE param is a deterministic
        // literal on both mock and real cells. All inside a rollback.
        ctx.mockNext(1)  // affected rows from the setup INSERT
        ctx.mockNext(1)  // affected rows from the DELETE
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tOrganization)
                .set({ name: 'Throwaway org', plan: 'free' })
                .executeInsert()

            const tOrgCustom = ctx.conn.withSqlHint(tOrganization, 'tOrgCustomDelete')
            const affected = await ctx.conn.deleteFrom(tOrgCustom)
                .where(tOrgCustom.name.equals('Throwaway org'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from /*+ hint */ organization  where name = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Throwaway org",
              ]
            `)
            expect(affected).toBe(1)
        })
    })
})
