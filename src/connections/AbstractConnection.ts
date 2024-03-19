import type { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import type { InsertExpression } from "../expressions/insert"
import type { UpdateExpression, UpdateExpressionAllowingNoWhere } from "../expressions/update"
import type { DeleteExpression, DeleteExpressionAllowingNoWhere } from "../expressions/delete"
import type { BooleanValueSource, NumberValueSource, StringValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, EqualableValueSource, ComparableValueSource, IfValueSource, IComparableValueSource, INumberValueSource, IStringValueSource, IExecutableSelectQuery, BigintValueSource, IBigintValueSource, AlwaysIfValueSource, ValueSourceOf, RemapValueSourceTypeWithOptionalType, IValueSource, UuidValueSource, IExecutableInsertQuery, IExecutableUpdateQuery, IExecutableDeleteQuery, AggregatedArrayValueSourceProjectableAsNullable, AggregatedArrayValueSource, ValueType, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource, CustomLocalDateTimeValueSource, ICustomIntValueSource, ICustomDoubleValueSource, AnyValueSource } from "../expressions/values"
import type { Default } from "../expressions/Default"
import { NoTableOrViewRequired, ITableOrView, __getTableOrViewPrivate, ITable, SameDB, HasSource, ForUseInLeftJoin } from "../utils/ITableOrView"
import type { SelectExpression, SelectExpressionFromNoTable, SelectExpressionSubquery } from "../expressions/select"
import type { TypeAdapter, DefaultTypeAdapter } from "../TypeAdapter"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { IConnection } from "../utils/IConnection"
import type { BooleanFragmentExpression, NumberFragmentExpression, StringFragmentExpression, LocalDateFragmentExpression, LocalTimeFragmentExpression, LocalDateTimeFragmentExpression, EqualableFragmentExpression, ComparableFragmentExpression, FragmentBuilder0, FragmentBuilder1, FragmentBuilder2, FragmentBuilder3, FragmentBuilder4, FragmentBuilder5, FragmentBuilder0IfValue, FragmentBuilder1IfValue, FragmentBuilder2IfValue, FragmentBuilder3IfValue, FragmentBuilder4IfValue, FragmentBuilder5IfValue, BigintFragmentExpression, UuidFragmentExpression, CustomIntFragmentExpression, CustomDoubleFragmentExpression, CustomUuidFragmentExpression, CustomLocalDateFragmentExpression, CustomLocalTimeFragmentExpression, CustomLocalDateTimeFragmentExpression, FragmentBuilderMaybeOptional0, FragmentBuilderMaybeOptional1, FragmentBuilderMaybeOptional2, FragmentBuilderMaybeOptional3, FragmentBuilderMaybeOptional4, FragmentBuilderMaybeOptional5 } from "../expressions/fragment"
import { InsertQueryBuilder } from "../queryBuilders/InsertQueryBuilder"
import { UpdateQueryBuilder } from "../queryBuilders/UpdateQueryBuilder"
import { DeleteQueryBuilder } from "../queryBuilders/DeleteQueryBuilder"
import { __getValueSourcePrivate, Argument } from "../expressions/values"
import { SqlOperationStatic0ValueSource, SqlOperationStatic1ValueSource, AggregateFunctions0ValueSource, AggregateFunctions1ValueSource, AggregateFunctions1or2ValueSource, SqlOperationConstValueSource, SqlOperationValueSourceIfValueAlwaysNoop, SqlOperationStaticBooleanValueSource, TableOrViewRawFragmentValueSource, AggregateValueAsArrayValueSource } from "../internal/ValueSourceImpl"
import { DefaultImpl } from "../expressions/Default"
import { SelectQueryBuilder } from "../queryBuilders/SelectQueryBuilder"
import ChainedError from "chained-error"
import { FragmentQueryBuilder, FragmentFunctionBuilder, FragmentFunctionBuilderIfValue, FragmentFunctionBuilderMaybeOptional } from "../queryBuilders/FragmentQueryBuilder"
import { attachSource, attachTransactionSource } from "../utils/attachSource"
import { connection, source, transactionIsolationLevel, typeName, valueType } from "../utils/symbols"
import { callDeferredFunctions, callDeferredFunctionsStoppingOnError, isPromise } from "../utils/PromiseUtils"
import type { DinamicConditionExtension, DynamicConditionExpression, Filterable } from "../expressions/dynamicConditionUsingFilters"
import { DynamicConditionBuilder } from "../queryBuilders/DynamicConditionBuilder"
import type { RawFragment } from "../utils/RawFragment"
import { RawFragmentImpl } from "../internal/RawFragmentImpl"
import type { CustomizedTableOrView } from "../utils/tableOrViewUtils"
import { __setQueryMetadata } from "../queryBuilders/AbstractQueryBuilder"
import type { NDB, NNoTableOrViewRequired, NSource, NWithDB } from "../utils/sourceName"
import type { DataToProject, GetDataToProjectSource } from "../complexProjections/dataToProject"
import type { ResultObjectValuesForAggregatedArray } from "../complexProjections/resultWithOptionalsAsUndefined"
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from "../complexProjections/resultWithOptionalsAsNull"

export abstract class AbstractConnection</*in|out*/ DB extends NDB> implements IConnection<DB> {
    [connection]!: DB

    protected __sqlBuilder: SqlBuilder
    protected allowEmptyString: boolean = false
    protected insesitiveCollation?: string
    readonly queryRunner: QueryRunner
    readonly defaultTypeAdapter: DefaultTypeAdapter

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        this.defaultTypeAdapter = this as any // transform protected methods to public
        sqlBuilder._defaultTypeAdapter = this.defaultTypeAdapter
        this.__sqlBuilder = sqlBuilder
        this.queryRunner = queryRunner
        sqlBuilder._queryRunner = queryRunner
        sqlBuilder._connectionConfiguration = this as any // transform protected methods to public
    }

    private beforeCommit?: Array<() => void | Promise<void>> | null
    private onCommit?: Array<() => void | Promise<void>> | null
    private onRollback?: Array<() => void | Promise<void>> | null
    private beforeCommitStack?: Array<Array<() => void | Promise<void>> | undefined>
    private onCommitStack?: Array<Array<() => void | Promise<void>> | undefined>
    private onRollbackStack?: Array<Array<() => void | Promise<void>> | undefined>

    private pushTransactionStack() {
        if (this.onCommit || this.onCommitStack || this.onRollback || this.onRollbackStack || this.beforeCommit || this.beforeCommitStack) {
            if (!this.beforeCommitStack) {
                this.beforeCommitStack = []
            }
            this.beforeCommitStack.push(this.beforeCommit || undefined)
            this.beforeCommit = undefined

            if (!this.onCommitStack) {
                this.onCommitStack = []
            }
            this.onCommitStack.push(this.onCommit || undefined)
            this.onCommit = undefined

            if (!this.onRollbackStack) {
                this.onRollbackStack = []
            }
            this.onRollbackStack.push(this.onRollback || undefined)
            this.onRollback = undefined
        }
    }

    private popTransactionStack() {
        if (this.beforeCommitStack) {
            this.beforeCommit = this.beforeCommitStack.pop()
            if (this.beforeCommitStack.length <= 0) {
                this.beforeCommitStack = undefined
            }
        } else {
            this.beforeCommit = undefined
        }
        if (this.onCommitStack) {
            this.onCommit = this.onCommitStack.pop()
            if (this.onCommitStack.length <= 0) {
                this.onCommitStack = undefined
            }
        } else {
            this.onCommit = undefined
        }
        if (this.onRollbackStack) {
            this.onRollback = this.onRollbackStack.pop()
            if (this.onRollbackStack.length <= 0) {
                this.onRollbackStack = undefined
            }
        } else {
            this.onRollback = undefined
        }
    }

    executeBeforeNextCommit(fn: ()=> void): void
    executeBeforeNextCommit(fn: ()=> Promise<void>): void
    executeBeforeNextCommit(fn: ()=> void | Promise<void>): void {
        if (!this.queryRunner.isMocked() && !this.isTransactionActive()) {
            throw new Error('There is no open transaction')
        }
        if (this.onRollback === null) {
            throw new Error('You cannot call executeBeforeNextCommit inside an executeAfterNextRollback')
        }
        if (this.onCommit === null) {
            throw new Error('You cannot call executeBeforeNextCommit inside an executeAfterNextCommit')
        }
        if (this.beforeCommit === null) {
            throw new Error('You cannot call executeBeforeNextCommit inside an executeBeforeNextCommit')
        }
        if (!this.beforeCommit) {
            this.beforeCommit = []
        }
        this.beforeCommit.push(fn)
    }

    executeAfterNextCommit(fn: ()=> void): void
    executeAfterNextCommit(fn: ()=> Promise<void>): void
    executeAfterNextCommit(fn: ()=> void | Promise<void>): void {
        if (!this.queryRunner.isMocked() && !this.isTransactionActive()) {
            throw new Error('There is no open transaction')
        }
        if (this.onRollback === null) {
            throw new Error('You cannot call executeAfterNextCommit inside an executeAfterNextRollback')
        }
        if (this.onCommit === null) {
            throw new Error('You cannot call executeAfterNextCommit inside an executeAfterNextCommit')
        }
        if (!this.onCommit) {
            this.onCommit = []
        }
        this.onCommit.push(fn)
    }

    executeAfterNextRollback(fn: ()=> void): void
    executeAfterNextRollback(fn: ()=> Promise<void>): void
    executeAfterNextRollback(fn: ()=> void | Promise<void>): void {
        if (!this.queryRunner.isMocked() && !this.isTransactionActive()) {
            throw new Error('There is no open transaction')
        }
        if (this.onRollback === null) {
            throw new Error('You cannot call executeAfterNextRollback inside an executeAfterNextRollback')
        }
        if (!this.onRollback) {
            this.onRollback = []
        }
        this.onRollback.push(fn)
    }

    transaction<T>(fn: () => Promise<T>, isolationLevel?: TransactionIsolationLevel): Promise<T> {
        if (!this.queryRunner.isMocked() && this.isTransactionActive() && !this.queryRunner.nestedTransactionsSupported()) {
            throw new Error('Nested transactions not supported')
        }
        const opts: any = isolationLevel || []
        const source = new Error('Transaction executed at')
        __setQueryMetadata(source, opts)
        try {
            return this.queryRunner.executeInTransaction<T>(() => {
                this.pushTransactionStack()
                try {
                    const result = fn()
                    return result.then((fnResult) => {
                        const beforeCommit = this.beforeCommit
                        this.beforeCommit = null
                        return callDeferredFunctionsStoppingOnError('before next commit', beforeCommit, fnResult, source)
                    })
                } catch (e) {
                    this.popTransactionStack()
                    throw e
                }
            }, this.queryRunner, opts).then((result) => {
                const onCommit = this.onCommit
                this.onCommit = null
                return callDeferredFunctions<T>('after next commit', onCommit, result, source)
            }, (e) => {
                const throwError = attachTransactionSource(new ChainedError(e), source)
                const onRollback = this.onRollback
                this.onRollback = null
                return callDeferredFunctions<any>('after next rollback', onRollback, undefined, source, e, throwError)
            }).finally(() => {
                this.popTransactionStack()
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    beginTransaction(isolationLevel?: TransactionIsolationLevel): Promise<void> {
        if (!this.queryRunner.isMocked() && this.isTransactionActive() && !this.queryRunner.nestedTransactionsSupported()) {
            throw new Error('Nested transactions not supported')
        }
        const opts: any = isolationLevel || []
        const source = new Error('Query executed at')
        __setQueryMetadata(source, opts)
        try {
            return this.queryRunner.executeBeginTransaction(opts).then((result) => {
                this.pushTransactionStack()
                return result
            }, (e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    commit(): Promise<void> {
        if (!this.queryRunner.isMocked() && !this.isTransactionActive()) {
            throw new Error('There is no open transaction')
        }
        const opts: any = []
        const source = new Error('Query executed at')
        __setQueryMetadata(source, opts)
        const beforeCommit = this.beforeCommit
        if (beforeCommit) {
            this.beforeCommit = null
            const result = callDeferredFunctionsStoppingOnError('before next commit', beforeCommit, undefined, source)
            if (isPromise(result)) {
                return result.then(() => {
                    try {
                        return this.queryRunner.executeCommit(opts).then(() => {
                            const onCommit = this.onCommit
                            this.onCommit = null
                            return callDeferredFunctions('after next commit', onCommit, undefined, source)
                        }, (e) => {
                            // Transaction only closed when commit successful, in case of error there is still an open transaction
                            // No rollback yet, then no executeAfterNextRollback will be executed
                            throw attachSource(new ChainedError(e), source)
                        })
                    } catch (e) {
                        throw new ChainedError(e)
                    }
                }).then(() => {
                    this.popTransactionStack()
                })
            }
        }
        try {
            return this.queryRunner.executeCommit(opts).then(() => {
                const onCommit = this.onCommit
                this.onCommit = null
                return callDeferredFunctions('after next commit', onCommit, undefined, source)
            }, (e) => {
                // Transaction only closed when commit successful, in case of error there is still an open transaction
                // No rollback yet, then no executeAfterNextRollback will be executed
                throw attachSource(new ChainedError(e), source)
            }).then(() => {
                this.popTransactionStack()
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    rollback(): Promise<void> {
        if (!this.queryRunner.isMocked() && !this.isTransactionActive()) {
            throw new Error('There is no open transaction')
        }
        const opts: any = []
        const source = new Error('Query executed at')
        __setQueryMetadata(source, opts)
        try {
            return this.queryRunner.executeRollback(opts).then(() => {
                const onRollback = this.onRollback
                this.onRollback = null
                return callDeferredFunctions('after next rollback', onRollback, undefined, source)
            }, (e) => {
                const throwError = attachSource(new ChainedError(e), source)
                const onRollback = this.onRollback
                this.onRollback = null
                return callDeferredFunctions('after next rollback', onRollback, undefined, source, e, throwError)
            }).finally(() => {
                this.popTransactionStack()
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    isTransactionActive(): boolean {
        return this.queryRunner.isTransactionActive()
    }

    insertInto<T extends ITable<any>>(table: T & SameDB<DB>): InsertExpression<T, NoTableOrViewRequired<DB> | T> {
        return new InsertQueryBuilder(this.__sqlBuilder, table) as any
    }
    update<T extends ITable<any>>(table: T & SameDB<DB>): UpdateExpression<T, NoTableOrViewRequired<DB> | T> {
        return new UpdateQueryBuilder(this.__sqlBuilder, table, false) as any
    }
    updateAllowingNoWhere<T extends ITable<any>>(table: T & SameDB<DB>): UpdateExpressionAllowingNoWhere<T, NoTableOrViewRequired<DB> | T> {
        return new UpdateQueryBuilder(this.__sqlBuilder, table, true) as any
    }
    deleteFrom<T extends ITable<any>>(table: T & SameDB<DB>): DeleteExpression<T, NoTableOrViewRequired<DB> | T> {
        return new DeleteQueryBuilder(this.__sqlBuilder, table, false) as any
    }
    deleteAllowingNoWhereFrom<T extends ITable<any>>(table: T & SameDB<DB>): DeleteExpressionAllowingNoWhere<T, NoTableOrViewRequired<DB> | T> {
        return new DeleteQueryBuilder(this.__sqlBuilder, table, true) as any
    }
    selectFrom<T extends ITableOrView<any>>(table: T & SameDB<DB>): SelectExpression<T | NoTableOrViewRequired<DB>, NoTableOrViewRequired<DB>, never> {
        return new SelectQueryBuilder(this.__sqlBuilder, [table], false) as any // cast to any to improve typescript performace
    }
    selectDistinctFrom<T extends ITableOrView<any>>(table: T & SameDB<DB>): SelectExpression<T | NoTableOrViewRequired<DB>, NoTableOrViewRequired<DB>, 'distinct'> {
        return new SelectQueryBuilder(this.__sqlBuilder, [table], true) as any // cast to any to improve typescript performace
    }
    selectFromNoTable(): SelectExpressionFromNoTable<NoTableOrViewRequired<DB>, NoTableOrViewRequired<DB>, never> {
        return new SelectQueryBuilder(this.__sqlBuilder, [], false) as any // cast to any to improve typescript performace
    }
    subSelectUsing<T extends ITableOrView<any> | ForUseInLeftJoin<any>>(table: T & SameDB<DB>): SelectExpressionSubquery<T | NoTableOrViewRequired<DB>, T | NoTableOrViewRequired<DB>, never>
    subSelectUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | NoTableOrViewRequired<DB>, T1 | T2 | NoTableOrViewRequired<DB>, never>
    subSelectUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | NoTableOrViewRequired<DB>, never>
    subSelectUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>, T4 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>, table4: T4 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | T4 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | T4 | NoTableOrViewRequired<DB>, never>
    subSelectUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>, T4 extends ITableOrView<any> | ForUseInLeftJoin<any>, T5 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>, table4: T4 & SameDB<DB>, table5: T4 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, never>
    subSelectUsing(...tables: any[]): SelectExpressionSubquery<any, any, never> {
        const result = new SelectQueryBuilder(this.__sqlBuilder, [], false)
        result.__subSelectUsing = tables
        return result as any // cast to any to improve typescript performace
    }
    subSelectDistinctUsing<T extends ITableOrView<any> | ForUseInLeftJoin<any>>(table: T & SameDB<DB>): SelectExpressionSubquery<T | NoTableOrViewRequired<DB>, T | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | NoTableOrViewRequired<DB>, T1 | T2 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>, T4 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>, table4: T4 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | T4 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | T4 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>, T4 extends ITableOrView<any> | ForUseInLeftJoin<any>, T5 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>, table4: T4 & SameDB<DB>, table5: T4 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing(...tables: any[]): SelectExpressionSubquery<any, any, 'distinct'> {
        const result = new SelectQueryBuilder(this.__sqlBuilder, [], false)
        result.__subSelectUsing = tables
        return result as any // cast to any to improve typescript performace
    }

    default(): Default {
        return new DefaultImpl()
    }
    pi(): NumberValueSource<NNoTableOrViewRequired<DB>, 'required'>
    pi(): any {
        return new SqlOperationStatic0ValueSource('_pi', 'double', 'double', 'required', undefined)
    }
    random(): NumberValueSource<NNoTableOrViewRequired<DB>, 'required'>
    random(): any {
        return new SqlOperationStatic0ValueSource('_random', 'double', 'double', 'required', undefined)
    }
    currentDate(): LocalDateValueSource<NNoTableOrViewRequired<DB>, 'required'>
    currentDate(): any {
        return new SqlOperationStatic0ValueSource('_currentDate', 'localDate', 'localDate', 'required', undefined)
    }
    currentTime(): LocalTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>
    currentTime(): any {
        return new SqlOperationStatic0ValueSource('_currentTime', 'localTime', 'localTime', 'required', undefined)
    }
    currentDateTime(): LocalDateTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>
    currentDateTime(): any {
        return new SqlOperationStatic0ValueSource('_currentTimestamp', 'localDateTime', 'localDateTime', 'required', undefined)
    }
    currentTimestamp(): LocalDateTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>
    currentTimestamp(): any {
        return new SqlOperationStatic0ValueSource('_currentTimestamp', 'localDateTime', 'localDateTime', 'required', undefined)
    }

    const(value: boolean, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: number, type: 'int', adapter?: TypeAdapter): NumberValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: bigint, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: number, type: 'double', adapter?: TypeAdapter): NumberValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: string, type: 'string', adapter?: TypeAdapter): StringValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: Date, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: Date, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: Date, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T>(value: T, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const<T>(value: T, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>
    const(value: any, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<NoTableRequired, T, TYPE_NAME, 'required'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new SqlOperationConstValueSource(value, type as ValueType, adapter, 'required', adapter2)
        }
        return new SqlOperationConstValueSource(value, type as ValueType, type, 'required', adapter)
    }

    optionalConst(value: boolean | null | undefined, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: number | null | undefined, type: 'int', adapter?: TypeAdapter): NumberValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: bigint | null | undefined, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: number | null | undefined, type: 'double', adapter?: TypeAdapter): NumberValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: string | null | undefined, type: 'string', adapter?: TypeAdapter): StringValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: string | null | undefined, type: 'uuid', adapter?: TypeAdapter): UuidValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: Date | null | undefined, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: Date | null | undefined, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: Date | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst<T>(value: T | null | undefined, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    optionalConst(value: any, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<NoTableRequired, T, TYPE_NAME, 'optional'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new SqlOperationConstValueSource(value, type as ValueType, adapter, 'optional', adapter2)
        }
        return new SqlOperationConstValueSource(value, type as ValueType, type, 'optional', adapter)
    }

    true(): BooleanValueSource<NNoTableOrViewRequired<DB>, 'required'> {
        return new SqlOperationStaticBooleanValueSource('_true')
    }
    false(): BooleanValueSource<NNoTableOrViewRequired<DB>, 'required'> {
        return new SqlOperationStaticBooleanValueSource('_false')
    }
    exists<SOURCE extends NSource>(select: IExecutableSelectQuery<SOURCE, any, any> & SameDB<DB>): BooleanValueSource<SOURCE, 'required'> {
        return new SqlOperationStatic1ValueSource('_exists', select, 'boolean', 'boolean', 'required', undefined)
    }
    notExists<SOURCE extends NSource>(select: IExecutableSelectQuery<SOURCE, any, any> & SameDB<DB>): BooleanValueSource<SOURCE, 'required'> {
        return new SqlOperationStatic1ValueSource('_notExists', select, 'boolean', 'boolean', 'required', undefined)
    }

    protected executeProcedure(procedureName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[]): Promise<void> {
        try {
            const queryParams: any[] = []
            const query = this.__sqlBuilder._buildCallProcedure(queryParams, procedureName, params)
            const source = new Error('Query executed at')
            __setQueryMetadata(source, params)
            return this.__sqlBuilder._queryRunner.executeProcedure(query, queryParams).catch((e) => {
                throw new ChainedError(e)
            }).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'boolean', required: 'required', adapter?: TypeAdapter): Promise<boolean>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'boolean', required: 'optional', adapter?: TypeAdapter): Promise<boolean | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'int', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'int', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'bigint', required: 'required', adapter?: TypeAdapter): Promise<bigint>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'bigint', required: 'optional', adapter?: TypeAdapter): Promise<bigint | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'double', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'double', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'string', required: 'required', adapter?: TypeAdapter): Promise<string>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'string', required: 'optional', adapter?: TypeAdapter): Promise<string | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'uuid', required: 'required', adapter?: TypeAdapter): Promise<string>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'uuid', required: 'optional', adapter?: TypeAdapter): Promise<string | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDate', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDate', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDateTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customUuid', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customUuid', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDate', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDate', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDateTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'enum', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'enum', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'custom', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'custom', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customComparable', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customComparable', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customInt', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customInt', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDouble', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDouble', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customUuid', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customUuid', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDate', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDate', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalTime', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalTime', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDateTime', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customLocalDateTime', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Promise<any> {
        try {
            if (typeof adapter === 'string') {
                returnType = required
                required = adapter
            } else {
                adapter2 = adapter
            }
            const queryParams: any[] = []
            const query = this.__sqlBuilder._buildCallFunction(queryParams, functionName, params)
            const source = new Error('Query executed at')
            __setQueryMetadata(source, params)
            return this.__sqlBuilder._queryRunner.executeFunction(query, queryParams).then((value) => {
                let result
                if (adapter2) {
                    result = adapter2.transformValueFromDB(value, returnType, this.__sqlBuilder._defaultTypeAdapter)
                } else {
                    result = this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, returnType)
                }
                if (result === null || result === undefined) {
                    if (required !== 'optional') {
                        throw new Error('Expected a value as result of the function `' + functionName + '`, but null or undefined value was found')
                    }
                }
                return result
            }).catch((e) => {
                throw new ChainedError(e)
            }).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    fragmentWithType(type: 'boolean', required: 'required', adapter?: TypeAdapter): BooleanFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'boolean', required: 'optional', adapter?: TypeAdapter): BooleanFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'int', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'int', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'bigint', required: 'required', adapter?: TypeAdapter): BigintFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'bigint', required: 'optional', adapter?: TypeAdapter): BigintFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'double', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'double', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'string', required: 'required', adapter?: TypeAdapter): StringFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'string', required: 'optional', adapter?: TypeAdapter): StringFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'uuid', required: 'required', adapter?: TypeAdapter): UuidFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'uuid', required: 'optional', adapter?: TypeAdapter): UuidFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'localDate', required: 'required', adapter?: TypeAdapter):  LocalDateFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'localDate', required: 'optional', adapter?: TypeAdapter):  LocalDateFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'localTime', required: 'required', adapter?: TypeAdapter): LocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'localTime', required: 'optional', adapter?: TypeAdapter): LocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'localDateTime', required: 'required', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomUuidFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomUuidFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomLocalDateFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomLocalDateFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomLocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomLocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): ComparableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): ComparableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T>(type: 'customInt', typeName: string, required: 'required', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'customInt', typeName: string, required: 'optional', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'customDouble', typeName: string, required: 'required', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'customDouble', typeName: string, required: 'optional', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'customUuid', typeName: string, required: 'required', adapter?: TypeAdapter): CustomUuidFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'customUuid', typeName: string, required: 'optional', adapter?: TypeAdapter): CustomUuidFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'customLocalDate', typeName: string, required: 'required', adapter?: TypeAdapter): CustomLocalDateFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'customLocalDate', typeName: string, required: 'optional', adapter?: TypeAdapter): CustomLocalDateFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'customLocalTime', typeName: string, required: 'required', adapter?: TypeAdapter): CustomLocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'customLocalTime', typeName: string, required: 'optional', adapter?: TypeAdapter): CustomLocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'customLocalDateTime', typeName: string, required: 'required', adapter?: TypeAdapter): CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'customLocalDateTime', typeName: string, required: 'optional', adapter?: TypeAdapter): CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType<T>(type: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): ComparableFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'required'>
    fragmentWithType<T>(type: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): ComparableFragmentExpression<NNoTableOrViewRequired<DB>, T, T, 'optional'>
    fragmentWithType(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            type = required
            required = adapter
        } else {
            adapter2 = adapter
        }
        return new FragmentQueryBuilder(type as ValueType, type, required as any, adapter2)
    }

    protected arg(type: 'boolean', required: 'required', adapter?: TypeAdapter): Argument<'boolean', 'required', 'combined', boolean>
    protected arg(type: 'boolean', required: 'optional', adapter?: TypeAdapter): Argument<'boolean', 'optional', 'combined', boolean>
    protected arg(type: 'int', required: 'required', adapter?: TypeAdapter): Argument<'int', 'required', 'combined', number>
    protected arg(type: 'int', required: 'optional', adapter?: TypeAdapter): Argument<'int', 'optional', 'combined', number>
    protected arg(type: 'bigint', required: 'required', adapter?: TypeAdapter): Argument<'bigint', 'required', 'combined', bigint>
    protected arg(type: 'bigint', required: 'optional', adapter?: TypeAdapter): Argument<'bigint', 'optional', 'combined', bigint>
    protected arg(type: 'double', required: 'required', adapter?: TypeAdapter): Argument<'double', 'required', 'combined', number>
    protected arg(type: 'double', required: 'optional', adapter?: TypeAdapter): Argument<'double', 'optional', 'combined', number>
    protected arg(type: 'string', required: 'required', adapter?: TypeAdapter): Argument<'string', 'required', 'combined', string>
    protected arg(type: 'string', required: 'optional', adapter?: TypeAdapter): Argument<'string', 'optional', 'combined', string>
    protected arg(type: 'uuid', required: 'required', adapter?: TypeAdapter): Argument<'uuid', 'required', 'combined', string>
    protected arg(type: 'uuid', required: 'optional', adapter?: TypeAdapter): Argument<'uuid', 'optional', 'combined', string>
    protected arg(type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'combined', Date>
    protected arg(type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'combined', Date>
    protected arg(type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'combined', Date>
    protected arg(type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'combined', Date>
    protected arg(type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'combined', Date>
    protected arg(type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'combined', Date>
    protected arg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customInt', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customInt', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customDouble', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customDouble', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customUuid', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customUuid', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDate', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDate', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customLocalTime', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalTime', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'enum', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'enum', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'custom', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'custom', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customComparable', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customComparable', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T>(type: 'customInt', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customInt', 'required', 'combined', T, T>
    protected arg<T>(type: 'customInt', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customInt', 'optional', 'combined', T, T>
    protected arg<T>(type: 'customDouble', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customDouble', 'required', 'combined', T, T>
    protected arg<T>(type: 'customDouble', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customDouble', 'optional', 'combined', T, T>
    protected arg<T>(type: 'customUuid', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customUuid', 'required', 'combined', T, T>
    protected arg<T>(type: 'customUuid', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customUuid', 'optional', 'combined', T, T>
    protected arg<T>(type: 'customLocalDate', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDate', 'required', 'combined', T, T>
    protected arg<T>(type: 'customLocalDate', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDate', 'optional', 'combined', T, T>
    protected arg<T>(type: 'customLocalTime', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customLocalTime', 'required', 'combined', T, T>
    protected arg<T>(type: 'customLocalTime', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalTime', 'optional', 'combined', T, T>
    protected arg<T>(type: 'customLocalDateTime', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'required', 'combined', T, T>
    protected arg<T>(type: 'customLocalDateTime', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'optional', 'combined', T, T>
    protected arg<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'enum', 'required', 'combined', T, T>
    protected arg<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'enum', 'optional', 'combined', T, T>
    protected arg<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'custom', 'required', 'combined', T, T>
    protected arg<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'custom', 'optional', 'combined', T, T>
    protected arg<T>(type: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customComparable', 'required', 'combined', T, T>
    protected arg<T>(type: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customComparable', 'optional', 'combined', T, T>
    protected arg(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new Argument(type as any, adapter, required as any, 'combined', adapter2)
        } else {
            return new Argument(type as any, type, required as any, 'combined', adapter)
        }
    }

    protected valueArg(type: 'boolean', required: 'required', adapter?: TypeAdapter): Argument<'boolean', 'required', 'value', boolean>
    protected valueArg(type: 'boolean', required: 'optional', adapter?: TypeAdapter): Argument<'boolean', 'optional', 'value', boolean>
    protected valueArg(type: 'int', required: 'required', adapter?: TypeAdapter): Argument<'int', 'required', 'value', number>
    protected valueArg(type: 'int', required: 'optional', adapter?: TypeAdapter): Argument<'int', 'optional', 'value', number>
    protected valueArg(type: 'bigint', required: 'required', adapter?: TypeAdapter): Argument<'bigint', 'required', 'value', bigint>
    protected valueArg(type: 'bigint', required: 'optional', adapter?: TypeAdapter): Argument<'bigint', 'optional', 'value', bigint>
    protected valueArg(type: 'double', required: 'required', adapter?: TypeAdapter): Argument<'double', 'required', 'value', number>
    protected valueArg(type: 'double', required: 'optional', adapter?: TypeAdapter): Argument<'double', 'optional', 'value', number>
    protected valueArg(type: 'string', required: 'required', adapter?: TypeAdapter): Argument<'string', 'required', 'value', string>
    protected valueArg(type: 'string', required: 'optional', adapter?: TypeAdapter): Argument<'string', 'optional', 'value', string>
    protected valueArg(type: 'uuid', required: 'required', adapter?: TypeAdapter): Argument<'uuid', 'required', 'value', string>
    protected valueArg(type: 'uuid', required: 'optional', adapter?: TypeAdapter): Argument<'uuid', 'optional', 'value', string>
    protected valueArg(type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'value', Date>
    protected valueArg(type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'value', Date>
    protected valueArg(type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'value', Date>
    protected valueArg(type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'value', Date>
    protected valueArg(type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'value', Date>
    protected valueArg(type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'value', Date>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customInt', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customInt', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customDouble', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customDouble', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customUuid', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customUuid', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDate', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDate', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customLocalTime', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalTime', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'enum', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'enum', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'custom', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'custom', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customComparable', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customComparable', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T>(type: 'customInt', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customInt', 'required', 'value', T, T>
    protected valueArg<T>(type: 'customInt', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customInt', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'customDouble', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customDouble', 'required', 'value', T, T>
    protected valueArg<T>(type: 'customDouble', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customDouble', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'customUuid', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customUuid', 'required', 'value', T, T>
    protected valueArg<T>(type: 'customUuid', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customUuid', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'customLocalDate', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDate', 'required', 'value', T, T>
    protected valueArg<T>(type: 'customLocalDate', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDate', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'customLocalTime', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customLocalTime', 'required', 'value', T, T>
    protected valueArg<T>(type: 'customLocalTime', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalTime', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'customLocalDateTime', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'required', 'value', T, T>
    protected valueArg<T>(type: 'customLocalDateTime', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customLocalDateTime', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'enum', 'required', 'value', T, T>
    protected valueArg<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'enum', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'custom', 'required', 'value', T, T>
    protected valueArg<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'custom', 'optional', 'value', T, T>
    protected valueArg<T>(type: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customComparable', 'required', 'value', T, T>
    protected valueArg<T>(type: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customComparable', 'optional', 'value', T, T>
    protected valueArg(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new Argument(type as any, adapter, required as any, 'value', adapter2)
        } else {
            return new Argument(type as any, type, required as any, 'value', adapter)
        }
    }

    protected buildFragmentWithArgs(): FragmentBuilder0<DB>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilder1<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilder2<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgs(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilder(args)
    }

    protected buildFragmentWithArgsIfValue(): FragmentBuilder0IfValue<DB>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilder1IfValue<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilder2IfValue<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgsIfValue(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilderIfValue(this as any, args) // make this protected fields as public
    }

    protected buildFragmentWithMaybeOptionalArgs(): FragmentBuilderMaybeOptional0<DB>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilderMaybeOptional1<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilderMaybeOptional2<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilderMaybeOptional3<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilderMaybeOptional4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilderMaybeOptional5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithMaybeOptionalArgs(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilderMaybeOptional(this as any, args)
    }

    rawFragment(sql: TemplateStringsArray): RawFragment<NNoTableOrViewRequired<DB>>
    rawFragment<T1 extends NSource>(sql: TemplateStringsArray, p1: RawFragmentArg<T1, DB>): RawFragment<T1>
    rawFragment<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: RawFragmentArg<T1, DB>, p2: RawFragmentArg<T2, DB>): RawFragment<T1 | T2>
    rawFragment<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: RawFragmentArg<T1, DB>, p2: RawFragmentArg<T2, DB>, p3: RawFragmentArg<T3, DB>): RawFragment<T1 | T2 | T3>
    rawFragment<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: RawFragmentArg<T1, DB>, p2: RawFragmentArg<T2, DB>, p3: RawFragmentArg<T3, DB>, p4: RawFragmentArg<T4, DB>): RawFragment<T1 | T2 | T3 | T4>
    rawFragment<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: RawFragmentArg<T1, DB>, p2: RawFragmentArg<T2, DB>, p3: RawFragmentArg<T3, DB>, p4: RawFragmentArg<T4, DB>, p5: RawFragmentArg<T5, DB>): RawFragment<T1 | T2 | T3 | T4 | T5>
    rawFragment<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: RawFragmentArg<T1, DB>, p2: RawFragmentArg<T2, DB>, p3: RawFragmentArg<T3, DB>, p4: RawFragmentArg<T4, DB>, p5: RawFragmentArg<T5, DB>, p6: RawFragmentArg<T6, DB>): RawFragment<T1 | T2 | T3 | T4 | T5 | T6>
    rawFragment<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: RawFragmentArg<T1, DB>, p2: RawFragmentArg<T2, DB>, p3: RawFragmentArg<T3, DB>, p4: RawFragmentArg<T4, DB>, p5: RawFragmentArg<T5, DB>, p6: RawFragmentArg<T6, DB>, p7: RawFragmentArg<T7, DB>): RawFragment<T1 | T2 | T3 | T4 | T5 | T6 | T7>
    rawFragment<T extends NSource>(sql: TemplateStringsArray, ...p: Array<RawFragmentArg<T, DB>>): RawFragment<T>
    rawFragment(sql: TemplateStringsArray, ...params: any): RawFragment<any> {
        return new RawFragmentImpl(sql, params)
    }

    protected createTableOrViewCustomization(fn: (table: ValueSourceOf<NNoTableOrViewRequired<DB>>, alias: ValueSourceOf<NNoTableOrViewRequired<DB>>) => RawFragment<NNoTableOrViewRequired<DB>>): (<T extends ITableOrView<any>, NAME extends string>(tableOrView: T & SameDB<DB>, name: NAME) => CustomizedTableOrView<T, NAME>)
    protected createTableOrViewCustomization<P1>(fn: (table: ValueSourceOf<NNoTableOrViewRequired<DB>>, alias: ValueSourceOf<NNoTableOrViewRequired<DB>>, p1: P1) => RawFragment<NNoTableOrViewRequired<DB>>): (<T extends ITableOrView<any>, NAME extends string>(tableOrView: T & SameDB<DB>, name: NAME, p1: P1) => CustomizedTableOrView<T, NAME>)
    protected createTableOrViewCustomization<P1, P2>(fn: (table: ValueSourceOf<NNoTableOrViewRequired<DB>>, alias: ValueSourceOf<NNoTableOrViewRequired<DB>>, p1: P1, p2: P2) => RawFragment<NNoTableOrViewRequired<DB>>): (<T extends ITableOrView<any>, NAME extends string>(tableOrView: T & SameDB<DB>, name: NAME, p1: P1, p2: P2) => CustomizedTableOrView<T, NAME>)
    protected createTableOrViewCustomization<P1, P2, P3>(fn: (table: ValueSourceOf<NNoTableOrViewRequired<DB>>, alias: ValueSourceOf<NNoTableOrViewRequired<DB>>, p1: P1, p2: P2, p3: P3) => RawFragment<NNoTableOrViewRequired<DB>>): (<T extends ITableOrView<any>, NAME extends string>(tableOrView: T & SameDB<DB>, name: NAME, p1: P1, p2: P2, p3: P3) => CustomizedTableOrView<T, NAME>)
    protected createTableOrViewCustomization<P1, P2, P3, P4>(fn: (table: ValueSourceOf<NNoTableOrViewRequired<DB>>, alias: ValueSourceOf<NNoTableOrViewRequired<DB>>, p1: P1, p2: P2, p3: P3, p4: P4) => RawFragment<NNoTableOrViewRequired<DB>>): (<T extends ITableOrView<any>, NAME extends string>(tableOrView: T & SameDB<DB>, name: NAME, p1: P1, p2: P2, p3: P3, p4: P4) => CustomizedTableOrView<T, NAME>)
    protected createTableOrViewCustomization<P1, P2, P3, P4, P5>(fn: (table: ValueSourceOf<NNoTableOrViewRequired<DB>>, alias: ValueSourceOf<NNoTableOrViewRequired<DB>>, p1: P1, p2: P2, p3: P3, p4: P4, p5: P5) => RawFragment<NNoTableOrViewRequired<DB>>): (<T extends ITableOrView<any>, NAME extends string>(tableOrView: T & SameDB<DB>, name: NAME, p1: P1, p2: P2, p3: P3, p4: P4, p5: P5) => CustomizedTableOrView<T, NAME>)
    protected createTableOrViewCustomization(fn: (table: ValueSourceOf<NNoTableOrViewRequired<DB>>, alias: ValueSourceOf<NNoTableOrViewRequired<DB>>, ...params: any[]) => RawFragment<NNoTableOrViewRequired<DB>>): (<T extends ITableOrView<any>, NAME extends string>(tableOrView: T, name: NAME, ...params: any[]) => CustomizedTableOrView<T, NAME>) {
        return (tableOrView: ITableOrView<any>, name: string, ...params: any[]) => {
            const as = __getTableOrViewPrivate(tableOrView).__as
            const result = (tableOrView as any).as(as)
            const table = new TableOrViewRawFragmentValueSource(result, '_rawFragmentTableName')
            const alias = new TableOrViewRawFragmentValueSource(result, '_rawFragmentTableAlias')
            const template = fn(table, alias, ...params)
            const p = __getTableOrViewPrivate(result)
            p.__template = template
            p.__customizationName = name
            return result as any
        }
    }

    noValueBoolean(): IfValueSource<NNoTableOrViewRequired<DB>, 'required'> {
        return new SqlOperationValueSourceIfValueAlwaysNoop()
    }

    dynamicBooleanExpressionUsing<SOURCE extends NSource>(table: ITableOrView<SOURCE> & SameDB<DB>): AlwaysIfValueSource<SOURCE | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource, S4 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>, table4: ITableOrView<S4> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | S4 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource, S4 extends NSource, S5 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>, table4: ITableOrView<S4> & SameDB<DB>, table5: ITableOrView<S5> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | S4 | S5 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing(..._tables: any[]): AlwaysIfValueSource<any, any> {
        return new SqlOperationValueSourceIfValueAlwaysNoop()
    }

    // Agregate functions
    countAll(): NumberValueSource<NNoTableOrViewRequired<DB>, 'required'> {
        return new AggregateFunctions0ValueSource('_countAll', 'int', 'int', 'required', undefined)
    }
    count<SOURCE extends NSource>(value: ValueSourceOf<SOURCE> & SameDB<DB>): NumberValueSource<SOURCE, 'required'> {
        return new AggregateFunctions1ValueSource('_count', value, 'int', 'int', 'required', undefined)
    }
    countDistinct<SOURCE extends NSource>(value: ValueSourceOf<SOURCE> & SameDB<DB>): NumberValueSource<SOURCE, 'required'> {
        return new AggregateFunctions1ValueSource('_countDistinct', value, 'int', 'int', 'required', undefined)
    }
    max<TYPE extends IComparableValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source], TYPE, 'optional'> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_max', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)) as any
    }
    min<TYPE extends IComparableValueSource<NSource, any, any, any>>(value: TYPE & SameDB<DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source], TYPE, 'optional'> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_min', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)) as any
    }
    sum<SOURCE extends NSource>(value: INumberValueSource<SOURCE, any> & SameDB<DB>): NumberValueSource<SOURCE, 'optional'>
    sum<SOURCE extends NSource>(value: IBigintValueSource<SOURCE, any> & SameDB<DB>): BigintValueSource<SOURCE, 'optional'>
    sum<TYPE extends ICustomIntValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomIntValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sum<TYPE extends ICustomDoubleValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomDoubleValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sum(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_sum', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    sumDistinct<SOURCE extends NSource>(value: INumberValueSource<SOURCE, any> & SameDB<DB>): NumberValueSource<SOURCE, 'optional'>
    sumDistinct<SOURCE extends NSource>(value: IBigintValueSource<SOURCE, any> & SameDB<DB>): BigintValueSource<SOURCE, 'optional'>
    sumDistinct<TYPE extends ICustomIntValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomIntValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sumDistinct<TYPE extends ICustomDoubleValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomDoubleValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sumDistinct(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_sumDistinct', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    average<SOURCE extends NSource>(value: INumberValueSource<SOURCE, any> & SameDB<DB>): NumberValueSource<SOURCE, 'optional'>
    average<SOURCE extends NSource>(value: IBigintValueSource<SOURCE, any> & SameDB<DB>): BigintValueSource<SOURCE, 'optional'>
    average<TYPE extends ICustomIntValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomIntValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    average<TYPE extends ICustomDoubleValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomDoubleValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    average(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_average', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    averageDistinct<SOURCE extends NSource>(value: INumberValueSource<SOURCE, any> & SameDB<DB>): NumberValueSource<SOURCE, 'optional'>
    averageDistinct<SOURCE extends NSource>(value: IBigintValueSource<SOURCE, any> & SameDB<DB>): BigintValueSource<SOURCE, 'optional'>
    averageDistinct<TYPE extends ICustomIntValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomIntValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    averageDistinct<TYPE extends ICustomDoubleValueSource<any, any, any, any>>(value: TYPE & SameDB<DB>): CustomDoubleValueSource<TYPE[typeof source], TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    averageDistinct(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_averageDistinct', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    stringConcat<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<DB>): StringValueSource<SOURCE, 'optional'>
    stringConcat<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<DB>, separator: string): StringValueSource<SOURCE, 'optional'>
    stringConcat(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcat', separator, value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<DB>): StringValueSource<SOURCE, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<DB>, separator: string): StringValueSource<SOURCE, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcatDistinct', separator, value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }

    aggregateAsArray<COLUMNS extends AggregatedArrayColumns<DB>>(columns: COLUMNS): AggregatedArrayValueSourceProjectableAsNullable<SourceOfAggregatedArray<COLUMNS>, Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>, 'required'> {
        return new AggregateValueAsArrayValueSource(columns, 'InnerResultObject', 'required')
    }
    aggregateAsArrayOfOneColumn<VALUE extends IValueSource<any, any, any, any>>(value: VALUE): AggregatedArrayValueSource<VALUE[typeof source], Array<VALUE[typeof valueType]>, 'required'> {
        return new AggregateValueAsArrayValueSource(value, 'InnerResultObject', 'required')
    }

    dynamicConditionFor<DEFINITION extends Filterable>(definition: DEFINITION): DynamicConditionExpression<DEFINITION, never>
    dynamicConditionFor<DEFINITION extends Filterable, EXTENSION extends DinamicConditionExtension>(definition: DEFINITION, extension: EXTENSION): DynamicConditionExpression<DEFINITION, EXTENSION>
    dynamicConditionFor(definition: Filterable, extension?: any): DynamicConditionExpression<any, any> {
        return new DynamicConditionBuilder(this.__sqlBuilder, definition, extension)
    }

    protected transformValueFromDB(value: unknown, type: string): unknown {
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        switch (type) {
            case 'boolean':
                if (typeof value === 'boolean') {
                    return value
                }
                if (typeof value === 'number') {
                    return !!value
                }
                if (typeof value === 'bigint') {
                    return !!value
                }
                throw new Error('Invalid boolean value received from the db: ' + value)
            case 'int':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid int value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^(-?\d+)$/g.test(value)) {
                        throw new Error('Invalid int value received from the db: ' + value)
                    }
                    const result = +value
                    if (!Number.isSafeInteger(result)) {
                        throw new Error('Unnoticed precition lost transforming a string to int number. Value: ' + value)
                    }
                    return result
                }
                if (typeof value === 'bigint') {
                    const result = Number(value)
                    if (!Number.isSafeInteger(result)) {
                        throw new Error('Unnoticed precition lost transforming a bigint to int number. Value: ' + value)
                    }
                    return result
                }
                throw new Error('Invalid int value received from the db: ' + value)
            case 'stringInt':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid stringInt value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^-?\d+$/g.test(value)) {
                        throw new Error('Invalid stringInt value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'bigint') {
                    const result = Number(value)
                    if (!Number.isSafeInteger(result)) {
                        return '' + value
                    }
                    return result
                }
                throw new Error('Invalid stringInt value received from the db: ' + value)
            case 'bigint':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid bigint value received from the db: ' + value)
                    }
                    return BigInt(value)
                }
                if (typeof value === 'string') {
                    try {
                        return BigInt(value)
                    } catch {
                        throw new Error('Invalid bigint value received from the db: ' + value)
                    }
                }
                if (typeof value === 'bigint') {
                    return value
                }
                throw new Error('Invalid int value received from the db: ' + value)
            case 'double':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^(-?\d+(\.\d+)?|NaN|-?Infinity)$/g.test(value)) {
                        throw new Error('Invalid double value received from the db: ' + value)
                    }
                    const result = +value
                    return result
                }
                if (typeof value === 'bigint') {
                    return Number(value)
                }
                throw new Error('Invalid double value received from the db: ' + value)
            case 'stringDouble':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^(-?\d+(\.\d+)?|NaN|-?Infinity)$/g.test(value)) {
                        throw new Error('Invalid stringDouble value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'bigint') {
                    const result = Number(value)
                    if (!Number.isSafeInteger(result)) {
                        return '' + value
                    }
                    return result
                }
                throw new Error('Invalid stringDouble value received from the db: ' + value)
            case 'string':
                if (typeof value === 'string') {
                    return value
                }
                throw new Error('Invalid string value received from the db: ' + value)
            case 'uuid':
                if (typeof value === 'string') {
                    return value
                }
                throw new Error('Invalid uuid value received from the db: ' + value)
            case 'localDate': {
                let result: Date
                if (value instanceof Date) {
                    // This time fix works in almost every timezone (from -10 to +13, but not +14, -11, -12, almost uninhabited)
                    result = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
                    result.setUTCMinutes(600)
                } else if (typeof value === 'string') {
                    result = new Date(value + ' 00:00') // If time is omited, UTC timezone will be used instead the local one
                    // This time fix works in almost every timezone (from -10 to +13, but not +14, -11, -12, almost uninhabited)
                    result = new Date(Date.UTC(result.getFullYear(), result.getMonth(), result.getDate()))
                    result.setUTCMinutes(600)
                } else {
                    throw new Error('Invalid localDate value received from the db: ' + value)
                }
                if (isNaN(result.getTime())) {
                    throw new Error('Invalid localDate value received from the db: ' + value)
                }
                (result as any).___type___ = 'localDate'
                return result
            }
            case 'localTime': {
                let result: Date
                if (value instanceof Date) {
                    result = value
                } else if (typeof value === 'string') {
                    result = new Date('1970-01-01 ' + value)
                } else {
                    throw new Error('Invalid localTime value received from the db: ' + value)
                }
                if (isNaN(result.getTime())) {
                    throw new Error('Invalid localTime value received from the db: ' + value)
                }
                (result as any).___type___ = 'localTime'
                return result
            }
            case 'localDateTime': {
                let result: Date
                if (value instanceof Date) {
                    result = value
                } else if (typeof value === 'string') {
                    result = new Date(value)
                } else {
                    throw new Error('Invalid localDateTime value received from the db: ' + value)
                }
                if (isNaN(result.getTime())) {
                    throw new Error('Invalid localDateTime value received from the db: ' + value)
                }
                (result as any).___type___ = 'LocalDateTime'
                return result
            }
            case 'aggregatedArray': {
                throw new Error('This would not happened, something went wrong handling aggregate arrays coming from the database')
            }
            default:
                return value
        }
    }
    protected transformValueToDB(value: unknown, type: string): unknown {
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        switch (type) {
            case 'boolean':
                if (typeof value === 'boolean') {
                    return value
                }
                throw new Error('Invalid boolean value to send to the db: ' + value)
            case 'int':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid int value to send to the db: ' + value)
                    }
                    return value
                }
                throw new Error('Invalid int value to send to the db: ' + value)
            case 'bigint':
                if (typeof value === 'bigint') {
                    return value
                }
                throw new Error('Invalid int value to send to the db: ' + value)
            case 'stringInt':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid stringInt value to send to the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^-?\d+$/g.test(value)) {
                        throw new Error('Invalid stringInt value to send to the db: ' + value)
                    }
                    return value
                }
                throw new Error('Invalid stringInt value to send to the db: ' + value)
            case 'double':
                if (typeof value === 'number') {
                    return value
                }
                throw new Error('Invalid double value to send to the db: ' + value)
            case 'stringDouble':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^(-?\d+(\.\d+)?|NaN|-?Infinity)$/g.test(value)) {
                        throw new Error('Invalid stringDouble value to send to the db: ' + value)
                    }
                    return value
                }
                throw new Error('Invalid stringDouble value to send to the db: ' + value)
            case 'string':
                if (typeof value === 'string') {
                    return value
                }
                throw new Error('Invalid string value to send to the db: ' + value)
            case 'uuid':
                if (typeof value === 'string') {
                    return value
                }
                throw new Error('Invalid uuid value to send to the db: ' + value)
            case 'localDate':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    return value
                }
                throw new Error('Invalid localDate value to send to the db: ' + value)
            case 'localTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    let result = ''
                    if (value.getHours() > 9) {
                        result += value.getHours()
                    } else {
                        result += '0' + value.getHours()
                    }
                    result += ':'
                    if (value.getMinutes() > 9) {
                        result += value.getMinutes()
                    } else {
                        result += '0' + value.getMinutes()
                    }
                    result += ':'
                    if (value.getSeconds() > 9) {
                        result += value.getSeconds()
                    } else {
                        result += '0' + value.getSeconds()
                    }
                    if (value.getMilliseconds() > 0) {
                        result += '.'
                        if (value.getMilliseconds() > 99) {
                            result += value.getMilliseconds()
                        } else if (value.getMilliseconds() > 9) {
                            result += '0' + value.getMilliseconds()
                        } else {
                            result += '00' + value.getMilliseconds()
                        }
                    }
                    return result
                }
                throw new Error('Invalid localTime value to send to the db: ' + value)
            case 'localDateTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    return value
                }
                throw new Error('Invalid localDateTime value to send to the db: ' + value)
            case 'aggregatedArray': {
                throw new Error('This would not happened, something went wrong handling aggregate arrays, aggregated arrays cannot be sent to the database')
            }
            default:
                return value
        }
    }

    protected transformPlaceholder(placeholder: string, _type: string, _forceTypeCast: boolean, _valueSentToDB: unknown): string {
        return placeholder
    }

    protected isReservedKeyword(word: string): boolean {
        return this.__sqlBuilder._isReservedKeyword(word)

    }
    protected forceAsIdentifier(identifier: string): string {
        return this.__sqlBuilder._forceAsIdentifier(identifier)
    }
    protected escape(identifier: string, strict: boolean): string {
        if (strict && !/^[a-zA-Z_][a-zA-Z0-9_]+$/.test(identifier)) {
            return this.forceAsIdentifier(identifier)
        }
        if (this.isReservedKeyword(identifier) || identifier.indexOf(' ') >= 0) {
            return this.forceAsIdentifier(identifier)
        }
        return identifier
    }

}

export type RawFragmentArg<T extends NSource, DB extends NDB> = HasSource<T> & SameDB<DB> & (AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>)

export interface TransactionIsolationLevel {
    [transactionIsolationLevel]: 'transactionIsolationLevel'
}

type AggregatedArrayColumns<DB extends NDB> = DataToProject<NWithDB<DB>>
type SourceOfAggregatedArray<TYPE> = GetDataToProjectSource<TYPE>
