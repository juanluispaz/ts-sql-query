import type { BeginTransactionOpts, CommitOpts, ExecutableQueryType, QueryRunner, RollbackOpts } from '../queryRunners/QueryRunner.js'
import { NoopDBSqlBuilder } from '../sqlBuilders/NoopDBSqlBuilder.js'
import { NoopQueryRunner } from '../queryRunners/NoopQueryRunner.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import { ChainedQueryRunner } from '../queryRunners/ChainedQueryRunner.js'
import type { AggregatedArrayColumns, SourceOfAggregatedArray, TransactionIsolationLevel } from './AbstractConnection.js'
import type { NAggregate, NConnection, NNotNestedAggregate, NSource } from '../utils/sourceName.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { source, valueType } from '../utils/symbols.js'
import { __createAggregateFunction1, __createAggregateFunction1or2, __createAggregateValueAsArray } from '../typeSystem/valueSourceFactory.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'
import type { ValueSourceOf, TypedValueSource } from '../typeSystem/valueSource.js'
import { __getValueSourcePrivate } from '../typeSystem/valueSource.js'
import type { AggregatedArrayProjectableAsNullableType, AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'
import type { IValueSource, RemapValueSourceTypeWithOptionalType, ValueSource } from '../typeSystem/base.js'
import type { StringType } from '../typeSystem/strings.js'
import { __typeClassOf } from '../typeSystem/valueSourceFactory.js'
import { __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'

export abstract class NoopDBConnection</*in|out*/ NAME extends string> extends AbstractAdvancedConnection<NConnection<'noopDB', NAME>> {

    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(new NoopIterceptQueryRunner(queryRunner), sqlBuilder)
        queryRunner.useDatabase('noopDB')
    }

    aggregateAsArrayDistinct<COLUMNS extends AggregatedArrayColumns<NConnection<'noopDB', NAME>>>(columns: COLUMNS & NNotNestedAggregate<SourceOfAggregatedArray<COLUMNS>, NConnection<'noopDB', NAME>>): ValueSource<SourceOfAggregatedArray<COLUMNS> | NAggregate<NConnection<'noopDB', NAME>>, AggregatedArrayProjectableAsNullableType<Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>>, 'required'> {
        return __createAggregateValueAsArray(columns as QueryColumns, 'InnerResultObject', 'required', true)
    }
    aggregateAsArrayOfOneColumnDistinct<VALUE extends TypedValueSource<any, any, any>>(value: VALUE & NNotNestedAggregate<VALUE[typeof source], NConnection<'noopDB', NAME>>): ValueSource<VALUE[typeof source] | NAggregate<NConnection<'noopDB', NAME>>, AggregatedArrayType<Array<VALUE[typeof valueType]>>, 'required'> {
        return __createAggregateValueAsArray(value, 'InnerResultObject', 'required', true)
    }
    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'noopDB', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'noopDB', NAME>>): ValueSource<SOURCE | NAggregate<NConnection<'noopDB', NAME>>, StringType, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<NConnection<'noopDB', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'noopDB', NAME>>, separator: string): ValueSource<SOURCE | NAggregate<NConnection<'noopDB', NAME>>, StringType, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return __createAggregateFunction1or2('_stringConcatDistinct', separator, value, __adaptedTypeClassOf(__typeClassOf(valuePrivate), valuePrivate.__typeAdapter), 'optional')
    }

    anyValue<TYPE extends TypedValueSource<any, any, any>>(value: TYPE & SameDB<NConnection<'noopDB', NAME>> & NNotNestedAggregate<TYPE[typeof source], NConnection<'noopDB', NAME>>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<NConnection<'noopDB', NAME>>, TYPE, 'optional'> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (__createAggregateFunction1('_anyValue', value, __adaptedTypeClassOf(__typeClassOf(valuePrivate), valuePrivate.__typeAdapter), 'optional')) as any
    }

    default(): Default {
        return new DefaultImpl()
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'noopDB', NAME>>
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'noopDB', NAME>>
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable' | 'read write' | 'read only', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel<NConnection<'noopDB', NAME>> {
        if (level === 'read write' || level === 'read only') {
            return [undefined, level] as any
        }
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
    }
}

/** Keeps the last query and its params, the statements of a transaction included, before passing them on */
class NoopIterceptQueryRunner<T extends QueryRunner> extends ChainedQueryRunner<T> {
    lastQuery: string = ''
    lastParams: any[] = []

    override executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeQuery(queryType, query, params)
    }
    override executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        this.lastQuery = 'begin transaction'
        this.lastParams = opts
        return this.queryRunner.executeBeginTransaction(opts)
    }
    override executeCommit(opts: CommitOpts = []): Promise<void> {
        this.lastQuery = 'commit'
        this.lastParams = opts
        return this.queryRunner.executeCommit(opts)
    }
    override executeRollback(opts: RollbackOpts = []): Promise<void> {
        this.lastQuery = 'rollback'
        this.lastParams = opts
        return this.queryRunner.executeRollback(opts)
    }
}
