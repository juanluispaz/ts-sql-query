// An invalid value says where it is: in a set, `columnPath` has the property, with the
// name used in a shape, and `rowIndex` has the row when several are inserted; in a row
// of a `Values`, `valuesName` has its name too; `paramIndex` is the position, from 0,
// the value would have in the parameters of the query.
// Nothing reaches the database: the value is refused while the query is built.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { Values } from '../../../../../src/Values.js'
import { type DBConnection, tIssue, tProject } from '../../domain/connection.js'
import { sync } from '../../../../../src/extras/sync.js'
import { ctx } from './setup.js'

function rejectionOf(run: () => Promise<unknown>) {
    try {
        sync(run())
        return undefined
    } catch (e) {
        return e
    }
}

function positionOf(e: unknown) {
    if (e instanceof TsSqlQueryExecutionError && e.errorReason.reason === 'INVALID_VALUE_TO_SEND_TO_DATABASE') {
        return { columnPath: e.errorReason.columnPath, rowIndex: e.errorReason.rowIndex, valuesName: e.errorReason.valuesName, paramIndex: e.errorReason.paramIndex }
    }
    return undefined
}

class VIssueTitle extends Values<DBConnection, 'issueTitle'> {
    id    = this.column('int')
    title = this.column('string')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const validIssue = { projectId: 1, number: 1, title: 'x', status: 'open', priority: 1 }

    test('insert-set-tells-the-property', () => {
        const caught = rejectionOf(() => ctx.conn.insertInto(tIssue)
            .set({ ...validIssue, title: 5 as any })
            .executeInsert())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "title",
            "paramIndex": 2,
            "rowIndex": undefined,
            "valuesName": undefined,
          }
        `)
    })

    test('insert-values-tells-the-property', () => {
        const caught = rejectionOf(() => ctx.conn.insertInto(tIssue)
            .values({ ...validIssue, title: 5 as any })
            .executeInsert())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "title",
            "paramIndex": 2,
            "rowIndex": undefined,
            "valuesName": undefined,
          }
        `)
    })

    test('insert-shaped-tells-the-property-of-the-shape', () => {
        const notAString: string = 5 as any
        const caught = rejectionOf(() => ctx.conn.insertInto(tProject)
            .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
            .values({ orgId: 1, projectName: notAString, projectSlug: 'shaped' })
            .executeInsert())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "projectName",
            "paramIndex": 1,
            "rowIndex": undefined,
            "valuesName": undefined,
          }
        `)
    })

    test('insert-of-several-rows-tells-the-row-and-the-property', () => {
        const caught = rejectionOf(() => ctx.conn.insertInto(tIssue)
            .values([validIssue, { ...validIssue, number: 2, title: 5 as any }])
            .executeInsert())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "title",
            "paramIndex": 7,
            "rowIndex": 1,
            "valuesName": undefined,
          }
        `)
    })

    test('insert-of-several-rows-shaped-tells-the-row-and-the-property-of-the-shape', () => {
        const notAString: string = 5 as any
        const caught = rejectionOf(() => ctx.conn.insertInto(tProject)
            .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
            .values([
                { orgId: 1, projectName: 'x', projectSlug: 'shaped-1' },
                { orgId: 1, projectName: notAString, projectSlug: 'shaped-2' },
            ])
            .executeInsert())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "projectName",
            "paramIndex": 4,
            "rowIndex": 1,
            "valuesName": undefined,
          }
        `)
    })

    test('update-set-tells-the-property', () => {
        const caught = rejectionOf(() => ctx.conn.update(tIssue)
            .set({ title: 5 as any })
            .where(tIssue.id.equals(1))
            .executeUpdate())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "title",
            "paramIndex": 0,
            "rowIndex": undefined,
            "valuesName": undefined,
          }
        `)
    })

    test('update-shaped-tells-the-property-of-the-shape', () => {
        const caught = rejectionOf(() => ctx.conn.update(tIssue)
            .shapedAs({ name: 'title' })
            .set({ name: 5 as any })
            .where(tIssue.id.equals(1))
            .executeUpdate())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "name",
            "paramIndex": 0,
            "rowIndex": undefined,
            "valuesName": undefined,
          }
        `)
    })

    test('update-of-a-conflict-tells-the-property', () => {
        const caught = rejectionOf(() => ctx.conn.insertInto(tIssue)
            .set(validIssue)
            .onConflictOn(tIssue.id)
            .doUpdateSet({ title: 5 as any })
            .executeInsert())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "title",
            "paramIndex": 5,
            "rowIndex": undefined,
            "valuesName": undefined,
          }
        `)
    })

    test('a-value-outside-of-a-set-tells-the-position-of-its-parameter', () => {
        const caught = rejectionOf(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .and(tIssue.title.equals(5 as any))
            .select({ id: tIssue.id })
            .executeSelectMany())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": undefined,
            "paramIndex": 1,
            "rowIndex": undefined,
            "valuesName": undefined,
          }
        `)
    })

    test('values-create-tells-the-row-and-the-property', () => {
        const titles = Values.create(VIssueTitle, 'issueTitle', [
            { id: 1, title: 'x' },
            { id: 2, title: 5 as any },
        ])
        const caught = rejectionOf(() => ctx.conn.selectFrom(titles)
            .select({ id: titles.id })
            .executeSelectMany())
        expect(positionOf(caught)).toMatchInlineSnapshot(`
          {
            "columnPath": "title",
            "paramIndex": 3,
            "rowIndex": 1,
            "valuesName": "issueTitle",
          }
        `)
    })
})
