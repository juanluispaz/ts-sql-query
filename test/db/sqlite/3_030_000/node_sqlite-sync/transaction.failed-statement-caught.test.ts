// A statement that fails inside a transaction, its error caught: on this database only that statement is undone, the
// rest of the transaction is saved and it commits (PostgreSQL rolls the whole transaction back instead). In mock mode
// the statement doesn't fail, and the transaction commits.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tCountry, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('transaction/failed-statement-caught-inside-a-transaction', async () => {
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(0)

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { events.push('after commit') })
                    connection.executeAfterNextRollback(() => { events.push('after rollback') })
                    sync(connection.insertInto(tProject).set({ name: 'Rolled back', slug: 'rolled-back', organizationId: 1 }).executeInsert())
                    try {
                        // The country US already exists
                        sync(connection.insertInto(tCountry).set({ code: 'US', name: 'Again', region: 'Americas' }).executeInsert())
                    } catch {
                        events.push('caught')
                    }
                })
            } catch (e) {
                caught = e
            }

            const saved = sync(connection.selectFrom(tProject)
                .where(tProject.slug.equals('rolled-back'))
                .selectCountAll()
                .executeSelectOne())

            if (ctx.realDbEnabled) {
                // Only the failed statement is undone: the project is saved, and the transaction commits
                expect(caught).toBeUndefined()
                expect(events).toEqual(['caught', 'after commit'])
                expect(saved).toBe(1)
            } else {
                expect(caught).toBeUndefined()
                expect(events).toEqual(['after commit'])
                expect(saved).toBe(0)
            }
        })
    })
})
