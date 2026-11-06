// The path of a property can be longer than what the database keeps of an identifier.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-long-path-of-a-required-column-is-read', async () => {
        const expected = { aVeryLongPropertyNameThatGoesOnAndOn: { anotherVeryLongPropertyNameThatGoesOnAndOn: { title: 'Redesign navbar' } } }
        ctx.mockNext({ 'aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.title': 'Redesign navbar' })
        const row = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ aVeryLongPropertyNameThatGoesOnAndOn: { anotherVeryLongPropertyNameThatGoesOnAndOn: { title: tIssue.title } } })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as "aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.title" from issue where id = ?1"`)
        expect(row).toEqual(expected)
    })

    test('a-long-path-of-an-optional-column-keeps-its-value', async () => {
        const expected = { id: 2, aVeryLongPropertyNameThatGoesOnAndOn: { anotherVeryLongPropertyNameThatGoesOnAndOn: { body: 'Use new tokens' } } }
        ctx.mockNext({ id: 2, 'aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.body': 'Use new tokens' })
        const row = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, aVeryLongPropertyNameThatGoesOnAndOn: { anotherVeryLongPropertyNameThatGoesOnAndOn: { body: tIssue.body } } })
            .executeSelectOne())
        expect(row).toEqual(expected)
    })

    test('two-long-paths-with-the-same-beginning-are-different-columns', async () => {
        const expected = { aVeryLongPropertyNameThatGoesOnAndOn: { anotherVeryLongPropertyNameThatGoesOnAndOn: { title: 'Redesign navbar', status: 'in_progress' } } }
        ctx.mockNext({
            'aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.title': 'Redesign navbar',
            'aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.status': 'in_progress',
        })
        const row = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ aVeryLongPropertyNameThatGoesOnAndOn: { anotherVeryLongPropertyNameThatGoesOnAndOn: { title: tIssue.title, status: tIssue.status } } })
            .orderBy('aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.title')
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as "aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.title", status as "aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.status" from issue where id = ?1 order by "aVeryLongPropertyNameThatGoesOnAndOn.anotherVeryLongPropertyNameThatGoesOnAndOn.title""`)
        expect(row).toEqual(expected)
    })
})
