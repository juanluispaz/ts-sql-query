// An invalid value in a set says where it is: `columnPath` has the property of the set,
// with the name used in a shape, and `rowIndex` has the row when several are inserted.
// Nothing reaches the database: the value is refused while the query is built.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

async function rejectionOf(run: () => Promise<unknown>) {
    try {
        await run()
        return undefined
    } catch (e) {
        return e
    }
}

function positionOf(e: unknown) {
    if (e instanceof TsSqlQueryExecutionError && e.errorReason.reason === 'INVALID_VALUE_TO_SEND_TO_DATABASE') {
        return { columnPath: e.errorReason.columnPath, rowIndex: e.errorReason.rowIndex }
    }
    return undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const validIssue = { projectId: 1, number: 1, title: 'x', status: 'open', priority: 1 }

    test('insert-set-tells-the-property', async () => {
        const caught = await rejectionOf(() => ctx.conn.insertInto(tIssue)
            .set({ ...validIssue, title: 5 as any })
            .executeInsert())
        expect(positionOf(caught)).toEqual({ columnPath: 'title', rowIndex: undefined })
    })

    test('insert-values-tells-the-property', async () => {
        const caught = await rejectionOf(() => ctx.conn.insertInto(tIssue)
            .values({ ...validIssue, title: 5 as any })
            .executeInsert())
        expect(positionOf(caught)).toEqual({ columnPath: 'title', rowIndex: undefined })
    })

    test('insert-shaped-tells-the-property-of-the-shape', async () => {
        const notAString: string = 5 as any
        const caught = await rejectionOf(() => ctx.conn.insertInto(tProject)
            .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
            .values({ orgId: 1, projectName: notAString, projectSlug: 'shaped' })
            .executeInsert())
        expect(positionOf(caught)).toEqual({ columnPath: 'projectName', rowIndex: undefined })
    })

    test('insert-of-several-rows-tells-the-row-and-the-property', async () => {
        const caught = await rejectionOf(() => ctx.conn.insertInto(tIssue)
            .values([validIssue, { ...validIssue, number: 2, title: 5 as any }])
            .executeInsert())
        expect(positionOf(caught)).toEqual({ columnPath: 'title', rowIndex: 1 })
    })

    test('insert-of-several-rows-shaped-tells-the-row-and-the-property-of-the-shape', async () => {
        const notAString: string = 5 as any
        const caught = await rejectionOf(() => ctx.conn.insertInto(tProject)
            .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
            .values([
                { orgId: 1, projectName: 'x', projectSlug: 'shaped-1' },
                { orgId: 1, projectName: notAString, projectSlug: 'shaped-2' },
            ])
            .executeInsert())
        expect(positionOf(caught)).toEqual({ columnPath: 'projectName', rowIndex: 1 })
    })

    test('update-set-tells-the-property', async () => {
        const caught = await rejectionOf(() => ctx.conn.update(tIssue)
            .set({ title: 5 as any })
            .where(tIssue.id.equals(1))
            .executeUpdate())
        expect(positionOf(caught)).toEqual({ columnPath: 'title', rowIndex: undefined })
    })

    test('update-shaped-tells-the-property-of-the-shape', async () => {
        const caught = await rejectionOf(() => ctx.conn.update(tIssue)
            .shapedAs({ name: 'title' })
            .set({ name: 5 as any })
            .where(tIssue.id.equals(1))
            .executeUpdate())
        expect(positionOf(caught)).toEqual({ columnPath: 'name', rowIndex: undefined })
    })

    test('update-of-a-conflict-tells-the-property', async () => {
        const caught = await rejectionOf(() => ctx.conn.insertInto(tIssue)
            .set(validIssue)
            .onConflictOn(tIssue.id)
            .doUpdateSet({ title: 5 as any })
            .executeInsert())
        expect(positionOf(caught)).toEqual({ columnPath: 'title', rowIndex: undefined })
    })

    test('a-value-outside-of-a-set-has-no-position', async () => {
        const caught = await rejectionOf(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equals(5 as any))
            .select({ id: tIssue.id })
            .executeSelectMany())
        expect(positionOf(caught)).toEqual({ columnPath: undefined, rowIndex: undefined })
    })
})
