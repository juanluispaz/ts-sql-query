// Per-connection coverage of MariaDBConnection's `useSimultaneousAssignment`
// flag. MariaDB computes the assignments of the set of an update from left to
// right, each one reading what an earlier one wrote, unless the sql_mode of the
// session has SIMULTANEOUS_ASSIGNMENT; then it reads the row as it was before
// the update, as the other databases. The flag says the session has it, and the
// set is written as it is given, also with a returning.
//
// The session gets SIMULTANEOUS_ASSIGNMENT inside the transaction of the test,
// and its sql_mode is restored at the end (a rollback doesn't restore it).
// Seed (project): 1 'Marketing site' / 'mktg-site'.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

class SimultaneousAssignmentConnection extends DBConnection {
    protected override useSimultaneousAssignment = true
}

async function withSimultaneousAssignment(body: () => Promise<void>): Promise<void> {
    ctx.mockNext('STRICT_TRANS_TABLES')
    const sqlMode = await ctx.conn.queryRunner.executeSelectOneColumnOneRow('select @@session.sql_mode', [])
    await ctx.conn.queryRunner.executeConnectionConfiguration("set session sql_mode = concat(@@session.sql_mode, ',SIMULTANEOUS_ASSIGNMENT')", [])
    try {
        await body()
    } finally {
        // A sql_mode is a list of names: letters, digits, underscores and commas
        if (typeof sqlMode !== 'string' || !/^[A-Z0-9_,]*$/.test(sqlMode)) {
            throw new Error('Unexpected sql_mode: ' + String(sqlMode))
        }
        await ctx.conn.queryRunner.executeConnectionConfiguration("set session sql_mode = '" + sqlMode + "'", [])
    }
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('simultaneous-assignment: a set that swaps two columns is written as it is and swaps them', async () => {
        const conn = ctx.withConnection(SimultaneousAssignmentConnection)
        await ctx.withRollback(async () => {
            await withSimultaneousAssignment(async () => {
                ctx.mockNext(1)
                const count = await conn.update(tProject)
                    .set({ name: tProject.slug, slug: tProject.name })
                    .where(tProject.id.equals(1))
                    .executeUpdate()
                expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = slug, slug = name where id = ?"`)
                expect(ctx.lastParams).toMatchInlineSnapshot(`
                  [
                    1,
                  ]
                `)
                expect(count).toBe(1)

                const expected = { name: 'mktg-site', slug: 'Marketing site' }
                ctx.mockNext(expected)
                const row = await conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .select({ name: tProject.name, slug: tProject.slug })
                    .executeSelectOne()
                expect(row).toEqual(expected)
            })
        })
    })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092), newer than this tier's engine.
    /*
    test('simultaneous-assignment: a set that swaps two columns returns them swapped', async () => {
        const conn = ctx.withConnection(SimultaneousAssignmentConnection)
        await ctx.withRollback(async () => {
            await withSimultaneousAssignment(async () => {
                const expected = { name: 'mktg-site', slug: 'Marketing site' }
                ctx.mockNext(expected)
                const row = await conn.update(tProject)
                    .set({ name: tProject.slug, slug: tProject.name })
                    .where(tProject.id.equals(1))
                    .returning({ name: tProject.name, slug: tProject.slug })
                    .executeUpdateOne()
                expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = slug, slug = name where id = ? returning name as name, slug as slug"`)
                expect(ctx.lastParams).toMatchInlineSnapshot(`
                  [
                    1,
                  ]
                `)
                assertType<Exact<typeof row, { name: string; slug: string }>>()
                expect(row).toEqual(expected)
            })
        })
    })
    */
})
