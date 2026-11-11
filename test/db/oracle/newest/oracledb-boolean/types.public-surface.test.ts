// The public entry points and the loose helpers of the library: the root entry and
// the compatibility entry re-export the same objects and types as their subpaths,
// the error classes, the type adapters, the isolation level type, and shapes of
// Values, Table and the deep utilities where the type and the value are compared
// on the same input.

import { existsSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/queryIntrospection.js'
import type { Connection, TransactionIsolationLevel } from '../../../../../src/Connection.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel } from '../../../../../src/dynamic/condition.js'
import type { OrderByForModel, OrderByMode } from '../../../../../src/dynamic/orderBy.js'
import { deepOmit, deepPick, type DeepOmit, type DeepPick, type DeepPickPaths } from '../../../../../src/extras/deepUtilities.js'
import { sync } from '../../../../../src/extras/sync.js'
import { Table } from '../../../../../src/Table.js'
import { QueryExecutionSource, TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError, type TsSqlDatabaseErrorCode, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason, type TsSqlInternalErrorReason } from '../../../../../src/TsSqlError.js'
import { CustomBooleanTypeAdapter, ForceTypeCast, type DefaultTypeAdapter, type TypeAdapter, type ProjectionComparison, type ProjectionOutput, type TypeCategory } from '../../../../../src/TypeAdapter.js'
import { getQueryParamMetadata, queryParamForceTypeCast, queryParamType, queryParamTypeCategory, setQueryParamMetadata } from '../../../../../src/QueryMetadata.js'
import { Values, type OpaqueValues } from '../../../../../src/Values.js'
import { View } from '../../../../../src/View.js'
import { type DBConnection, tCountry, tIssue, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'
import * as root from '../../../../../src/exports/v2/index.js'
import * as compat from '../../../../../src/exports/v1/dynamicCondition.js'
import * as dynamicPickModule from '../../../../../src/dynamic/pick.js'
import * as extrasTypes from '../../../../../src/extras/types.js'
import * as extrasUtils from '../../../../../src/extras/utils.js'

interface Model {
    id: number
    nullable: { a: number; b: string } | null
    undefinable: { a: number; b: string } | undefined
    optional?: { a: number; b: string }
}

// Records what reaches the default adapter: the arguments are the observable of a
// type adapter's delegation.
class RecordingAdapter implements DefaultTypeAdapter {
    calls: string[] = []
    transformValueFromDB(value: unknown, type: string, _typeCategory: TypeCategory): unknown {
        this.calls.push(JSON.stringify(['from', value, type]))
        return 'from-result'
    }
    transformValueToDB(value: unknown, type: string, _typeCategory: TypeCategory): unknown {
        this.calls.push(JSON.stringify(['to', value, type]))
        return 'to-result'
    }
    transformPlaceholder(placeholder: string, type: string, _typeCategory: TypeCategory, valueSentToDB: unknown): string {
        this.calls.push(JSON.stringify(['placeholder', placeholder, type, valueSentToDB]))
        return 'placeholder-result'
    }
    forceTypeCast(type: string, _typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean {
        this.calls.push(JSON.stringify(['forceTypeCast', type, valueSentToDB, forceTypeCast]))
        return forceTypeCast
    }
    transformProjection(sql: string, type: string, _typeCategory: TypeCategory, output: ProjectionOutput): string {
        this.calls.push(JSON.stringify(['projection', sql, type, output]))
        return sql
    }
    projectionComparison(type: string, _typeCategory: TypeCategory, output: ProjectionOutput): ProjectionComparison {
        this.calls.push(JSON.stringify(['comparison', type, output]))
        return 'value'
    }
    addQueryParamMetadata(_params: unknown[], index: number, type: string, _typeCategory: TypeCategory, valueSentToDB: unknown): void {
        this.calls.push(JSON.stringify(['metadata', index, type, valueSentToDB]))
    }
}

class VSource extends Values<DBConnection, 'vSource'> {
    id = this.column('int')
    label = this.optionalColumn('string')
    doubled = this.virtualColumnFromFragment('int', (fragment) => fragment.sql`${this.id} * 2`)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('root-entry-values-are-the-subpath-objects', () => {
        expect(Object.keys(root).sort()).toEqual([
            'ConsoleLogNoopQueryRunner', 'ConsoleLogQueryRunner', 'CustomBooleanTypeAdapter', 'ForceTypeCast', 'InterceptorQueryRunner',
            'LoggingQueryRunner', 'MockQueryRunner', 'NoopQueryRunner', 'QueryExecutionSource', 'Table', 'TsSqlError', 'TsSqlProcessingError',
            'TsSqlQueryExecutionError', 'Values', 'View', 'deepOmit', 'deepPick', 'dynamicPick', 'dynamicPickPaths',
            'expandTypeFromDynamicPickPaths', 'expandTypeProjectedAsNullableFromDynamicPickPaths',
            'extractAutogeneratedIdColumnNamesFrom', 'extractAutogeneratedIdColumnsFrom', 'extractColumnNamesFrom', 'extractColumnsFrom',
            'extractIdColumnNamesFrom', 'extractIdColumnsFrom', 'extractProvidedIdColumnNamesFrom', 'extractProvidedIdColumnsFrom',
            'extractWritableColumnNamesFrom', 'extractWritableColumnsFrom', 'extractWritableShapeFrom', 'fromRef',
            'getFunctionExecutingQuery', 'getQueryConnectionConfiguration', 'getQueryExecutionMetadata', 'getQueryExecutionName',
            'getQueryExecutionSource', 'getQueryExecutionStack', 'getQueryParamForceTypeCast', 'getQueryParamMetadata', 'getQueryParamType',
            'getQueryParamTypeCategory', 'getQueryResultColumn', 'getQueryResultColumns', 'isQueryParamValueForColumn', 'isSelectPageCountQuery',
            'queryParamForceTypeCast', 'queryParamType', 'queryParamTypeCategory', 'setQueryParamMetadata', 'sync',
        ])
        expect(root.Table).toBe(Table)
        expect(root.View).toBe(View)
        expect(root.Values).toBe(Values)
        expect(root.CustomBooleanTypeAdapter).toBe(CustomBooleanTypeAdapter)
        expect(root.ForceTypeCast).toBe(ForceTypeCast)
        expect(root.setQueryParamMetadata).toBe(setQueryParamMetadata)
        expect(root.getQueryParamMetadata).toBe(getQueryParamMetadata)
        expect(root.queryParamType).toBe(queryParamType)
        expect(root.queryParamTypeCategory).toBe(queryParamTypeCategory)
        expect(root.queryParamForceTypeCast).toBe(queryParamForceTypeCast)
        expect(root.TsSqlError).toBe(TsSqlError)
        expect(root.TsSqlProcessingError).toBe(TsSqlProcessingError)
        expect(root.TsSqlQueryExecutionError).toBe(TsSqlQueryExecutionError)
        expect(root.QueryExecutionSource).toBe(QueryExecutionSource)
        expect(root.dynamicPick).toBe(dynamicPickModule.dynamicPick)
        expect(root.dynamicPickPaths).toBe(dynamicPickModule.dynamicPickPaths)
        expect(root.expandTypeFromDynamicPickPaths).toBe(dynamicPickModule.expandTypeFromDynamicPickPaths)
        expect(root.expandTypeProjectedAsNullableFromDynamicPickPaths).toBe(dynamicPickModule.expandTypeProjectedAsNullableFromDynamicPickPaths)
        expect(root.fromRef).toBe(extrasTypes.fromRef)
        expect(root.sync).toBe(sync)
        expect(root.deepPick).toBe(deepPick)
        expect(root.deepOmit).toBe(deepOmit)
        for (const [name, utility] of Object.entries(extrasUtils)) {
            expect(Reflect.get(root, name)).toBe(utility)
        }
    })

    test('root-entry-types-are-the-subpath-types', () => {
        type Db = typeof ctx.conn extends Connection<infer DB> ? DB : false
        type Columns = { id: typeof tCountry.code; name: typeof tCountry.name }
        type T = typeof tCountry
        assertType<Exact<root.Connection<Db>, Connection<Db>>>()
        assertType<Exact<root.TransactionIsolationLevel<Db>, TransactionIsolationLevel<Db>>>()
        assertType<Exact<root.DefaultTypeAdapter, DefaultTypeAdapter>>()
        assertType<Exact<root.TypeAdapter, TypeAdapter>>()
        assertType<Exact<root.ProjectionOutput, ProjectionOutput>>()
        assertType<Exact<root.ProjectionComparison, ProjectionComparison>>()
        assertType<Exact<root.OpaqueValues, OpaqueValues>>()
        assertType<Exact<root.TsSqlDatabaseErrorCode, TsSqlDatabaseErrorCode>>()
        assertType<Exact<root.TsSqlDatabaseErrorNumber, TsSqlDatabaseErrorNumber>>()
        assertType<Exact<root.TsSqlInternalErrorReason, TsSqlInternalErrorReason>>()
        assertType<Exact<root.TsSqlErrorReason, TsSqlErrorReason>>()
        assertType<Exact<root.Pickable, dynamicPickModule.Pickable>>()
        assertType<Exact<root.DynamicPick<Columns>, dynamicPickModule.DynamicPick<Columns>>>()
        assertType<Exact<root.DynamicPickPaths<Columns>, dynamicPickModule.DynamicPickPaths<Columns>>>()
        assertType<Exact<root.PickValuesPath<Columns, 'id'>, dynamicPickModule.PickValuesPath<Columns, 'id'>>>()
        assertType<Exact<root.PickValuesPathWithAllProperties<Columns, 'id'>, dynamicPickModule.PickValuesPathWithAllProperties<Columns, 'id'>>>()
        assertType<Exact<root.PickValuesPathProjectedAsNullable<Columns, 'id'>, dynamicPickModule.PickValuesPathProjectedAsNullable<Columns, 'id'>>>()
        assertType<Exact<root.PickValuesPathWithAllPropertiesProjectedAsNullable<Columns, 'id'>, dynamicPickModule.PickValuesPathWithAllPropertiesProjectedAsNullable<Columns, 'id'>>>()
        assertType<Exact<root.DynamicCondition<{ id: 'int' }>, DynamicCondition<{ id: 'int' }>>>()
        assertType<Exact<root.DynamicConditionForModel<{ id: number }>, DynamicConditionForModel<{ id: number }>>>()
        assertType<Exact<root.DynamicDefinitionForModel<{ id: number }>, DynamicDefinitionForModel<{ id: number }>>>()
        assertType<Exact<root.OrderByForModel<{ id: number }>, OrderByForModel<{ id: number }>>>()
        assertType<Exact<root.OrderByMode, OrderByMode>>()
        assertType<Exact<root.SelectedRow<T>, extrasTypes.SelectedRow<T>>>()
        assertType<Exact<root.SelectedValues<T>, extrasTypes.SelectedValues<T>>>()
        assertType<Exact<root.SelectedRowProjectedAsNullable<T>, extrasTypes.SelectedRowProjectedAsNullable<T>>>()
        assertType<Exact<root.SelectedValuesProjectedAsNullable<T>, extrasTypes.SelectedValuesProjectedAsNullable<T>>>()
        assertType<Exact<root.InsertableRow<T>, extrasTypes.InsertableRow<T>>>()
        assertType<Exact<root.InsertableValues<T>, extrasTypes.InsertableValues<T>>>()
        assertType<Exact<root.UpdatableOnInsertConflictRow<T>, extrasTypes.UpdatableOnInsertConflictRow<T>>>()
        assertType<Exact<root.UpdatableOnInsertConflictValues<T>, extrasTypes.UpdatableOnInsertConflictValues<T>>>()
        assertType<Exact<root.InsertableRowShapedAs<T, { name: 'name' }>, extrasTypes.InsertableRowShapedAs<T, { name: 'name' }>>>()
        assertType<Exact<root.InsertableValuesShapedAs<T, { name: 'name' }>, extrasTypes.InsertableValuesShapedAs<T, { name: 'name' }>>>()
        assertType<Exact<root.UpdatableOnInsertConflictRowShapedAs<T, { name: 'name' }>, extrasTypes.UpdatableOnInsertConflictRowShapedAs<T, { name: 'name' }>>>()
        assertType<Exact<root.UpdatableOnInsertConflictValuesShapedAs<T, { name: 'name' }>, extrasTypes.UpdatableOnInsertConflictValuesShapedAs<T, { name: 'name' }>>>()
        assertType<Exact<root.UpdatableRow<T>, extrasTypes.UpdatableRow<T>>>()
        assertType<Exact<root.UpdatableValues<T>, extrasTypes.UpdatableValues<T>>>()
        assertType<Exact<root.UpdatableRowShapedAs<T, { name: 'name' }>, extrasTypes.UpdatableRowShapedAs<T, { name: 'name' }>>>()
        assertType<Exact<root.UpdatableValuesShapedAs<T, { name: 'name' }>, extrasTypes.UpdatableValuesShapedAs<T, { name: 'name' }>>>()
        assertType<Exact<root.WritableShapeFor<T>, extrasTypes.WritableShapeFor<T>>>()
        assertType<Exact<root.ColumnKeys<T>, extrasTypes.ColumnKeys<T>>>()
        assertType<Exact<root.WritableColumnKeys<T>, extrasTypes.WritableColumnKeys<T>>>()
        assertType<Exact<root.IdColumnKeys<T>, extrasTypes.IdColumnKeys<T>>>()
        assertType<Exact<root.AutogeneratedIdColumnKeys<T>, extrasTypes.AutogeneratedIdColumnKeys<T>>>()
        assertType<Exact<root.ProvidedIdColumnKeys<T>, extrasTypes.ProvidedIdColumnKeys<T>>>()
        assertType<Exact<root.TableOrViewOf<T>, extrasTypes.TableOrViewOf<T>>>()
        assertType<Exact<root.TableOrViewLeftJoinOf<T>, extrasTypes.TableOrViewLeftJoinOf<T>>>()
        assertType<Exact<root.DeepPick<Model, 'id'>, DeepPick<Model, 'id'>>>()
        assertType<Exact<root.DeepOmit<Model, 'id'>, DeepOmit<Model, 'id'>>>()
        assertType<Exact<root.DeepPickPaths<Model>, DeepPickPaths<Model>>>()
    })

    test('compatibility-entry-is-the-dynamic-pick-module', () => {
        expect(Object.keys(compat).sort()).toEqual([
            'dynamicPick', 'dynamicPickPaths', 'expandTypeFromDynamicPickPaths', 'expandTypeProjectedAsNullableFromDynamicPickPaths',
        ])
        expect(compat.dynamicPick).toBe(dynamicPickModule.dynamicPick)
        expect(compat.dynamicPickPaths).toBe(dynamicPickModule.dynamicPickPaths)
        expect(compat.expandTypeFromDynamicPickPaths).toBe(dynamicPickModule.expandTypeFromDynamicPickPaths)
        expect(compat.expandTypeProjectedAsNullableFromDynamicPickPaths).toBe(dynamicPickModule.expandTypeProjectedAsNullableFromDynamicPickPaths)
        type Columns = { id: typeof tCountry.code }
        assertType<Exact<compat.Pickable, dynamicPickModule.Pickable>>()
        assertType<Exact<compat.DynamicPick<Columns>, dynamicPickModule.DynamicPick<Columns>>>()
        assertType<Exact<compat.DynamicPickPaths<Columns>, dynamicPickModule.DynamicPickPaths<Columns>>>()
        assertType<Exact<compat.PickValuesPath<Columns, 'id'>, dynamicPickModule.PickValuesPath<Columns, 'id'>>>()
        assertType<Exact<compat.PickValuesPathWithAllProperties<Columns, 'id'>, dynamicPickModule.PickValuesPathWithAllProperties<Columns, 'id'>>>()
        assertType<Exact<compat.PickValuesPathProjectedAsNullable<Columns, 'id'>, dynamicPickModule.PickValuesPathProjectedAsNullable<Columns, 'id'>>>()
        assertType<Exact<compat.PickValuesPathWithAllPropertiesProjectedAsNullable<Columns, 'id'>, dynamicPickModule.PickValuesPathWithAllPropertiesProjectedAsNullable<Columns, 'id'>>>()
        assertType<Exact<compat.DynamicCondition<{ id: 'int' }>, DynamicCondition<{ id: 'int' }>>>()
    })

    test('exports-map-points-at-existing-modules', () => {
        const repositoryRoot = new URL('../../../../../', import.meta.url)
        const pkg: {
            exports: Record<string, { types: string; default: string } | string>
        } = JSON.parse(readFileSync(new URL('package.json', repositoryRoot), 'utf8'))
        const missing: string[] = []
        const inconsistent: string[] = []
        for (const [subpath, target] of Object.entries(pkg.exports)) {
            if (subpath === './package.json' || subpath.includes('*') || typeof target === 'string') continue
            // Each path is a re-export file of src/exports
            const module = target.default.replace(/^\.\//, '').replace(/\.js$/, '')
            if (!module.startsWith('exports/') || !existsSync(new URL(`src/${module}.ts`, repositoryRoot))) missing.push(subpath)
            if (target.types !== `./${module}.d.ts`) inconsistent.push(subpath)
        }
        expect(missing).toEqual([])
        expect(inconsistent).toEqual([])
    })

    test('error-constructor-forms-give-message-and-cause', () => {
        const reason: TsSqlErrorReason = { reason: 'UNSUPPORTED_QUERY' }
        const cause = new Error('boom')

        const withMessage = new TsSqlError(reason, 'msg')
        expect(withMessage.message).toBe('UNSUPPORTED_QUERY: msg')
        expect(withMessage.cause).toBeUndefined()

        const withErrorAsCause = new TsSqlError(reason, cause)
        expect(withErrorAsCause.message).toBe('UNSUPPORTED_QUERY: boom')
        expect(withErrorAsCause.cause).toBe(cause)

        const withMessageAndCause = new TsSqlError(reason, 'msg', cause)
        expect(withMessageAndCause.message).toBe('UNSUPPORTED_QUERY: msg')
        expect(withMessageAndCause.cause).toBe(cause)

        const withValueAsCause = new TsSqlError(reason, 42)
        expect(withValueAsCause.message).toBe('UNSUPPORTED_QUERY')
        expect(withValueAsCause.cause).toBe(42)

        expect(withMessage.errorReason).toBe(reason)
        expect(Object.keys(withMessage)).toEqual(['name'])
        expect(JSON.stringify(withMessage)).toBe('{"name":"TsSqlError"}')
        assertType<Exact<typeof withMessage.errorReason, TsSqlErrorReason>>()
    })

    test('error-classes-name-and-hierarchy', () => {
        const reason: TsSqlErrorReason = { reason: 'UNSUPPORTED_QUERY' }
        const source = new QueryExecutionSource('where')
        const base = new TsSqlError(reason, 'msg')
        const processing = new TsSqlProcessingError(reason, 'msg')
        const execution = new TsSqlQueryExecutionError(source, reason, 'msg')

        expect([base.name, processing.name, execution.name, source.name])
            .toEqual(['TsSqlError', 'TsSqlProcessingError', 'TsSqlQueryExecutionError', 'QueryExecutionSource'])
        expect([base, processing, execution].map((e) => e instanceof TsSqlError)).toEqual([true, true, true])
        expect(processing instanceof TsSqlQueryExecutionError).toBe(false)
        expect(execution instanceof TsSqlProcessingError).toBe(false)
        expect(execution.source).toBe(source)
        expect(Object.keys(execution).includes('source')).toBe(false)
        expect(source instanceof Error).toBe(true)
        expect(source.message).toBe('where')
        expect(source.stack?.startsWith('where\n')).toBe(true)
        assertType<Exact<typeof execution.source, QueryExecutionSource>>()
        assertType<Exact<typeof execution.transactionSource, QueryExecutionSource | undefined>>()
        assertType<Exact<typeof execution.rollbackError, unknown>>()
        assertType<Exact<typeof execution.transactionError, unknown>>()
        assertType<Exact<typeof execution.additionalErrors, Array<unknown> | undefined>>()
    })

    test('error-reason-member-types', () => {
        assertType<Exact<TsSqlDatabaseErrorCode, string>>()
        assertType<Exact<TsSqlDatabaseErrorNumber, string | number>>()
        type Internal = Extract<TsSqlErrorReason, { reason: 'INTERNAL' }>
        assertType<Exact<Internal, TsSqlInternalErrorReason>>()
        type Timeout = Extract<TsSqlErrorReason, { reason: 'SQL_TIMEOUT' }>
        assertType<Exact<Timeout['databaseErrorCode'], TsSqlDatabaseErrorCode | undefined>>()
        assertType<Exact<Timeout['databaseErrorNumber'], TsSqlDatabaseErrorNumber | undefined>>()
    })

    test('failed-execution-carries-the-execution-source-and-the-reason', async () => {
        ctx.mockNext(null)
        let caught: unknown
        try {
            await ctx.conn.selectFrom(tCountry)
                .where(tCountry.code.equals('not-a-country'))
                .select({ code: tCountry.code })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(caught instanceof TsSqlQueryExecutionError).toBe(true)
        if (!(caught instanceof TsSqlQueryExecutionError)) return
        expect(caught.errorReason.reason).toBe('NO_RESULT')
        expect(caught.source instanceof QueryExecutionSource).toBe(true)
        expect(caught.transactionSource).toBeUndefined()
        expect(caught.rollbackError).toBeUndefined()
        expect(caught.transactionError).toBeUndefined()
        expect(caught.additionalErrors).toBeUndefined()
    })

    test('custom-boolean-type-adapter-holds-its-values-and-delegates', () => {
        const byNumber = new CustomBooleanTypeAdapter(1, 0)
        const byString = new CustomBooleanTypeAdapter('yes', 'no')
        expect([byNumber.trueValue, byNumber.falseValue, byString.trueValue, byString.falseValue]).toEqual([1, 0, 'yes', 'no'])
        assertType<Exact<typeof byNumber.trueValue, number | string>>()
        assertType<Exact<typeof byNumber.falseValue, number | string>>()

        const next = new RecordingAdapter()
        expect(byString.transformValueFromDB('yes', 'boolean', 'boolean', next)).toBe('from-result')
        expect(byString.transformValueToDB(true, 'boolean', 'boolean', next)).toBe('to-result')
        expect(next.calls).toEqual([['from', 'yes', 'boolean'], ['to', true, 'boolean']].map((call) => JSON.stringify(call)))
        const asTypeAdapter: TypeAdapter = byString
        expect(asTypeAdapter.transformPlaceholder).toBeUndefined()
        expect(asTypeAdapter.forceTypeCast).toBeUndefined()
        expect(asTypeAdapter.transformProjection).toBeUndefined()
        expect(asTypeAdapter.projectionComparison).toBeUndefined()
    })

    test('force-type-cast-delegates-and-forces-the-cast', () => {
        const adapter = new ForceTypeCast()
        const next = new RecordingAdapter()
        expect(adapter.transformValueFromDB(1, 'int', 'int', next)).toBe('from-result')
        expect(adapter.transformValueToDB(2, 'int', 'int', next)).toBe('to-result')
        expect(adapter.transformPlaceholder('$1', 'int', 'int', 3, next)).toBe('placeholder-result')
        expect([adapter.forceTypeCast('int', 'int', 3, false, next), adapter.forceTypeCast('int', 'int', 3, true, next)]).toEqual([true, true])
        expect(next.calls).toEqual([['from', 1, 'int'], ['to', 2, 'int'], ['placeholder', '$1', 'int', 3]].map((call) => JSON.stringify(call)))
    })

    test('error-wrapping-one-of-the-library-repeats-no-reason', async () => {
        const failure = (query: Promise<number | { id: number } | undefined>) => query.then(() => undefined, (e: Error) => e)
        const select = () => ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(9999))

        ctx.mockNext(undefined)
        const noRow = await failure(select().select({ id: tIssue.id }).executeSelectOne())
        expect(noRow?.message).toBe('NO_RESULT: No result returned by the database')

        ctx.mockNext(undefined)
        const noRowOfOneColumn = await failure(select().selectOneColumn(tIssue.id).executeSelectOne())
        expect(noRowOfOneColumn?.message).toBe('NO_RESULT: No result returned by the database')

        const direct = new TsSqlProcessingError({ reason: 'NO_RESULT' }, 'msg')
        const wrappedWithTheSameReason = new TsSqlQueryExecutionError(new Error('where'), { reason: 'NO_RESULT' }, direct)
        expect(wrappedWithTheSameReason.message).toBe('NO_RESULT: msg')
        expect(wrappedWithTheSameReason.cause).toBe(direct)

        const wrappedWithAnotherReason = new TsSqlQueryExecutionError(new Error('where'), { reason: 'UNKNOWN' }, direct)
        expect(wrappedWithAnotherReason.message).toBe('UNKNOWN: NO_RESULT: msg')
    })

    test('isolation-level-type-is-the-one-of-the-connection', () => {
        type Db = typeof ctx.conn extends Connection<infer DB> ? DB : false
        assertType<Exact<ReturnType<typeof ctx.conn.isolationLevel>, TransactionIsolationLevel<Db>>>()
        assertType<Exact<Parameters<typeof ctx.conn.transaction>[1], TransactionIsolationLevel<Db> | undefined>>()
    })

    test('values-in-sub-select-using-reads-the-outer-row', async () => {
        const source = Values.create(VSource, 'vSource', [{ id: 1, label: 'first' }])
        const expected = [{ id: 1, title: 'seed-title' }]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(source)
            .select({
                id: source.id,
                title: ctx.conn.subSelectUsing(source)
                    .from(tIssue)
                    .where(tIssue.id.equals(source.id))
                    .selectOneColumn(tIssue.title)
                    .forUseAsInlineQueryValue(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vSource(id, label) as (values (:0, :1)) select id as "id", (select title as "result" from issue where id = vSource.id) as "title" from vSource"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "first",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; title?: string }>>>()
        expect(rows.map((row) => row.id)).toEqual([1])
        expect(typeof rows[0]?.title).toBe('string')
    })

    test('values-query-is-allowed-follows-its-columns', () => {
        const source = Values.create(VSource, 'vSource', [{ id: 1 }])
        const open = ctx.conn.selectFrom(source).select({ id: source.id })
        const closed = ctx.conn.selectFrom(source).select({ id: source.id.allowWhen(false, 'closed') })
        expect(isQueryAllowed(open)).toBe(true)
        expect(isQueryAllowed(closed)).toBe(false)
    })

    test('values-aliased-and-left-joined-column-keys-agree-with-the-value', () => {
        const source = Values.create(VSource, 'vSource', [{ id: 1 }])
        const aliased = source.as('aliased')
        const leftJoined = source.forUseInLeftJoin()
        assertType<Exact<extrasTypes.ColumnKeys<typeof aliased>, 'id' | 'label' | 'doubled'>>()
        assertType<Exact<extrasTypes.ColumnKeys<typeof leftJoined>, 'id' | 'label' | 'doubled'>>()
        assertType<Exact<extrasTypes.WritableColumnKeys<typeof source>, 'id' | 'label'>>()
        expect(extrasUtils.extractColumnNamesFrom(aliased)).toEqual(['id', 'label', 'doubled'])
        expect(extrasUtils.extractColumnNamesFrom(leftJoined)).toEqual(['id', 'label', 'doubled'])
        expect(extrasUtils.extractWritableColumnNamesFrom(source)).toEqual(['id', 'label'])
    })

    test('table-sequence-primary-key-with-a-custom-type-name', async () => {
        class TSequenceEntry extends Table<DBConnection, 'TSequenceEntry'> {
            id = this.autogeneratedPrimaryKeyBySequence<number, 'Cents'>('id', 'audit_tag_seq', 'customInt', 'Cents')
            action = this.column('action', 'string')
            constructor() { super('audit_entry') }
        }
        const tSequenceEntry = new TSequenceEntry()
        await ctx.withCommit(async () => {
            ctx.mockNext(50)
            const id = await ctx.conn.insertInto(tSequenceEntry)
                .values({ action: 'archived' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into audit_entry (id, action) values (audit_tag_seq.nextval, :0) returning id into :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                {
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(typeof id).toBe('number')
        })
    })

    test('deep-pick-and-omit-with-an-absent-optional-parent', () => {
        const model: Model = { id: 1, nullable: null, undefinable: undefined }
        const picked = deepPick(model, ['optional.a'])
        const omitted = deepOmit(model, ['optional.a'])
        assertType<Exact<typeof picked, DeepPick<Model, 'optional.a'>>>()
        assertType<Exact<DeepPick<Model, 'optional.a'>['optional'], { a: number } | undefined>>()
        assertType<Exact<DeepOmit<Model, 'optional.a'>['optional'], { b: string } | undefined>>()
        expect(picked).toEqual({})
        expect(omitted).toEqual({ id: 1, nullable: null, undefinable: undefined })
    })

    test('deep-pick-and-omit-with-no-paths', () => {
        const model: Model = { id: 1, nullable: null, undefinable: undefined }
        const picked = deepPick(model, [])
        const omitted = deepOmit(model, [])
        assertType<Exact<typeof picked, DeepPick<Model, never>>>()
        assertType<Exact<keyof typeof picked, never>>()
        assertType<Exact<keyof typeof omitted, keyof Model>>()
        expect(picked).toEqual({})
        expect(omitted).toEqual(model)
        expect(omitted).not.toBe(model)
    })

    // NOT-APPLICABLE: the date-time formats belong to the SQLite connection
    /*
    test('sqlite-date-time-format-types', () => {
        assertType<Exact<SqliteDateTimeFormat,
            | 'localdate seconds as text' | 'localdate milliseconds as text'
            | 'localdate seconds as text using T separator' | 'localdate milliseconds as text using T separator'
            | 'UTC seconds as text' | 'UTC milliseconds as text'
            | 'UTC seconds as text using T separator' | 'UTC milliseconds as text using T separator'
            | 'UTC seconds as text using Z timezone' | 'UTC milliseconds as text using Z timezone'
            | 'UTC seconds as text using T separator and Z timezone' | 'UTC milliseconds as text using T separator and Z timezone'
            | 'Julian day as real number' | 'Unix time seconds as integer' | 'Unix time milliseconds as integer'>>()
        assertType<Exact<SqliteDateTimeFormatType, 'date' | 'time' | 'dateTime'>>()
    })
    */

    test('autogenerated-id-types-list-only-the-autogenerated-primary-key', () => {
        const columns = extrasUtils.extractAutogeneratedIdColumnsFrom(tOrganization)
        const names = extrasUtils.extractAutogeneratedIdColumnNamesFrom(tOrganization)
        expect(Object.keys(columns)).toEqual(['id'])
        expect(names).toEqual(['id'])
        assertType<Exact<extrasTypes.AutogeneratedIdColumnKeys<typeof tOrganization>, 'id'>>()
        assertType<Exact<keyof typeof columns, 'id'>>()
        assertType<Exact<typeof names, Array<'id'>>>()
    })

    test('deep-omit-keeps-a-key-named-as-an-object-prototype-member', () => {
        const model: { constructor: string; id: number } = { constructor: 'kept', id: 1 }
        const omitted = deepOmit(model, ['id'])
        expect(omitted).toEqual({ constructor: 'kept' })
        assertType<Exact<typeof omitted, { constructor: string }>>()
    })
})
