// Documentation snippets for the Query execution metadata page
// (docs/advanced/query-execution-metadata.md). Exercises the helpers
// exposed under 'ts-sql-query/queryRunners/QueryRunner' that a custom
// InterceptorQueryRunner subclass uses to read per-query metadata.
//
// The doc page demonstrates each helper inside a custom runner
// (`DurationLogginQueryRunner extends InterceptorQueryRunner<void>`);
// here we exercise the helpers directly against `ctx.lastParams` after
// the captureInterceptor has recorded the actual params object
// ts-sql-query passed to the runner (the same object the docs runner
// receives in `onQuery(...)`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import {
    getQueryExecutionStack,
    getFunctionExecutingQuery,
    isSelectPageCountQuery,
    getQueryExecutionName,
    getQueryExecutionMetadata,
    type FunctionExecutingQueryInformation,
} from '../../../../../src/queryRunners/QueryRunner.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:query-execution-metadata/get-query-execution-stack', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectOne()

        // doc-start
        const stack: string | undefined = getQueryExecutionStack(ctx.lastSql, ctx.lastParams)
        // doc-end
        expect(typeof stack).toBe('string')
        // The leading line is hard-coded by __setQueryMetadata.
        expect(stack).toMatch(/Query executed at/)
    })

    test('docs:query-execution-metadata/get-function-executing-query', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectOne()

        // doc-start
        const info: FunctionExecutingQueryInformation | undefined =
            getFunctionExecutingQuery(ctx.lastSql, ctx.lastParams)
        // doc-end
        // The stack regex requires a recognisable frame after the
        // synthetic "Query executed at" header — present on Node/Bun.
        if (info !== undefined) {
            // Each property is independently optional; we only assert
            // the types stay aligned with the documented surface.
            if (info.fileName !== undefined) expect(typeof info.fileName).toBe('string')
            if (info.functionName !== undefined) expect(typeof info.functionName).toBe('string')
            if (info.lineNumber !== undefined) expect(typeof info.lineNumber).toBe('string')
            if (info.positionNumber !== undefined) expect(typeof info.positionNumber).toBe('string')
        }
    })

    test('docs:query-execution-metadata/is-select-page-count-query', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectOne()

        // doc-start
        const isCount: boolean = isSelectPageCountQuery(ctx.lastSql, ctx.lastParams)
        // doc-end
        expect(isCount).toBe(false)
    })

    test('docs:query-execution-metadata/get-query-execution-name', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })

        // doc-start
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
            }).customizeQuery({
                queryExecutionName: 'My query name',
            })
            .executeSelectOne()
        // doc-end

        const name: string | undefined = getQueryExecutionName(ctx.lastSql, ctx.lastParams)
        expect(name).toBe('My query name')
    })

    test('docs:query-execution-metadata/get-query-execution-metadata', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })

        // doc-start
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
            }).customizeQuery({
                queryExecutionMetadata: { myMetadataProp: 'my metadata value' },
            })
            .executeSelectOne()
        // doc-end

        const metadata: unknown = getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)
        expect(metadata).toEqual({ myMetadataProp: 'my metadata value' })
    })

    test('docs-extra:query-execution-metadata/is-select-page-count-query-true-on-page-count', async () => {
        // The count query inside executeSelectPage is the one and only
        // place ts-sql-query flags `$isSelectPageCountQuery=true`. The
        // page promises this in prose; lock the contract in.
        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        ctx.mockNext(1)  // count: single int value
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectPage()
        // After executeSelectPage the LAST query is the count query.
        const isCount = isSelectPageCountQuery(ctx.lastSql, ctx.lastParams)
        expect(isCount).toBe(true)
    })

    test('docs-extra:query-execution-metadata/no-customize-returns-undefined', async () => {
        // The page declares these helpers return `undefined` when the
        // matching customizeQuery field was not provided.
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectOne()

        expect(getQueryExecutionName(ctx.lastSql, ctx.lastParams)).toBeUndefined()
        expect(getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)).toBeUndefined()
    })

    test('docs-extra:query-execution-metadata/name-and-metadata-coexist', async () => {
        // Both can be provided in the same customizeQuery({…}) call.
        ctx.mockNext({ id: 1, name: 'Marketing site' })

        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .customizeQuery({
                queryExecutionName:     'find-project',
                queryExecutionMetadata: { tag: 'hot-path' },
            })
            .executeSelectOne()

        expect(getQueryExecutionName(ctx.lastSql, ctx.lastParams)).toBe('find-project')
        expect(getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)).toEqual({ tag: 'hot-path' })
    })

    test('docs-extra:query-execution-metadata/insert-carries-name-and-metadata', async () => {
        // queryExecutionName / queryExecutionMetadata set via customizeQuery on an
        // INSERT ride through to the runner and are read back through the public
        // getQueryExecutionName / getQueryExecutionMetadata. Read inside the rollback
        // (before it reverts) so ctx.lastSql/lastParams still reflect the insert.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Metadata demo', slug: 'meta-demo' })
                .customizeQuery({
                    queryExecutionName:     'insert-project',
                    queryExecutionMetadata: { tag: 'insert-path' },
                })
                .executeInsert()

            expect(getQueryExecutionName(ctx.lastSql, ctx.lastParams)).toBe('insert-project')
            expect(getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)).toEqual({ tag: 'insert-path' })
        })
    })

    test('docs-extra:query-execution-metadata/update-carries-name-and-metadata', async () => {
        // queryExecutionName / queryExecutionMetadata set via customizeQuery on an
        // UPDATE ride through to the runner. Update project 1's name inside a
        // rollback so the seed survives; the metadata is read before the revert.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tProject)
                .set({ name: 'Renamed' })
                .where(tProject.id.equals(1))
                .customizeQuery({
                    queryExecutionName:     'update-project',
                    queryExecutionMetadata: { tag: 'update-path' },
                })
                .executeUpdate()

            expect(getQueryExecutionName(ctx.lastSql, ctx.lastParams)).toBe('update-project')
            expect(getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)).toEqual({ tag: 'update-path' })
        })
    })

    test('docs-extra:query-execution-metadata/delete-carries-name-and-metadata', async () => {
        // queryExecutionName / queryExecutionMetadata set via customizeQuery on a
        // DELETE ride through to the runner. The WHERE matches no row (metadata rides
        // regardless of matches), keeping the delete FK-safe and its result
        // identical (0 rows) in mock and real modes.
        await ctx.withRollback(async () => {
            ctx.mockNext(0)
            await ctx.conn.deleteFrom(tProject)
                .where(tProject.id.equals(9999))
                .customizeQuery({
                    queryExecutionName:     'delete-project',
                    queryExecutionMetadata: { tag: 'delete-path' },
                })
                .executeDelete()

            expect(getQueryExecutionName(ctx.lastSql, ctx.lastParams)).toBe('delete-project')
            expect(getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)).toEqual({ tag: 'delete-path' })
        })
    })

})
