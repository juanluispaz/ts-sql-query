// What a type adapter writes in the context it receives reaches the context of the query the query runner reads: in
// transformValueToDB, whether the database receives the type of the parameter (forceTypeCast) and what the adapter
// keeps of the parameter (setMetadata); in transformPlaceholder, the index of the parameter and what was kept of it.
// The rows show the query still finds the project.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryContext } from '../../../../../src/exports/v2/index.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// The key under which the adapters of this file keep what they know of a parameter
const sentAt = Symbol('sentAt')

// Keeps the value it sends, under its own key
const keepingTheValue: TypeAdapter = {
    transformValueFromDB(value, type, typeCategory, context, next) {
        return next.transformValueFromDB(value, type, typeCategory, context)
    },
    transformValueToDB(value, type, typeCategory, context, next) {
        context.setMetadata(sentAt, 'value ' + String(value))
        return next.transformValueToDB(value, type, typeCategory, context)
    },
}

// Asks for the type of its parameter wherever it is written
const typingItsParameter: TypeAdapter = {
    transformValueFromDB(value, type, typeCategory, context, next) {
        return next.transformValueFromDB(value, type, typeCategory, context)
    },
    transformValueToDB(value, type, typeCategory, context, next) {
        context.forceTypeCast = true
        return next.transformValueToDB(value, type, typeCategory, context)
    },
}

// What transformPlaceholder sees of the parameter
const seenByThePlaceholder: Array<[number | undefined, boolean, string]> = []
const readingThePlaceholderContext: TypeAdapter = {
    transformValueFromDB(value, type, typeCategory, context, next) {
        return next.transformValueFromDB(value, type, typeCategory, context)
    },
    transformValueToDB(value, type, typeCategory, context, next) {
        context.setMetadata(sentAt, 'value ' + String(value))
        return next.transformValueToDB(value, type, typeCategory, context)
    },
    transformPlaceholder(placeholder, type, typeCategory, valueSentToDB, context, next) {
        seenByThePlaceholder.push([context.index, context.forceTypeCast, String(context.getMetadata(sentAt))])
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB, context)
    },
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('the-metadata-a-type-adapter-keeps-goes-with-its-parameter', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1, 'int', keepingTheValue)))
            .select({ id: tProject.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([{ id: 1 }])
        const param = getQueryContext(ctx.lastSql, ctx.lastParams).getParam(0)
        expect([param?.getMetadata(sentAt), param?.type, param?.typeCategory]).toEqual(['value 1', 'int', 'int'])
    })

    test('force-type-cast-of-a-type-adapter-goes-with-its-parameter', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1, 'int', typingItsParameter)))
            .select({ id: tProject.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([{ id: 1 }])
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).getParam(0)?.forceTypeCast).toBe(true)
    })

    test('the-placeholder-context-has-the-parameter-and-what-was-kept-of-it', async () => {
        seenByThePlaceholder.length = 0
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1, 'int', readingThePlaceholderContext)))
            .or(tProject.id.equals(ctx.conn.const(2, 'int', readingThePlaceholderContext)))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = ? or id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows.map(row => row.id)).toEqual([1, 2])
        expect(seenByThePlaceholder).toEqual([[0, false, 'value 1'], [1, false, 'value 2']])
    })
})
