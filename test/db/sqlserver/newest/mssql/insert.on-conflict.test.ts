// SQL Server does NOT support `INSERT … ON CONFLICT` syntax (its
// equivalent is the MERGE statement). The library excludes SQL Server
// from the on-conflict family at compile time. Kept here as commented
// stubs so the symmetry audit reports the same test names per cell;
// see the postgres/sqlite cells for the active implementation.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-nothing', async () => {
        // Not supported by SQL Server.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update', async () => {
        // Not supported by SQL Server.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-on-columns-do-update', async () => {
        // Not supported by SQL Server.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update-with-expression', async () => {
        // Not supported by this dialect: see active variant in sqlite / mariadb / mysql cells.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update-with-inserted-row-ref', async () => {
        // Not supported by this dialect: see active variant in sqlite / mariadb / mysql cells.
    })
    */

    // NOT-APPLICABLE: SQL Server has no ON CONFLICT ON CONSTRAINT
    /*
    test('on-conflict-on-constraint-do-nothing', async () => {
        // `.onConflictOnConstraint(rawFragment`name`)` — PostgreSQL accepts
        // both `(cols)` and `ON CONSTRAINT name` as conflict targets. The
        // constraint name is supplied as a raw SQL fragment because it is a
        // SQL identifier (must come from DB introspection, not from runtime
        // values). The unique constraint `app_user_email_key` is the
        // PostgreSQL default name for the inline `email VARCHAR(255) NOT
        // NULL UNIQUE` declaration in domain/schema.sql.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })  // collides with seed
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doNothing()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof inserted).toBe('number')
            } else {
                expect(inserted).toBe(0)
            }
        })
    })
    */
})
