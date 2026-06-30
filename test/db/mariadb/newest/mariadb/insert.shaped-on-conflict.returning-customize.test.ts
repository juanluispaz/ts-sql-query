// SHAPED × ON CONFLICT × RETURNING × customizeQuery — the 4-way interaction on
// a single shaped upsert. A shaped insert (`.shapedAs({…}).set({…})`) reaches
// the targeted `onConflictOn(...).doUpdateSet({renamedKey})` arm, then chains
// BOTH `.returning({...})` AND `.customizeQuery({...})` on the resulting node.
// Pins that the shape (renamed key → real column), the on-conflict DO UPDATE,
// the RETURNING projection and the customize hook all compose on one statement.
//
// Shape: { orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' }.
// Seed (org 1, slug 'mktg-site') already exists as id 1, so the conflict fires,
// the DO UPDATE refreshes `name`, and RETURNING gives back id 1. RETURNING on
// INSERT is NOT-APPLICABLE on MySQL / MariaDB (commented out there in addition
// to oracle / sqlServer, which have no INSERT…ON CONFLICT).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Every test in this cell is NOT-APPLICABLE (see each block below); the imports are
// kept identical to the live cells for cross-cell symmetry, and these sentinels satisfy
// noUnusedLocals while the tests stay commented out.
void expect; void test; void assertType; void tProject
export type { Exact }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MariaDB does not support RETURNING on INSERT, and the targeted onConflictOn(...) opener is not typed on MariaDBConnection (ON DUPLICATE KEY UPDATE takes no conflict target)
    // test('shaped-on-conflict-do-update-returning-object-with-customize-hooks', async () => {
    //     // The 4-way composition: shaped renamed `projectName` maps back to `name`
    //     // on the DO UPDATE, `.returning({...})` projects the updated row, and
    //     // `.customizeQuery({ afterInsertKeyword })` lands the hint on the same
    //     // statement — all while the result type stays the exact non-optional row
    //     // (a targeted DO UPDATE always affects a row). The conflict fires (org 1,
    //     // 'mktg-site' is id 1), so the existing row is updated and returned.
    //     const expected = { id: 1, name: 'Renamed via 4-way', slug: 'mktg-site' }
    //     ctx.mockNext(expected)
    //     const connection = ctx.conn
    //     await ctx.withRollback(async () => {
    //         const row = await connection.insertInto(tProject)
    //             .shapedAs({
    //                 orgId:       'organizationId',
    //                 projectName: 'name',
    //                 projectSlug: 'slug',
    //             })
    //             .set({
    //                 orgId:       1,
    //                 projectName: 'ignored',
    //                 projectSlug: 'mktg-site',
    //             })
    //             .onConflictOn(tProject.organizationId, tProject.slug)
    //             .doUpdateSet({ projectName: 'Renamed via 4-way' })
    //             .returning({
    //                 id:   tProject.id,
    //                 name: tProject.name,
    //                 slug: tProject.slug,
    //             })
    //             .customizeQuery({ afterInsertKeyword: connection.rawFragment`/*+ hint */` })
    //             .executeInsertOne()
//
    //         expect(ctx.lastSql).toMatchInlineSnapshot(`"insert /*+ hint */ into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 returning id as id, name as name, slug as slug"`)
    //         expect(ctx.lastParams).toMatchInlineSnapshot(`
    //           [
    //             1,
    //             "ignored",
    //             "mktg-site",
    //             "Renamed via 4-way",
    //           ]
    //         `)
    //         assertType<Exact<typeof row, { id: number; name: string; slug: string }>>()
    //         expect(row).toEqual(expected)
    //     })
    // })

})
