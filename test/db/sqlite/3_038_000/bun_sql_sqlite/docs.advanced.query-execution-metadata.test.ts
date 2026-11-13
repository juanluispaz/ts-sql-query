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
import { type FunctionExecutingQueryInformation } from '../../../../../src/queryRunners/QueryRunner.js'
import { getQueryContext, type QueryContext } from '../../../../../src/QueryContext.js'
import { tIssue, tProject, DBConnection } from '../../domain/connection.js'
import { InterceptorQueryRunner } from '../../../../../src/queryRunners/InterceptorQueryRunner.js'
import type { QueryRunner, QueryType } from '../../../../../src/queryRunners/QueryRunner.js'
import { ctx } from './setup.js'

interface ObservedMetadata {
    queryType: QueryType
    stack: string | undefined
    info: FunctionExecutingQueryInformation | undefined
    isCount: boolean
    name: string | undefined
    metadata: QueryContext['executionMetadata']
}

// What the page's runner reads in onQuery, kept for the assertion instead of logged.
const observed: ObservedMetadata[] = []

class MetadataReadingQueryRunner extends InterceptorQueryRunner<boolean> {
    onQuery(queryType: QueryType, query: string, params: Parameters<typeof getQueryContext>[1]): boolean {
        observed.push({
            queryType,
            stack: getQueryContext(query, params).executionStack,
            info: getQueryContext(query, params).functionExecutingQuery,
            isCount: getQueryContext(query, params).isSelectPageCount,
            name: getQueryContext(query, params).executionName,
            metadata: getQueryContext(query, params).executionMetadata,
        })
        return true
    }
    onQueryResult(): void {
    }
    onQueryError(): void {
    }
}

class MetadataReadingConnection extends DBConnection {
    constructor(queryRunner: QueryRunner, compatibilityVersion?: number) {
        super(new MetadataReadingQueryRunner(queryRunner), compatibilityVersion)
    }
}

async function functionRequestingTheQuery(connection: DBConnection) {
    return await connection.selectFrom(tProject)
        .where(tProject.id.equals(1))
        .select({ id: tProject.id, name: tProject.name })
        .customizeQuery({
            queryExecutionName: 'My query name',
            queryExecutionMetadata: { myMetadataProp: 'my metadata value' },
        })
        .executeSelectOne()
}

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
        const stack: string | undefined = getQueryContext(ctx.lastSql, ctx.lastParams).executionStack
        // doc-end
        expect(typeof stack).toBe('string')
        // The leading line is hard-coded by __setQueryMetadata.
        expect(stack).toMatch(/Query executed at/)
    })

    test('docs:query-execution-metadata/get-query-execution-source', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectOne()

        // doc-start
        const source: Error | undefined = getQueryContext(ctx.lastSql, ctx.lastParams).executionSource
        // doc-end
        expect(source).toBeInstanceOf(Error)
        expect(source?.stack).toBe(getQueryContext(ctx.lastSql, ctx.lastParams).executionStack)
    })

    test('docs:query-execution-metadata/get-function-executing-query', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await functionRequestingTheQuery(ctx.conn)

        // doc-start
        const info: FunctionExecutingQueryInformation | undefined =
            getQueryContext(ctx.lastSql, ctx.lastParams).functionExecutingQuery
        // doc-end
        expect(info?.functionName).toBe('functionRequestingTheQuery')
        expect(info?.fileName?.split('/').at(-1)).toBe('docs.advanced.query-execution-metadata.test.ts')
        expect(Number(info?.lineNumber)).toBeGreaterThan(0)
        expect(Number(info?.positionNumber)).toBeGreaterThan(0)
    })

    test('docs:query-execution-metadata/is-select-page-count-query', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectOne()

        // doc-start
        const isCount: boolean = getQueryContext(ctx.lastSql, ctx.lastParams).isSelectPageCount
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

        const name: string | undefined = getQueryContext(ctx.lastSql, ctx.lastParams).executionName
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

        const metadata: unknown = getQueryContext(ctx.lastSql, ctx.lastParams).executionMetadata
        expect(metadata).toEqual({ myMetadataProp: 'my metadata value' })
    })

    test('docs-extra:query-execution-metadata/is-select-page-count-query-true-on-page-count', async () => {
        // The count query inside executeSelectPage is the one and only
        // place the context of the query says `isSelectPageCount`. The
        // page promises this in prose; lock the contract in.
        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        ctx.mockNext(1)  // count: single int value
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectPage()
        // After executeSelectPage the LAST query is the count query.
        const isCount = getQueryContext(ctx.lastSql, ctx.lastParams).isSelectPageCount
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

        expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionName).toBeUndefined()
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionMetadata).toBeUndefined()
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

        expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionName).toBe('find-project')
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionMetadata).toEqual({ tag: 'hot-path' })
    })

    test('docs-extra:query-execution-metadata/insert-carries-name-and-metadata', async () => {
        // queryExecutionName / queryExecutionMetadata set via customizeQuery on an
        // INSERT ride through to the runner and are read back through the public
        // context of the query (getQueryContext). Read inside the rollback
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

            expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionName).toBe('insert-project')
            expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionMetadata).toEqual({ tag: 'insert-path' })
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

            expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionName).toBe('update-project')
            expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionMetadata).toEqual({ tag: 'update-path' })
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

            expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionName).toBe('delete-project')
            expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionMetadata).toEqual({ tag: 'delete-path' })
        })
    })

    test('docs-extra:query-execution-metadata/select-page-carries-name-and-metadata-on-count', async () => {
        // A queryExecutionName / queryExecutionMetadata set on an executeSelectPage
        // is retrievable by the interceptor on BOTH queries it runs: the data query
        // AND the auto-generated COUNT query (the one place isSelectPageCount is
        // true). The metadata is non-SQL — it rides through to the runner regardless
        // of the count query's shape — so a monitoring interceptor can label and tell
        // apart both halves of the page. This is the user-facing reason the customized
        // plain page's count is routed through the customization path.
        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        ctx.mockNext(3)
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.lessOrEqual(3))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                queryExecutionName:     'projects-page',
                queryExecutionMetadata: { tag: 'page-path' },
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        const data = ctx.history[0]!
        const count = ctx.history[1]!
        // data query: not the count, carries the name + metadata
        expect(getQueryContext(data.sql, data.params).isSelectPageCount).toBe(false)
        expect(getQueryContext(data.sql, data.params).executionName).toBe('projects-page')
        expect(getQueryContext(data.sql, data.params).executionMetadata).toEqual({ tag: 'page-path' })
        // count query: flagged as the page count AND carries the same name + metadata
        expect(getQueryContext(count.sql, count.params).isSelectPageCount).toBe(true)
        expect(getQueryContext(count.sql, count.params).executionName).toBe('projects-page')
        expect(getQueryContext(count.sql, count.params).executionMetadata).toEqual({ tag: 'page-path' })
    })

    test('docs-extra:query-execution-metadata/compound-select-carries-name-and-metadata', async () => {
        // queryExecutionName / queryExecutionMetadata set via customizeQuery on a
        // COMPOUND select (the distinct CompoundSelectCustomization surface) ride
        // through to the runner and are read back via the public helpers — the
        // metadata is non-SQL, so the union snapshot is unchanged. The second branch
        // matches nothing, so the mock returns just the first branch's row.
        ctx.mockNext([{ label: 'Marketing site' }])
        await ctx.conn.selectFrom(tProject).where(tProject.id.equals(1)).select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(99999)).select({ label: tIssue.title }))
            .customizeQuery({
                queryExecutionName:     'compound-select',
                queryExecutionMetadata: { tag: 'compound-path' },
            })
            .executeSelectMany()

        expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionName).toBe('compound-select')
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).executionMetadata).toEqual({ tag: 'compound-path' })
    })

    test('docs-extra:query-execution-metadata/interceptor-subclass-reads-metadata-in-on-query', async () => {
        observed.length = 0
        const connection = ctx.withConnection(MetadataReadingConnection)
        ctx.mockNext({ id: 1, name: 'Marketing site' })

        const row = await functionRequestingTheQuery(connection)

        expect(row).toEqual({ id: 1, name: 'Marketing site' })
        expect(observed.length).toBe(1)
        const seen = observed[0]!
        expect(seen.queryType).toBe('selectOneRow')
        expect(seen.isCount).toBe(false)
        expect(seen.name).toBe('My query name')
        expect(seen.metadata).toEqual({ myMetadataProp: 'my metadata value' })
    })

    test('docs-extra:query-execution-metadata/stack-names-builder-method-and-caller', async () => {
        observed.length = 0
        const connection = ctx.withConnection(MetadataReadingConnection)
        ctx.mockNext({ id: 1, name: 'Marketing site' })

        await functionRequestingTheQuery(connection)

        const stack = observed[0]!.stack
        expect(stack).toMatch(/^Query executed at\n/)
        expect(stack).toContain('executeSelectOne')
        expect(stack).toContain('functionRequestingTheQuery')
    })

    test('docs-extra:query-execution-metadata/function-executing-query-identifies-caller', async () => {
        observed.length = 0
        const connection = ctx.withConnection(MetadataReadingConnection)
        ctx.mockNext({ id: 1, name: 'Marketing site' })

        await functionRequestingTheQuery(connection)

        const info = observed[0]!.info
        expect(info?.functionName).toBe('functionRequestingTheQuery')
        expect(info?.fileName?.split('/').at(-1)).toBe('docs.advanced.query-execution-metadata.test.ts')
        expect(Number(info?.lineNumber)).toBeGreaterThan(0)
        expect(Number(info?.positionNumber)).toBeGreaterThan(0)
    })

    test('docs-extra:query-execution-metadata/function-executing-query-with-the-caller-in-the-last-frame', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectOne()

        const info = getQueryContext(ctx.lastSql, ctx.lastParams).functionExecutingQuery
        expect(info?.fileName?.split('/').at(-1)).toBe('docs.advanced.query-execution-metadata.test.ts')
        expect(Number(info?.lineNumber)).toBeGreaterThan(0)
    })

    test('docs-extra:query-execution-metadata/interceptor-subclass-detects-the-select-page-count', async () => {
        observed.length = 0
        const connection = ctx.withConnection(MetadataReadingConnection)
        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        ctx.mockNext(4)

        const page = await connection.selectFrom(tProject)
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .limit(1)
            .executeSelectPage()

        expect(page).toEqual({ data: [{ id: 1, name: 'Marketing site' }], count: 4 })
        expect(observed.map((seen) => seen.isCount)).toEqual([false, true])
    })
})
