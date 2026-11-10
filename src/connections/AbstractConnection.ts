import type { QueryColumns, SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { InsertExpression } from '../expressions/insert.js'
import type { UpdateExpression, UpdateExpressionAllowingNoWhere } from '../expressions/update.js'
import type { DeleteExpression, DeleteExpressionAllowingNoWhere } from '../expressions/delete.js'
import type { BooleanValueSource, NumberValueSource, StringValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, EqualableValueSource, ComparableValueSource, IfValueSource, IComparableValueSource, INumberValueSource, IStringValueSource, IStringDecimalValueSource, IExecutableSelectQuery, BigintValueSource, IBigintValueSource, AlwaysIfValueSource, ValueSourceOf, RemapValueSourceTypeWithOptionalType, IValueSource, UuidValueSource, StringDecimalValueSource, IExecutableInsertQuery, IExecutableUpdateQuery, IExecutableDeleteQuery, AggregatedArrayValueSourceProjectableAsNullable, AggregatedArrayValueSource, ValueType, CustomIntValueSource, CustomBigintValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomDecimalValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource, CustomLocalDateTimeValueSource, ICustomIntValueSource, ICustomBigintValueSource, ICustomDoubleValueSource, AnyValueSource, ICustomDecimalValueSource } from '../expressions/values.js'
import type { NoTableOrViewRequired, ITableOrView, ITable, SameDB, HasSource, ForUseInLeftJoin, AnyTableOrView } from '../utils/ITableOrView.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import type { SelectExpression, SelectExpressionFromNoTable, SelectExpressionSubquery } from '../expressions/select.js'
import type { TypeAdapter, DefaultTypeAdapter, TypeCategory, ProjectionOutput } from '../TypeAdapter.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import type { IConnection } from '../utils/IConnection.js'
import type { BooleanFragmentExpression, NumberFragmentExpression, StringFragmentExpression, LocalDateFragmentExpression, LocalTimeFragmentExpression, LocalDateTimeFragmentExpression, EqualableFragmentExpression, ComparableFragmentExpression, FragmentBuilder0, FragmentBuilder1, FragmentBuilder2, FragmentBuilder3, FragmentBuilder4, FragmentBuilder5, FragmentBuilder0IfValue, FragmentBuilder1IfValue, FragmentBuilder2IfValue, FragmentBuilder3IfValue, FragmentBuilder4IfValue, FragmentBuilder5IfValue, BigintFragmentExpression, UuidFragmentExpression, StringDecimalFragmentExpression, CustomIntFragmentExpression, CustomBigintFragmentExpression, CustomDoubleFragmentExpression, CustomUuidFragmentExpression, CustomDecimalFragmentExpression, CustomLocalDateFragmentExpression, CustomLocalTimeFragmentExpression, CustomLocalDateTimeFragmentExpression, FragmentBuilderMaybeOptional0, FragmentBuilderMaybeOptional1, FragmentBuilderMaybeOptional2, FragmentBuilderMaybeOptional3, FragmentBuilderMaybeOptional4, FragmentBuilderMaybeOptional5 } from '../expressions/fragment.js'
import { InsertQueryBuilder } from '../queryBuilders/InsertQueryBuilder.js'
import { UpdateQueryBuilder } from '../queryBuilders/UpdateQueryBuilder.js'
import { DeleteQueryBuilder } from '../queryBuilders/DeleteQueryBuilder.js'
import { __getValueSourcePrivate, Argument } from '../expressions/values.js'
import { SqlOperationStatic0ValueSource, SqlOperationStatic1ValueSource, AggregateFunctions0ValueSource, AggregateFunctions1ValueSource, AggregateFunctions1or2ValueSource, SqlOperationConstValueSource, SqlOperationValueSourceIfValueAlwaysNoop, SqlOperationStaticBooleanValueSource, TableOrViewRawFragmentValueSource, AggregateValueAsArrayValueSource, FunctionCallValueSource } from '../internal/ValueSourceImpl.js'
import { SelectQueryBuilder } from '../queryBuilders/SelectQueryBuilder.js'
import { TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError, QueryExecutionSource } from '../TsSqlError.js'
import { FragmentQueryBuilder, FragmentFunctionBuilder, FragmentFunctionBuilderIfValue, FragmentFunctionBuilderMaybeOptional } from '../queryBuilders/FragmentQueryBuilder.js'
import { connection, source, transactionIsolationLevel, typeName, valueType } from '../utils/symbols.js'
import { callDeferredFunctions, callDeferredFunctionsStoppingOnError, isPromise } from '../utils/PromiseUtils.js'
import type { DynamicConditionExtension, DynamicConditionExpression, Filterable } from '../expressions/dynamicConditionUsingFilters.js'
import { DynamicConditionBuilder } from '../queryBuilders/DynamicConditionBuilder.js'
import type { RawFragment } from '../utils/RawFragment.js'
import { RawFragmentImpl } from '../internal/RawFragmentImpl.js'
import type { CustomizedTableOrView } from '../utils/tableOrViewUtils.js'
import { __setQueryMetadata, __unnamedResultColumn } from '../queryBuilders/AbstractQueryBuilder.js'
import type { NAggregate, NDB, NNoTableOrViewRequired, NNotNestedAggregate, NSource, NWithDB } from '../utils/sourceName.js'
import type { DataToProject, GetDataToProjectSource } from '../complexProjections/dataToProject.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { __conversionType, __typeCategoryOf } from '../utils/typeCategory.js'
import { parseUtcDateTimeText } from '../utils/utcDateTimeText.js'

export abstract class AbstractConnection</*in|out*/ DB extends NDB> implements IConnection<DB> {
    [connection]!: DB

    protected __sqlBuilder: SqlBuilder
    protected allowEmptyString: boolean = false
    protected insensitiveCollation?: string | undefined
    /**
     * Minimum database version the generated SQL must support, encoded as a single
     * integer that packs `major.minor.patch` using three digits for each part
     * (zero-padded on the left): `major * 1_000_000 + minor * 1_000 + patch`. The
     * numeric separator underscore is recommended for readability — e.g.
     * `10_005_000` for MariaDB 10.5, `3_029_000` for SQLite 3.29, `8_000_019` for
     * MySQL 8.0.19. Patch precision matters because some engines (notably MySQL
     * before 8.0.34) added new dialect features in patch releases.
     *
     * The default `Number.POSITIVE_INFINITY` means "latest" — every supported
     * dialect feature is emitted. Lower values progressively turn off features
     * introduced after that version. Each database-specific connection documents
     * the breakpoints it recognises; you may still set any version number you
     * like (your real database version), even one we don't recognise as a
     * breakpoint — it simply behaves the same as the nearest recognised lower
     * breakpoint.
     */
    protected compatibilityVersion: number = Number.POSITIVE_INFINITY
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

    private beforeCommit?: Array<() => void | Promise<void>> | null | undefined
    private onCommit?: Array<() => void | Promise<void>> | null | undefined
    private onRollback?: Array<() => void | Promise<void>> | null | undefined
    private transactionMetadata?: Map<unknown, unknown> | undefined
    private beforeCommitStack?: Array<Array<() => void | Promise<void>> | null | undefined> | undefined
    private onCommitStack?: Array<Array<() => void | Promise<void>> | null | undefined> | undefined
    private onRollbackStack?: Array<Array<() => void | Promise<void>> | null | undefined> | undefined
    private transactionMetadataStack?: Array<Map<unknown, unknown> | undefined> | undefined

    private pushTransactionStack() {
        // A null list is the one being executed (its functions are running): a transaction begun from one of them
        // saves it too, so it gets its own lists and the null is restored when it ends
        if (this.onCommit !== undefined || this.onCommitStack || this.onRollback !== undefined || this.onRollbackStack || this.beforeCommit !== undefined || this.beforeCommitStack || this.transactionMetadata || this.transactionMetadataStack) {
            if (!this.beforeCommitStack) {
                this.beforeCommitStack = []
            }
            this.beforeCommitStack.push(this.beforeCommit)
            this.beforeCommit = undefined

            if (!this.onCommitStack) {
                this.onCommitStack = []
            }
            this.onCommitStack.push(this.onCommit)
            this.onCommit = undefined

            if (!this.onRollbackStack) {
                this.onRollbackStack = []
            }
            this.onRollbackStack.push(this.onRollback)
            this.onRollback = undefined

            if (!this.transactionMetadataStack) {
                this.transactionMetadataStack = []
            }
            this.transactionMetadataStack.push(this.transactionMetadata || undefined)
            this.transactionMetadata = undefined
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
        if (this.transactionMetadataStack) {
            this.transactionMetadata = this.transactionMetadataStack.pop()
            if (this.transactionMetadataStack.length <= 0) {
                this.transactionMetadataStack = undefined
            }
        } else {
            this.transactionMetadata = undefined
        }
    }

    executeBeforeNextCommit(fn: ()=> void): void
    executeBeforeNextCommit(fn: ()=> Promise<void>): void
    executeBeforeNextCommit(fn: ()=> void | Promise<void>): void {
        if (!this.isTransactionActive()) {
            throw new TsSqlProcessingError( { reason: 'NOT_IN_TRANSACTION' }, 'There is no open transaction')
        }
        if (this.onRollback === null) {
            throw new TsSqlProcessingError( { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }, 'You cannot call executeBeforeNextCommit inside an executeAfterNextRollback')
        }
        if (this.onCommit === null) {
            throw new TsSqlProcessingError( { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }, 'You cannot call executeBeforeNextCommit inside an executeAfterNextCommit')
        }
        if (this.beforeCommit === null) {
            throw new TsSqlProcessingError( { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }, 'You cannot call executeBeforeNextCommit inside an executeBeforeNextCommit')
        }
        if (!this.beforeCommit) {
            this.beforeCommit = []
        }
        this.beforeCommit.push(fn)
    }

    executeAfterNextCommit(fn: ()=> void): void
    executeAfterNextCommit(fn: ()=> Promise<void>): void
    executeAfterNextCommit(fn: ()=> void | Promise<void>): void {
        if (!this.isTransactionActive()) {
            throw new TsSqlProcessingError( { reason: 'NOT_IN_TRANSACTION' }, 'There is no open transaction')
        }
        if (this.onRollback === null) {
            throw new TsSqlProcessingError( { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }, 'You cannot call executeAfterNextCommit inside an executeAfterNextRollback')
        }
        if (this.onCommit === null) {
            throw new TsSqlProcessingError( { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }, 'You cannot call executeAfterNextCommit inside an executeAfterNextCommit')
        }
        if (!this.onCommit) {
            this.onCommit = []
        }
        this.onCommit.push(fn)
    }

    executeAfterNextRollback(fn: ()=> void): void
    executeAfterNextRollback(fn: ()=> Promise<void>): void
    executeAfterNextRollback(fn: ()=> void | Promise<void>): void {
        if (!this.isTransactionActive()) {
            throw new TsSqlProcessingError( { reason: 'NOT_IN_TRANSACTION' }, 'There is no open transaction')
        }
        if (this.onRollback === null) {
            throw new TsSqlProcessingError( { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }, 'You cannot call executeAfterNextRollback inside an executeAfterNextRollback')
        }
        if (!this.onRollback) {
            this.onRollback = []
        }
        this.onRollback.push(fn)
    }

    getTransactionMetadata(): Map<unknown, unknown> {
        if (!this.isTransactionActive()) {
            throw new TsSqlProcessingError( { reason: 'NOT_IN_TRANSACTION' }, 'There is no open transaction')
        }
        if (!this.transactionMetadata) {
            this.transactionMetadata = new Map()
        }
        return this.transactionMetadata
    }

    transaction<T>(fn: () => T | Promise<T>, isolationLevel?: TransactionIsolationLevel<DB>): Promise<T> {
        const source = new QueryExecutionSource('Transaction executed at')
        if (this.isTransactionActive() && !this.queryRunner.nestedTransactionsSupported()) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions not supported'))
        }
        const opts: any = isolationLevel || []
        __setQueryMetadata(source, opts, this.__sqlBuilder, [])
        try {
            return this.queryRunner.executeInTransaction<T>(() => {
                this.pushTransactionStack()
                try {
                    const result = this.queryRunner.createResolvedPromise(fn())
                    return result.then((fnResult) => {
                        const beforeCommit = this.beforeCommit
                        this.beforeCommit = null
                        return callDeferredFunctionsStoppingOnError('before next commit', beforeCommit, fnResult, source)
                    }).catch( (e) => {
                        if (e instanceof TsSqlQueryExecutionError) {
                            throw e.attachTransactionSource(source)
                        } else if (this.queryRunner.isSqlError(e)) {
                            throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e).attachTransactionSource(source)
                        } else {
                            throw e
                        }
                    })
                } catch (e) {
                    // A body that throws SYNCHRONOUSLY (a non-async callback) must still
                    // leave through a REJECTED PROMISE, never through a synchronous throw:
                    // `executeInTransaction`'s contract is `fn: () => Promise<T>` and every
                    // query runner calls `fn()` bare, so a synchronous throw escapes past
                    // the rollback (managed runners) or past the cleanup that clears the
                    // driver's transaction handle (postgres.js / bun), leaving the
                    // transaction open — the next one then fails as a nested transaction.
                    // Rejecting instead routes this body through the very same path an
                    // async body's rejection takes, including `popTransactionStack()` at
                    // the tail of the chain below.
                    let error
                    if (e instanceof TsSqlQueryExecutionError) {
                        error = e.attachTransactionSource(source)
                    } else if (this.queryRunner.isSqlError(e)) {
                        error = new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e).attachTransactionSource(source)
                    } else {
                        error = e
                    }
                    return this.queryRunner.createRejectedPromise<T>(error)
                }
            }, this.queryRunner, opts).then((result) => {
                const onCommit = this.onCommit
                this.onCommit = null
                return callDeferredFunctions<T>('after next commit', onCommit, result, source)
            }, (e) => {
                let throwError
                if (e instanceof TsSqlQueryExecutionError) {
                    throwError = e.attachTransactionSource(source)
                } else if (this.queryRunner.isSqlError(e)) {
                    throwError = new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e).attachTransactionSource(source)
                } else {
                    throwError = e
                }
                const onRollback = this.onRollback
                this.onRollback = null
                return callDeferredFunctions<any>('after next rollback', onRollback, undefined, source, e, throwError)
            }).then((result) => {
                // Not `.finally`: it swallows rejections on synchronous-promise (fluffynuts/synchronous-promise#53).
                this.popTransactionStack()
                return result
            }, (e) => {
                this.popTransactionStack()
                throw e
            })
        } catch (e) {
            if (e instanceof TsSqlQueryExecutionError) {
                return this.queryRunner.createRejectedPromise(e.attachTransactionSource(source))
            } else if (this.queryRunner.isSqlError(e)) {
                return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e).attachTransactionSource(source))
            } else {
                return this.queryRunner.createRejectedPromise(e)
            }
        }
    }

    beginTransaction(isolationLevel?: TransactionIsolationLevel<DB>): Promise<void> {
        const source = new QueryExecutionSource('Query executed at')
        if (!this.queryRunner.lowLevelTransactionManagementSupported()) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'This query runner only supports a transaction with connection.transaction(fn)'))
        }
        if (this.isTransactionActive() && !this.queryRunner.nestedTransactionsSupported()) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions not supported'))
        }
        const opts: any = isolationLevel || []
        __setQueryMetadata(source, opts, this.__sqlBuilder, [])
        try {
            return this.queryRunner.executeBeginTransaction(opts).then((result) => {
                this.pushTransactionStack()
                return result
            }, (e) => {
                if (e instanceof TsSqlQueryExecutionError) {
                    throw e.attachTransactionSource(source)
                } else if (this.queryRunner.isSqlError(e)) {
                    throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e).attachTransactionSource(source)
                } else {
                    throw e
                }
            })
        } catch (e) {
            if (e instanceof TsSqlQueryExecutionError) {
                return this.queryRunner.createRejectedPromise(e.attachTransactionSource(source))
            } else if (this.queryRunner.isSqlError(e)) {
                return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e).attachTransactionSource(source))
            } else {
                return this.queryRunner.createRejectedPromise(e)
            }
        }
    }
    commit(): Promise<void> {
        const source = new QueryExecutionSource('Query executed at')
        if (!this.isTransactionActive()) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'NOT_IN_TRANSACTION' }, 'There is no open transaction'))
        }
        const opts: any = []
        __setQueryMetadata(source, opts, this.__sqlBuilder, [])
        // A commit that fails leaves the transaction open, but once it's done the transaction has ended, even when a function of after next commit fails
        let committed = false
        const popWhenCommitted = (e: unknown) => {
            if (committed) {
                this.popTransactionStack()
            }
            throw e
        }
        try {
            const beforeCommit = this.beforeCommit
            if (beforeCommit) {
                this.beforeCommit = null
                let result
                try {
                    result = callDeferredFunctionsStoppingOnError('before next commit', beforeCommit, undefined, source)
                } catch (e) {
                    return this.__rollbackAfterFailedBeforeCommit(e)
                }
                if (isPromise(result)) {
                    return result.catch((e) => this.__rollbackAfterFailedBeforeCommit(e)).then(() => {
                        try {
                            return this.queryRunner.executeCommit(opts).then(() => {
                                committed = true
                                const onCommit = this.onCommit
                                this.onCommit = null
                                return callDeferredFunctions('after next commit', onCommit, undefined, source)
                            }, (e) => {
                                // Transaction only closed when commit successful, in case of error there is still an open transaction
                                // No rollback yet, then no executeAfterNextRollback will be executed
                                if (e instanceof TsSqlQueryExecutionError) {
                                    throw e
                                } else if (this.queryRunner.isSqlError(e)) {
                                    throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e)
                                } else {
                                    throw e
                                }
                            })
                        } catch (e) {
                            if (e instanceof TsSqlQueryExecutionError) {
                                throw e
                            } else if (this.queryRunner.isSqlError(e)) {
                                throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e)
                            } else {
                                throw e
                            }
                        }
                    }).then(() => {
                        this.popTransactionStack()
                    }, popWhenCommitted)
                }
            }
            return this.queryRunner.executeCommit(opts).then(() => {
                committed = true
                const onCommit = this.onCommit
                this.onCommit = null
                return callDeferredFunctions('after next commit', onCommit, undefined, source)
            }, (e) => {
                // Transaction only closed when commit successful, in case of error there is still an open transaction
                // No rollback yet, then no executeAfterNextRollback will be executed
                if (e instanceof TsSqlQueryExecutionError) {
                    throw e
                } else if (this.queryRunner.isSqlError(e)) {
                    throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e)
                } else {
                    throw e
                }
            }).then(() => {
                this.popTransactionStack()
            }, popWhenCommitted)
        } catch (e) {
            if (e instanceof TsSqlQueryExecutionError) {
                return this.queryRunner.createRejectedPromise(e)
            } else if (this.queryRunner.isSqlError(e)) {
                return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e))
            } else {
                return this.queryRunner.createRejectedPromise(e)
            }
        }
    }
    /**
     * A function of before next commit is part of the transaction, so when it fails the
     * transaction is rolled back, as `transaction(fn)` does.
     */
    private __rollbackAfterFailedBeforeCommit(error: unknown): Promise<void> {
        return this.rollback().then(() => {
            throw error
        }, (rollbackError) => {
            // SynchronousPromise also calls this function when the one above throws the error
            if (rollbackError !== error && error instanceof TsSqlQueryExecutionError) {
                if (rollbackError instanceof TsSqlQueryExecutionError && rollbackError.errorReason.reason === 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION') {
                    error.attachAdditionalError(rollbackError, 'after next rollback')
                } else {
                    error.attachRollbackError(rollbackError)
                }
            }
            throw error
        })
    }
    rollback(): Promise<void> {
        const source = new QueryExecutionSource('Query executed at')
        if (!this.isTransactionActive()) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'NOT_IN_TRANSACTION' }, 'There is no open transaction'))
        }
        const opts: any = []
        __setQueryMetadata(source, opts, this.__sqlBuilder, [])
        try {
            return this.queryRunner.executeRollback(opts).then(() => {
                const onRollback = this.onRollback
                this.onRollback = null
                return callDeferredFunctions('after next rollback', onRollback, undefined, source)
            }, (e) => {
                let throwError
                if (e instanceof TsSqlQueryExecutionError) {
                    throwError = e
                } else if (this.queryRunner.isSqlError(e)) {
                    throwError = new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e)
                } else {
                    throwError = e
                }
                const onRollback = this.onRollback
                this.onRollback = null
                return callDeferredFunctions('after next rollback', onRollback, undefined, source, e, throwError)
            }).then((result) => {
                // Not `.finally`: it swallows rejections on synchronous-promise (fluffynuts/synchronous-promise#53).
                this.popTransactionStack()
                return result
            }, (e) => {
                this.popTransactionStack()
                throw e
            })
        } catch (e) {
            if (e instanceof TsSqlQueryExecutionError) {
                return this.queryRunner.createRejectedPromise(e)
            } else if (this.queryRunner.isSqlError(e)) {
                return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e))
            } else {
                return this.queryRunner.createRejectedPromise(e)
            }
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
    subSelectUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>, T4 extends ITableOrView<any> | ForUseInLeftJoin<any>, T5 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>, table4: T4 & SameDB<DB>, table5: T5 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, never>
    subSelectUsing(...tables: any[]): SelectExpressionSubquery<any, any, never> {
        const result = new SelectQueryBuilder(this.__sqlBuilder, [], false)
        result.__subSelectUsing = tables
        return result as any // cast to any to improve typescript performace
    }
    subSelectDistinctUsing<T extends ITableOrView<any> | ForUseInLeftJoin<any>>(table: T & SameDB<DB>): SelectExpressionSubquery<T | NoTableOrViewRequired<DB>, T | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | NoTableOrViewRequired<DB>, T1 | T2 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>, T4 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>, table4: T4 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | T4 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | T4 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing<T1 extends ITableOrView<any> | ForUseInLeftJoin<any>, T2 extends ITableOrView<any> | ForUseInLeftJoin<any>, T3 extends ITableOrView<any> | ForUseInLeftJoin<any>, T4 extends ITableOrView<any> | ForUseInLeftJoin<any>, T5 extends ITableOrView<any> | ForUseInLeftJoin<any>>(table1: T1 & SameDB<DB>, table2: T2 & SameDB<DB>, table3: T3 & SameDB<DB>, table4: T4 & SameDB<DB>, table5: T5 & SameDB<DB>): SelectExpressionSubquery<T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, T1 | T2 | T3 | T4 | T5 | NoTableOrViewRequired<DB>, 'distinct'>
    subSelectDistinctUsing(...tables: any[]): SelectExpressionSubquery<any, any, 'distinct'> {
        const result = new SelectQueryBuilder(this.__sqlBuilder, [], true)
        result.__subSelectUsing = tables
        return result as any // cast to any to improve typescript performace
    }

    // `default()` is declared on each concrete connection whose dialect
    // accepts the DEFAULT keyword as a value expression in INSERT VALUES /
    // UPDATE SET / ON CONFLICT DO UPDATE SET (PostgreSQL, MariaDB, MySQL,
    // Oracle, SQL Server, NoopDB). It is absent on SqliteConnection:
    // SQLite's grammar rejects DEFAULT in those positions (it is only
    // allowed in CREATE TABLE / ALTER TABLE column definitions — see
    // https://www.sqlite.org/lang_insert.html). Omit the column from the
    // insert/update instead; SQLite will apply the DDL default
    // automatically. The implementation is duplicated rather than declared
    // here as `protected` so that on SqliteConnection callers get a clean
    // "Property 'default' does not exist on type ..." TS error instead of
    // the confusing "Property 'default' is protected ..." that a
    // visibility-narrowed inherited method would produce.
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
    const(value: string, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: Date, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: Date, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const(value: Date, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    const<T, TYPE_NAME extends string>(value: T, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
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
    optionalConst(value: string | null | undefined, type: 'stringDecimal', adapter?: TypeAdapter): StringDecimalValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: Date | null | undefined, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: Date | null | undefined, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst(value: Date | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<NNoTableOrViewRequired<DB>, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    optionalConst<T, TYPE_NAME extends string>(value: T | null | undefined, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
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
        // `EXISTS(...)` / `NOT EXISTS(...)` are already SQL predicates in
        // every dialect — they don't need the boolean-to-int wrapping that
        // Oracle/SQL Server otherwise apply to boolean value sources
        // (e.g. `(exists(...) = 1)`, which SQL Server rejects as a syntax
        // error). Marking the result as a condition-only boolean keeps the
        // wrap from kicking in inside `where`/`and`/`or`.
        const vs = new SqlOperationStatic1ValueSource('_exists', select, 'boolean', 'boolean', 'required', undefined)
        vs.__isBooleanForCondition = true
        return vs
    }
    notExists<SOURCE extends NSource>(select: IExecutableSelectQuery<SOURCE, any, any> & SameDB<DB>): BooleanValueSource<SOURCE, 'required'> {
        const vs = new SqlOperationStatic1ValueSource('_notExists', select, 'boolean', 'boolean', 'required', undefined)
        vs.__isBooleanForCondition = true
        return vs
    }

    protected executeProcedure(procedureName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[]): Promise<void> {
        const source = new QueryExecutionSource('Query executed at')
        let query: string | undefined
        try {
            const queryParams: any[] = []
            query = this.__sqlBuilder._buildCallProcedure(queryParams, procedureName, params)
            __setQueryMetadata(source, queryParams, this.__sqlBuilder, [])
            return this.__sqlBuilder._queryRunner.executeProcedure(query, queryParams).catch((e) => {
                throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e)
            })
        } catch (e) {
            return this.__rejectExecution(source, e, query)
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
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'stringDecimal', required: 'required', adapter?: TypeAdapter): Promise<string>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'uuid', required: 'optional', adapter?: TypeAdapter): Promise<string | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'stringDecimal', required: 'optional', adapter?: TypeAdapter): Promise<string | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDate', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDate', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDateTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customBigint', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customBigint', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDecimal', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T, TYPE_NAME extends string>(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: 'customDecimal', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
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
    protected executeFunction(functionName: string, params: ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Promise<any> {
        const source = new QueryExecutionSource('Query executed at')
        let query: string | undefined
        try {
            // The value type of the result (like 'customUuid'), and the name of its type (the type name for a custom type)
            const valueType = returnType
            if (typeof adapter === 'string') {
                returnType = required
                required = adapter
            } else {
                adapter2 = adapter
            }
            const functionCall = new FunctionCallValueSource(functionName, params as AnyValueSource[], valueType as ValueType, returnType, required === 'optional' ? 'optional' : 'required', adapter2)
            const queryParams: any[] = []
            query = this.__sqlBuilder._buildCallFunction(queryParams, functionCall)
            __setQueryMetadata(source, queryParams, this.__sqlBuilder, __unnamedResultColumn(functionCall))
            return this.__sqlBuilder._queryRunner.executeFunction(query, queryParams).then((value) => {
                let result
                try {
                    if (adapter2) {
                        result = adapter2.transformValueFromDB(value, returnType, __typeCategoryOf(valueType as ValueType), this.__sqlBuilder._defaultTypeAdapter)
                    } else {
                        result = this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, returnType, __typeCategoryOf(valueType as ValueType))
                    }
                } catch(e) {
                    if (e instanceof TsSqlError) {
                        throw e
                    } else {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: returnType }, e)
                    }
                }
                if (value === undefined) {
                    throw new TsSqlProcessingError({ reason: 'NO_RESULT' }, 'No result returned by the database')
                }
                if (result === null && required !== 'optional') {
                    throw new TsSqlProcessingError({ reason: 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE', value: result, typeName: returnType }, 'Expected a value as result of the function `' + functionName + '`, but null or undefined value was found')
                }
                return result
            }).catch((e) => {
                throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e)
            })
        } catch (e) {
            return this.__rejectExecution(source, e, query)
        }
    }

    /**
     * Same rule as the execute methods of the query builders: the failure goes through the
     * promise, and an error that isn't of the library while building the call comes from
     * the code of the application, so it arrives as it is.
     */
    private __rejectExecution(source: QueryExecutionSource, error: unknown, query: string | undefined): Promise<any> {
        const queryRunner = this.__sqlBuilder._queryRunner
        if (query === undefined && !(error instanceof TsSqlError)) {
            return queryRunner.createRejectedPromise(error)
        }
        return queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, queryRunner.getErrorReason(error), error))
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
    fragmentWithType(type: 'stringDecimal', required: 'required', adapter?: TypeAdapter): StringDecimalFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'uuid', required: 'optional', adapter?: TypeAdapter): UuidFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'stringDecimal', required: 'optional', adapter?: TypeAdapter): StringDecimalFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'localDate', required: 'required', adapter?: TypeAdapter):  LocalDateFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'localDate', required: 'optional', adapter?: TypeAdapter):  LocalDateFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'localTime', required: 'required', adapter?: TypeAdapter): LocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'localTime', required: 'optional', adapter?: TypeAdapter): LocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType(type: 'localDateTime', required: 'required', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'required'>
    fragmentWithType(type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomBigintFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomBigintFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomDecimalFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
    fragmentWithType<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomDecimalFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional'>
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
    fragmentWithType(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new FragmentQueryBuilder(type as ValueType, required, adapter as any, adapter2)
        }
        return new FragmentQueryBuilder(type as ValueType, type, required as any, adapter)
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
    protected arg(type: 'stringDecimal', required: 'required', adapter?: TypeAdapter): Argument<'stringDecimal', 'required', 'combined', string>
    protected arg(type: 'uuid', required: 'optional', adapter?: TypeAdapter): Argument<'uuid', 'optional', 'combined', string>
    protected arg(type: 'stringDecimal', required: 'optional', adapter?: TypeAdapter): Argument<'stringDecimal', 'optional', 'combined', string>
    protected arg(type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'combined', Date>
    protected arg(type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'combined', Date>
    protected arg(type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'combined', Date>
    protected arg(type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'combined', Date>
    protected arg(type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'combined', Date>
    protected arg(type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'combined', Date>
    protected arg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customInt', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customBigint', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customInt', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customBigint', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customDouble', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customDecimal', 'required', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customDouble', 'optional', 'combined', T, TYPE_NAME>
    protected arg<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customDecimal', 'optional', 'combined', T, TYPE_NAME>
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
    protected arg(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new Argument(type as any, required, adapter as any, 'combined', adapter2)
        }
        return new Argument(type as any, type, required as any, 'combined', adapter)
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
    protected valueArg(type: 'stringDecimal', required: 'required', adapter?: TypeAdapter): Argument<'stringDecimal', 'required', 'value', string>
    protected valueArg(type: 'uuid', required: 'optional', adapter?: TypeAdapter): Argument<'uuid', 'optional', 'value', string>
    protected valueArg(type: 'stringDecimal', required: 'optional', adapter?: TypeAdapter): Argument<'stringDecimal', 'optional', 'value', string>
    protected valueArg(type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'value', Date>
    protected valueArg(type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'value', Date>
    protected valueArg(type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'value', Date>
    protected valueArg(type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'value', Date>
    protected valueArg(type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'value', Date>
    protected valueArg(type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'value', Date>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customInt', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customBigint', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customInt', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customBigint', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customDouble', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): Argument<'customDecimal', 'required', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customDouble', 'optional', 'value', T, TYPE_NAME>
    protected valueArg<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): Argument<'customDecimal', 'optional', 'value', T, TYPE_NAME>
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
    protected valueArg(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new Argument(type as any, required, adapter as any, 'value', adapter2)
        }
        return new Argument(type as any, type, required as any, 'value', adapter)
    }

    protected buildFragmentWithArgs(): FragmentBuilder0<NNoTableOrViewRequired<DB>>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilder1<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilder2<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgs(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilder(args)
    }

    protected buildFragmentWithArgsIfValue(): FragmentBuilder0IfValue<NNoTableOrViewRequired<DB>>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilder1IfValue<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilder2IfValue<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgsIfValue(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilderIfValue(this as any, args) // make this protected fields as public
    }

    protected buildFragmentWithMaybeOptionalArgs(): FragmentBuilderMaybeOptional0<NNoTableOrViewRequired<DB>>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilderMaybeOptional1<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilderMaybeOptional2<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilderMaybeOptional3<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilderMaybeOptional4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilderMaybeOptional5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithMaybeOptionalArgs(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilderMaybeOptional(this as any, args)
    }

    // --- Aggregate fragment variants ---
    // Same shape as the non-aggregate fragment builders, but the produced
    // value source carries the aggregate marker (NAggregate<DB> in its source
    // + __isAggregate at runtime), so a custom aggregate written as a fragment
    // is rejected outside aggregate-legal clauses, just like a built-in aggregate.
    aggregateFragmentWithType(type: 'boolean', required: 'required', adapter?: TypeAdapter): BooleanFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'boolean', required: 'optional', adapter?: TypeAdapter): BooleanFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'int', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'int', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'bigint', required: 'required', adapter?: TypeAdapter): BigintFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'bigint', required: 'optional', adapter?: TypeAdapter): BigintFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'double', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'double', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'string', required: 'required', adapter?: TypeAdapter): StringFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'string', required: 'optional', adapter?: TypeAdapter): StringFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'uuid', required: 'required', adapter?: TypeAdapter): UuidFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'stringDecimal', required: 'required', adapter?: TypeAdapter): StringDecimalFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'uuid', required: 'optional', adapter?: TypeAdapter): UuidFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'stringDecimal', required: 'optional', adapter?: TypeAdapter): StringDecimalFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'localDate', required: 'required', adapter?: TypeAdapter):  LocalDateFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'localDate', required: 'optional', adapter?: TypeAdapter):  LocalDateFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'localTime', required: 'required', adapter?: TypeAdapter): LocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'localTime', required: 'optional', adapter?: TypeAdapter): LocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: 'localDateTime', required: 'required', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>
    aggregateFragmentWithType(type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomBigintFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomIntFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomBigintFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomDecimalFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomDoubleFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomDecimalFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomUuidFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomUuidFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomLocalDateFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomLocalDateFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomLocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomLocalTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'required', adapter?: TypeAdapter): ComparableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required', NAggregate<DB>>
    aggregateFragmentWithType<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, required: 'optional', adapter?: TypeAdapter): ComparableFragmentExpression<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new FragmentQueryBuilder(type as ValueType, required, adapter as any, adapter2, true)
        }
        return new FragmentQueryBuilder(type as ValueType, type, required as any, adapter, true)
    }

    protected buildAggregateFragmentWithArgs(): FragmentBuilder0<NNoTableOrViewRequired<DB>, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilder1<NNoTableOrViewRequired<DB>, A1, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilder2<NNoTableOrViewRequired<DB>, A1, A2, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3<NNoTableOrViewRequired<DB>, A1, A2, A3, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilder(args, true)
    }

    protected buildAggregateFragmentWithArgsIfValue(): FragmentBuilder0IfValue<NNoTableOrViewRequired<DB>, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilder1IfValue<NNoTableOrViewRequired<DB>, A1, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilder2IfValue<NNoTableOrViewRequired<DB>, A1, A2, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilderIfValue(this as any, args, true) // make this protected fields as public
    }

    protected buildAggregateFragmentWithMaybeOptionalArgs(): FragmentBuilderMaybeOptional0<NNoTableOrViewRequired<DB>, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>>(a1: A1): FragmentBuilderMaybeOptional1<NNoTableOrViewRequired<DB>, A1, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(a1: A1, a2: A2): FragmentBuilderMaybeOptional2<NNoTableOrViewRequired<DB>, A1, A2, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilderMaybeOptional3<NNoTableOrViewRequired<DB>, A1, A2, A3, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilderMaybeOptional4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilderMaybeOptional5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilderMaybeOptional(this as any, args, true)
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
            // `apply` (re)builds the customization template bound to a specific
            // table/view instance. It is stashed on the result so that when the
            // wrapper is later re-aliased or made left-joinable (`as(...)` /
            // `forUseInLeftJoinAs(...)` clone into a fresh instance), the clone can
            // re-bind the template — and its embedded name/alias fragments — to
            // itself instead of keeping the alias frozen at customization time.
            const apply = (target: AnyTableOrView) => {
                const table = new TableOrViewRawFragmentValueSource(target, '_rawFragmentTableName')
                const alias = new TableOrViewRawFragmentValueSource(target, '_rawFragmentTableAlias')
                const p = __getTableOrViewPrivate(target)
                p.__template = fn(table, alias, ...params)
                p.__customizationName = name
                p.__customizationApply = apply
            }
            const as = __getTableOrViewPrivate(tableOrView).__as
            const result = (tableOrView as any).as(as)
            apply(result)
            return result as any
        }
    }

    noValueBoolean(): IfValueSource<NNoTableOrViewRequired<DB>, 'required'> {
        return new SqlOperationValueSourceIfValueAlwaysNoop('required')
    }

    dynamicBooleanExpressionUsing<SOURCE extends NSource>(table: ITableOrView<SOURCE> & SameDB<DB>): AlwaysIfValueSource<SOURCE | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource, S4 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>, table4: ITableOrView<S4> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | S4 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource, S4 extends NSource, S5 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>, table4: ITableOrView<S4> & SameDB<DB>, table5: ITableOrView<S5> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | S4 | S5 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing(..._tables: any[]): AlwaysIfValueSource<any, any> {
        return new SqlOperationValueSourceIfValueAlwaysNoop('required')
    }

    // Agregate functions
    countAll(): NumberValueSource<NNoTableOrViewRequired<DB> | NAggregate<DB>, 'required'> {
        return new AggregateFunctions0ValueSource('_countAll', 'int', 'int', 'required', undefined)
    }
    count<SOURCE extends NSource>(value: ValueSourceOf<SOURCE> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): NumberValueSource<SOURCE | NAggregate<DB>, 'required'> {
        return new AggregateFunctions1ValueSource('_count', value, 'int', 'int', 'required', undefined)
    }
    countDistinct<SOURCE extends NSource>(value: ValueSourceOf<SOURCE> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): NumberValueSource<SOURCE | NAggregate<DB>, 'required'> {
        return new AggregateFunctions1ValueSource('_countDistinct', value, 'int', 'int', 'required', undefined)
    }
    max<TYPE extends IComparableValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<DB>, TYPE, 'optional'> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_max', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)) as any
    }
    min<TYPE extends IComparableValueSource<NSource, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<DB>, TYPE, 'optional'> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_min', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)) as any
    }
    sum<SOURCE extends NSource>(value: INumberValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): NumberValueSource<SOURCE | NAggregate<DB>, 'optional'>
    sum<SOURCE extends NSource>(value: IBigintValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): BigintValueSource<SOURCE | NAggregate<DB>, 'optional'>
    sum<SOURCE extends NSource>(value: IStringDecimalValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): StringDecimalValueSource<SOURCE | NAggregate<DB>, 'optional'>
    sum<TYPE extends ICustomIntValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomIntValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sum<TYPE extends ICustomBigintValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomBigintValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sum<TYPE extends ICustomDoubleValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomDoubleValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sum<TYPE extends ICustomDecimalValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomDecimalValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sum(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_sum', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    sumDistinct<SOURCE extends NSource>(value: INumberValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): NumberValueSource<SOURCE | NAggregate<DB>, 'optional'>
    sumDistinct<SOURCE extends NSource>(value: IBigintValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): BigintValueSource<SOURCE | NAggregate<DB>, 'optional'>
    sumDistinct<SOURCE extends NSource>(value: IStringDecimalValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): StringDecimalValueSource<SOURCE | NAggregate<DB>, 'optional'>
    sumDistinct<TYPE extends ICustomIntValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomIntValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sumDistinct<TYPE extends ICustomBigintValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomBigintValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sumDistinct<TYPE extends ICustomDoubleValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomDoubleValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sumDistinct<TYPE extends ICustomDecimalValueSource<any, any, any, any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): CustomDecimalValueSource<TYPE[typeof source] | NAggregate<DB>, TYPE[typeof valueType], TYPE[typeof typeName], 'optional'>
    sumDistinct(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_sumDistinct', value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    // `AVG` is conceptually a fractional operation: averaging any set of
    // numerics may yield a non-integer scalar. Every supported engine
    // except SQL Server reflects that (PostgreSQL → numeric, MariaDB /
    // MySQL → decimal, Oracle → NUMBER, SQLite → real); SQL Server is
    // the lone outlier and truncates `AVG(int)` back to int by
    // historical SQL convention. The library exposes the conceptual
    // semantics: `average(...)` / `averageDistinct(...)` always return
    // `NumberValueSource<..., 'optional'>` (TS `number`, runtime
    // `'double'`) regardless of the input value-type, and SQL Server
    // emits a cast inside `_average` / `_averageDistinct` so the engine
    // also returns a fractional scalar — homogenising behaviour across
    // every dialect.
    average<SOURCE extends NSource>(value: (INumberValueSource<SOURCE, any> | IBigintValueSource<SOURCE, any> | IStringDecimalValueSource<SOURCE, any> | ICustomIntValueSource<SOURCE, any, any, any> | ICustomBigintValueSource<SOURCE, any, any, any> | ICustomDoubleValueSource<SOURCE, any, any, any> | ICustomDecimalValueSource<SOURCE, any, any, any>) & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): NumberValueSource<SOURCE | NAggregate<DB>, 'optional'>
    average(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_average', value, 'double', 'double', 'optional', valuePrivate.__typeAdapter)
    }
    averageDistinct<SOURCE extends NSource>(value: (INumberValueSource<SOURCE, any> | IBigintValueSource<SOURCE, any> | IStringDecimalValueSource<SOURCE, any> | ICustomIntValueSource<SOURCE, any, any, any> | ICustomBigintValueSource<SOURCE, any, any, any> | ICustomDoubleValueSource<SOURCE, any, any, any> | ICustomDecimalValueSource<SOURCE, any, any, any>) & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): NumberValueSource<SOURCE | NAggregate<DB>, 'optional'>
    averageDistinct(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_averageDistinct', value, 'double', 'double', 'optional', valuePrivate.__typeAdapter)
    }
    stringConcat<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): StringValueSource<SOURCE | NAggregate<DB>, 'optional'>
    stringConcat<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>, separator: string): StringValueSource<SOURCE | NAggregate<DB>, 'optional'>
    stringConcat(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcat', separator, value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }
    // `stringConcatDistinct` is declared on each concrete connection whose
    // dialect accepts DISTINCT inside its string-aggregation function (PG,
    // MariaDB, MySQL, SQLite, Oracle, NoopDB) so the property is absent on
    // SqlServerConnection, whose STRING_AGG rejects DISTINCT entirely. See
    // each `<DB>Connection.ts` for the per-dialect declaration.

    aggregateAsArray<COLUMNS extends AggregatedArrayColumns<DB>>(columns: COLUMNS & NNotNestedAggregate<SourceOfAggregatedArray<COLUMNS>, DB>): AggregatedArrayValueSourceProjectableAsNullable<SourceOfAggregatedArray<COLUMNS> | NAggregate<DB>, Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>, 'required'> {
        return new AggregateValueAsArrayValueSource(columns as QueryColumns, 'InnerResultObject', 'required', false)
    }
    aggregateAsArrayOfOneColumn<VALUE extends IValueSource<any, any, any, any>>(value: VALUE & NNotNestedAggregate<VALUE[typeof source], DB>): AggregatedArrayValueSource<VALUE[typeof source] | NAggregate<DB>, Array<VALUE[typeof valueType]>, 'required'> {
        return new AggregateValueAsArrayValueSource(value, 'InnerResultObject', 'required', false)
    }

    dynamicConditionFor<DEFINITION extends Filterable>(definition: DEFINITION): DynamicConditionExpression<DEFINITION, never>
    dynamicConditionFor<DEFINITION extends Filterable, EXTENSION extends DynamicConditionExtension>(definition: DEFINITION, extension: EXTENSION): DynamicConditionExpression<DEFINITION, EXTENSION>
    dynamicConditionFor(definition: Filterable, extension?: any): any {
        return new DynamicConditionBuilder(this.__sqlBuilder, definition, extension)
    }

    protected transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown {
        const conversionType = __conversionType(type, typeCategory)
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        switch (conversionType) {
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
                if (typeof value === 'string') {
                    // Engines without a native boolean type store it as 0/1, and
                    // some drivers (notably oracledb) hand a numeric column back
                    // as a string to preserve precision — exactly as the `int`
                    // case below already accommodates. Accept a numeric string
                    // the same way the `number` branch does (`!!value`).
                    if (/^(-?\d+)$/g.test(value)) {
                        return !!(+value)
                    }
                    // A boolean as text, in any case: PostgreSQL writes 't' and 'f' (a driver that hands the text,
                    // or a mock that imitates it), Oracle 'TRUE' and 'FALSE' (the RETURNING of a BOOLEAN column)
                    const lowerCase = value.toLowerCase()
                    if (lowerCase === 't' || lowerCase === 'true') {
                        return true
                    }
                    if (lowerCase === 'f' || lowerCase === 'false') {
                        return false
                    }
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid boolean value received from the db: ' + value)
            case 'int':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + value)
                    }
                    // An integer beyond the safe range arrived as a rounded JavaScript number:
                    // the exact value is already gone. Refuse it the same way the string/bigint
                    // arms below do, so every route reaches the same verdict (homogeneous read).
                    if (!Number.isSafeInteger(value)) {
                        throw new TsSqlProcessingError({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value, typeName: type }, 'Precision lost reading an int value from the db: the driver returned ' + value + ' as a rounded JavaScript number outside the safe integer range. Read the column as bigint, or enable the driver big-integer mode.')
                    }
                    return value
                }
                if (typeof value === 'string') {
                    // Accept a trailing `.0` (SQLite serialises an integer *expression* such as
                    // `priority + 1` as `3.0` in a JSON aggregate — the lossless parser keeps
                    // that as the string `"3.0"`, and the `number` arm above already treats an
                    // integral float as an int via `Number.isInteger`, so the string arm matches).
                    if (!/^-?\d+(\.0+)?$/g.test(value)) {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + value)
                    }
                    const result = +value
                    if (!Number.isSafeInteger(result)) {
                        throw new TsSqlProcessingError({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value, typeName: type }, 'Precision lost reading an int value from the db: ' + value + ' exceeds the JavaScript safe integer range. Read the column as bigint.')
                    }
                    return result
                }
                if (typeof value === 'bigint') {
                    const result = Number(value)
                    if (!Number.isSafeInteger(result)) {
                        throw new TsSqlProcessingError({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value, typeName: type }, 'Precision lost reading an int value from the db: the bigint ' + value + ' exceeds the JavaScript safe integer range. Read the column as bigint.')
                    }
                    return result
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + value)
            case 'bigint':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid bigint value received from the db: ' + value)
                    }
                    // A number that is an integer but not a SAFE integer has already lost
                    // precision before it reached here: the driver handed the value over as a
                    // rounded JavaScript number (its big-integer / fetch-as-string mode is off),
                    // or a bigint travelled through a JSON aggregate as a bare JSON number that
                    // JSON.parse rounded (the emission side quotes bigint leaves precisely so the
                    // aggregate path never hits this — finding A). `BigInt(value)` would mint a
                    // clean but WRONG bigint; throw instead so no route corrupts silently.
                    if (!Number.isSafeInteger(value)) {
                        throw new TsSqlProcessingError({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value, typeName: type }, 'Precision lost reading a bigint value from the db: the driver returned ' + value + ' as a rounded JavaScript number outside the safe integer range. Enable the driver big-integer / fetch-as-string mode so the value arrives exactly.')
                    }
                    return BigInt(value)
                }
                if (typeof value === 'string') {
                    // Strip a trailing `.0+` (fractional zeros only) before parsing, symmetric to
                    // the `int` arm: `BigInt('4.0')` throws, so a `bigint` leaf an engine serialises
                    // with a REAL-affinity suffix (SQLite renders an integer-valued REAL expression
                    // as `4.0` inside a JSON aggregate) would otherwise be refused. A genuine
                    // fractional part (`4.5`) leaves the string untouched and still fails `BigInt`,
                    // so it throws — an integer type is not fractional.
                    try {
                        return BigInt(value.replace(/\.0+$/, ''))
                    } catch {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid bigint value received from the db: ' + value)
                    }
                }
                if (typeof value === 'bigint') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + value)
            case 'double':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    // Accept scientific notation and the leading-dot form (`.5`). Scientific is how
                    // a lossless float→text arrives: SQL Server's `convert(nvarchar, x, 3)` — the
                    // only lossless float conversion, used by the compat JSON-aggregate fallback —
                    // emits e.g. `1.2345678900000000e+002`, which travels back as a JSON number and
                    // is restored exactly by the lossless parser (finding A/B). The leading-dot form
                    // is defensive for a scalar number a driver may render without a leading zero.
                    // `+value` parses every accepted form back to the exact double.
                    if (!/^(-?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?|NaN|-?Infinity)$/g.test(value)) {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid double value received from the db: ' + value)
                    }
                    const result = +value
                    return result
                }
                if (typeof value === 'bigint') {
                    return Number(value)
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid double value received from the db: ' + value)
            case 'stringDecimal':
            case 'customDecimal':
                if (typeof value === 'string') {
                    // The text the database gives keeps its digits and its scale (`1.50`). A number without the zero
                    // before the point (`.5`, as Oracle writes it) gets it
                    if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(value)) {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid customDecimal value received from the db: ' + value)
                    }
                    if (value.startsWith('.')) {
                        return '0' + value
                    }
                    if (value.startsWith('-.')) {
                        return '-0' + value.substring(1)
                    }
                    return value
                }
                if (typeof value === 'number') {
                    // The driver gave a JavaScript number: the digits beyond its precision, and the scale, are already
                    // lost, and nothing tells which
                    throw new TsSqlProcessingError({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value, typeName: type }, 'Precision lost reading a customDecimal value from the db: the driver returned ' + value + ' as a JavaScript number')
                }
                if (typeof value === 'bigint') {
                    return '' + value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid customDecimal value received from the db: ' + value)
            case 'string':
                if (typeof value === 'string') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid string value received from the db: ' + value)
            case 'uuid':
                if (typeof value === 'string') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid uuid value received from the db: ' + value)
            case 'localDate': {
                // Every value in the database is in UTC: the day of a Date received is the one of its UTC getters, and
                // a text is read as UTC (or as its instant, when it has an offset). Some engines write a date with a
                // time (Oracle's DATE inside a JSON aggregate is "2024-01-15T00:00:00"): only its day is kept.
                // A localDate has no time-of-day. If it were pinned at UTC midnight the CALENDAR DATE would shift when
                // the value is read in another timezone (00:00Z is the previous day everywhere west of UTC), so the
                // decoded Date is at 10:00 UTC: a buffer that preserves the intended day across every inhabited offset
                // (UTC-10..+13; only the effectively-uninhabited +14/-11/-12 would still roll over). A future move to
                // Temporal's plain-date type would remove the need for this offset.
                const received = this.__receivedDate(value)
                if (!received) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid localDate value received from the db: ' + value)
                }
                const result: any = new Date(0)
                result.setUTCFullYear(received.getUTCFullYear(), received.getUTCMonth(), received.getUTCDate())
                result.setUTCHours(10) // date-stability offset (see the note above)
                result.___type___ = 'localDate'
                return result
            }
            case 'localTime': {
                // The time of a Date received is the one of its UTC getters, and a text is read as UTC (or as its
                // instant, when it has an offset). Some engines write a time with a date (Oracle's TIMESTAMP inside a
                // JSON aggregate is "1970-01-01T09:15:00"): only its time is kept, on 1970-01-01.
                const received = this.__receivedDate(value)
                if (!received) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid localTime value received from the db: ' + value)
                }
                const result: any = new Date(Date.UTC(1970, 0, 1, received.getUTCHours(), received.getUTCMinutes(), received.getUTCSeconds(), received.getUTCMilliseconds()))
                result.___type___ = 'localTime'
                return result
            }
            case 'localDateTime': {
                // A Date received is kept: the query runner gives the UTC digits of a value without zone in its UTC
                // getters, and the instant of a zoned one. A text is read as UTC, or as its instant when it has an offset.
                const received = this.__receivedDate(value)
                if (!received) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid localDateTime value received from the db: ' + value)
                }
                (received as any).___type___ = 'localDateTime'
                return received
            }
            case 'aggregatedArray': {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'This would not happened, something went wrong handling aggregate arrays coming from the database')
            }
            default:
                return value
        }
    }
    /**
     * The Date of a localDate, a localTime or a localDateTime received from the database: a valid Date as it is, a text
     * read as UTC, or as its instant when it has an offset (see parseUtcDateTimeText); undefined for anything else
     */
    private __receivedDate(value: unknown): Date | undefined {
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? undefined : value
        }
        if (typeof value === 'string') {
            return parseUtcDateTimeText(value)
        }
        return undefined
    }
    protected transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown {
        const conversionType = __conversionType(type, typeCategory)
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        switch (conversionType) {
            case 'boolean':
                if (typeof value === 'boolean') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid boolean value to send to the db: ' + value)
            case 'int':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid int value to send to the db: ' + value)
                    }
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid int value to send to the db: ' + value)
            case 'bigint':
                if (typeof value === 'bigint') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid int value to send to the db: ' + value)
            case 'double':
                if (typeof value === 'number') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid double value to send to the db: ' + value)
            case 'stringDecimal':
            case 'customDecimal':
                // A decimal is sent as its text, with a point as the decimal separator and without an exponent, so every
                // database reads it with all its digits
                if (typeof value === 'string') {
                    if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(value)) {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid customDecimal value to send to the db: ' + value)
                    }
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid customDecimal value to send to the db: ' + value)
            case 'string':
                if (typeof value === 'string') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid string value to send to the db: ' + value)
            case 'uuid':
                if (typeof value === 'string') {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid uuid value to send to the db: ' + value)
            case 'localDate':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid localDate value to send to the db: ' + value)
            case 'localTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    // The time of a localTime is the one of its UTC getters, whatever the zone of the process, on
                    // 1970-01-01 UTC: the day the value is read back on. Each query runner sends it in the form its
                    // driver needs (a text, a TIME, a TIMESTAMP).
                    return new Date(Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds()))
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid localTime value to send to the db: ' + value)
            case 'localDateTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    return value
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid localDateTime value to send to the db: ' + value)
            case 'aggregatedArray': {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'This would not happened, something went wrong handling aggregate arrays, aggregated arrays cannot be sent to the database')
            }
            default:
                return value
        }
    }

    protected transformPlaceholder(placeholder: string, _type: string, _typeCategory: TypeCategory, _valueSentToDB: unknown): string {
        return placeholder
    }

    /**
     * The SQL of a value as it leaves the database, with the conversion of the library: the SQL it receives, unless the
     * connection of a database changes it (SQL Server writes a decimal of a column of the result as its text)
     */
    protected transformProjection(sql: string, _type: string, _typeCategory: TypeCategory, _output: ProjectionOutput): string {
        return sql
    }

    /**
     * Whether the database must receive the type of the parameter (the query runner writes a cast in the placeholder,
     * or sends the parameter with its type): it receives the one the library decided for the position where the
     * parameter is written, and returns the one to use
     */
    protected forceTypeCast(_type: string, _typeCategory: TypeCategory, _valueSentToDB: unknown, forceTypeCast: boolean): boolean {
        return forceTypeCast
    }

    protected isReservedKeyword(word: string): boolean {
        return this.__sqlBuilder._isReservedKeyword(word)

    }
    protected forceAsIdentifier(identifier: string): string {
        return this.__sqlBuilder._forceAsIdentifier(identifier)
    }
    /**
     * The identifier written in the SQL: quoted when it is a reserved word or has a space, or, when `strict`, when it
     * isn't made only of letters, digits and underscores. `allowReservedKeyword` keeps a reserved word as it is: the name
     * of a function or a procedure called with executeFunction or executeProcedure, which quoted would no longer be the
     * built-in one of that name (SQL Server reads `[upper](@0)` as a function of the user without its schema)
     */
    protected escape(identifier: string, strict: boolean, allowReservedKeyword?: boolean): string {
        if (strict && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
            return this.forceAsIdentifier(identifier)
        }
        if ((!allowReservedKeyword && this.isReservedKeyword(identifier)) || identifier.indexOf(' ') >= 0) {
            return this.forceAsIdentifier(identifier)
        }
        return identifier
    }

}

export type RawFragmentArg<T extends NSource, DB extends NDB> = HasSource<T> & SameDB<DB> & (AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>)

/** An isolation level built by a connection: only that connection accepts it */
export interface TransactionIsolationLevel<DB extends NDB = NDB> {
    [transactionIsolationLevel]: DB
}

// Exposed for use by the concrete connection subclasses whose dialect
// accepts DISTINCT inside JSON-array aggregates (PG, MariaDB, SQLite,
// NoopDB) — they declare `aggregateAsArrayDistinct` /
// `aggregateAsArrayOfOneColumnDistinct` themselves so the property is
// absent on MySQL / Oracle / SQL Server connections.
export type AggregatedArrayColumns<DB extends NDB> = DataToProject<NWithDB<DB>>
export type SourceOfAggregatedArray<TYPE> = GetDataToProjectSource<TYPE>
