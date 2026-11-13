import type { BeginTransactionOpts, CommitOpts, QueryRunner, RollbackOpts } from '../queryRunners/QueryRunner.js'
import { NoopDBSqlBuilder } from '../sqlBuilders/NoopDBSqlBuilder.js'
import { NoopQueryRunner } from '../queryRunners/NoopQueryRunner.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import { ChainedQueryRunner } from '../queryRunners/ChainedQueryRunner.js'
import type { AggregatedArrayColumns, SourceOfAggregatedArray, TransactionIsolationLevel } from './AbstractConnection.js'
import type { NAggregate, NConnection, NNotNestedAggregate, NSource } from '../utils/sourceName.js'
import type { AggregatedArrayValueSource, AggregatedArrayValueSourceProjectableAsNullable, IStringValueSource, IValueSource, StringValueSource, ValueSourceOf , RemapValueSourceTypeWithOptionalType} from '../expressions/values.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { source, valueType } from '../utils/symbols.js'
import { AggregateFunctions1ValueSource, AggregateFunctions1or2ValueSource, AggregateValueAsArrayValueSource } from '../internal/ValueSourceImpl.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'

export abstract class NoopDBConnection</*in|out*/ NAME extends string> extends AbstractAdvancedConnection<NConnection<'noopDB', NAME>> {

    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(new NoopIterceptQueryRunner(queryRunner), sqlBuilder)
        queryRunner.useDatabase('noopDB')
    }

    aggregateAsArrayDistinct<COLUMNS extends AggregatedArrayColumns<NConnection<'noopDB', NAME>>>(columns: COLUMNS & NNotNestedAggregate<SourceOfAggregatedArray<COLUMNS>, NConnection<'noopDB', NAME>>): AggregatedArrayValueSourceProjectableAsNullable<SourceOfAggregatedArray<COLUMNS> | NAggregate<NConnection<'noopDB', NAME>>, Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>, 'required'> {
        return new AggregateValueAsArrayValueSource(columns as QueryColumns, 'InnerResultObject', 'required', true)
    }
    aggregateAsArrayOfOneColumnDistinct<VALUE extends IValueSource<any, any, any, any>>(value: VALUE & NNotNestedAggregate<VALUE[typeof source], NConnection<'noopDB', NAME>>): AggregatedArrayValueSource<VALUE[typeof source] | NAggregate<NConnection<'noopDB', NAME>>, Array<VALUE[typeof valueType]>, 'required'> {
        return new AggregateValueAsArrayValueSource(value, 'InnerResultObject', 'required', true)
    }
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'noopDB', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'noopDB', NAME>>): StringValueSource<SOURCE | NAggregate<NConnection<'noopDB', NAME>>, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'noopDB', NAME>> & NNotNestedAggregate<SOURCE, NConnection<'noopDB', NAME>>, separator: string): StringValueSource<SOURCE | NAggregate<NConnection<'noopDB', NAME>>, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcatDistinct', separator, value, valuePrivate.__type, valuePrivate.__customType, 'optional', valuePrivate.__typeAdapter)
    }

    anyValue<TYPE extends IValueSource<any, any, any, any>>(value: TYPE & SameDB<NConnection<'noopDB', NAME>> & NNotNestedAggregate<TYPE[typeof source], NConnection<'noopDB', NAME>>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<NConnection<'noopDB', NAME>>, TYPE, 'optional'> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_anyValue', value, valuePrivate.__type, valuePrivate.__customType, 'optional', valuePrivate.__typeAdapter)) as any
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

class NoopIterceptQueryRunner<T extends QueryRunner> extends ChainedQueryRunner<T> {
    lastQuery: string = ''
    lastParams: any[] = []

    override executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectOneRow(query, params)
    }
    override executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectManyRows(query, params)
    }
    override executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectOneColumnOneRow(query, params)
    }
    override executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectOneColumnManyRows(query, params)
    }
    override executeInsert(query: string, params: any[] = []): Promise<number> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeInsert(query, params)
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeInsertReturningLastInsertedId(query, params)
    }
    override executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
    }
    override executeUpdate(query: string, params: any[] = []): Promise<number> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeUpdate(query, params)
    }
    override executeDelete(query: string, params: any[] = []): Promise<number> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeDelete(query, params)
    }
    override executeProcedure(query: string, params: any[] = []): Promise<void> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeProcedure(query, params)
    }
    override executeFunction(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeFunction(query, params)
    }
    override executeBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        this.lastQuery = 'begin transaction'
        this.lastParams = opts || []
        return this.queryRunner.executeBeginTransaction(opts)
    }
    override executeCommit(opts: CommitOpts): Promise<void> {
        this.lastQuery = 'commit'
        this.lastParams = opts || []
        return this.queryRunner.executeCommit(opts)
    }
    override executeRollback(opts: RollbackOpts): Promise<void> {
        this.lastQuery = 'rollback'
        this.lastParams = opts || []
        return this.queryRunner.executeRollback(opts)
    }
    override executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeDatabaseSchemaModification(query, params)
    }
}