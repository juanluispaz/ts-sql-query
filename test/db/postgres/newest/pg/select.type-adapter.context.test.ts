// What a type adapter writes in the context it receives reaches the context of the query the query runner reads: in
// transformValueToDB, whether the database receives the type of the parameter (forceTypeCast) and what the adapter
// keeps of the parameter (setMetadata); in transformPlaceholder, the index of the parameter and what was kept of it.
// The rows show the query still finds the project.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryContext } from '../../../../../src/exports/v2/index.js'
import type { TypeAdapter, TypeAdapterValueToDBContext } from '../../../../../src/TypeAdapter.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// The key under which the adapters of this file keep what they know of a parameter
const sentAt = Symbol('sentAt')

// Keeps the value it sends, under its own key
const keepingTheValue: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        context.setMetadata(sentAt, 'value ' + String(value))
        return next.transformValueToDB(value, context)
    },
}

// Asks for the type of its parameter wherever it is written
const typingItsParameter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        context.forceTypeCast = true
        return next.transformValueToDB(value, context)
    },
}

// What transformPlaceholder sees of the parameter
const seenByThePlaceholder: Array<[number | undefined, boolean, string]> = []
const readingThePlaceholderContext: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        context.setMetadata(sentAt, 'value ' + String(value))
        return next.transformValueToDB(value, context)
    },
    transformPlaceholder(placeholder, context, next) {
        seenByThePlaceholder.push([context.index, context.forceTypeCast, String(context.getMetadata(sentAt))])
        return next.transformPlaceholder(placeholder, context)
    },
}

// The key under which the adapter of this file keeps what it saw of the query
const seenInTheQuery = Symbol('seenInTheQuery')

// Keeps, in the query, what each transform sees, in the order the library calls them
function keepInTheQuery(context: Pick<TypeAdapterValueToDBContext, 'getQueryMetadata' | 'setQueryMetadata'>, seen: string): void {
    const before = context.getQueryMetadata(seenInTheQuery)
    context.setQueryMetadata(seenInTheQuery, (typeof before === 'string' ? before + ' | ' : '') + seen)
}
const keepingTheQuery: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        keepInTheQuery(context, 'sent ' + String(value))
        return next.transformValueToDB(value, context)
    },
    transformPlaceholder(placeholder, context, next) {
        keepInTheQuery(context, 'placeholder ' + String(context.index))
        return next.transformPlaceholder(placeholder, context)
    },
    transformProjection(sql, context, next) {
        keepInTheQuery(context, 'projection ' + context.output)
        return next.transformProjection(sql, context)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([{ id: 1 }])
        const param = getQueryContext(ctx.lastSql, ctx.lastParams).getParam(0)
        expect([param?.getMetadata(sentAt), param?.originalType, param?.originalCustomType, param?.requestedType]).toEqual(['value 1', 'int', undefined, 'int'])
    })

    test('force-type-cast-of-a-type-adapter-goes-with-its-parameter', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1, 'int', typingItsParameter)))
            .select({ id: tProject.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = $1::int4"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = $1 or id = $2 order by id"`)
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
    test('the-metadata-a-type-adapter-keeps-of-the-query', async () => {
        ctx.mockNext([{ id: 1, two: 2 }])
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1, 'int', keepingTheQuery)))
            .select({ id: tProject.id, two: ctx.conn.const(2, 'int', keepingTheQuery) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, $1::int4 as two from project where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number, two: number }>>>()
        expect(rows).toEqual([{ id: 1, two: 2 }])
        // What the transforms only looked at isn't kept
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).getMetadata(seenInTheQuery)).toMatchInlineSnapshot(`"sent 2 | placeholder 0 | projection resultColumn | sent 1 | placeholder 1"`)
    })
})
