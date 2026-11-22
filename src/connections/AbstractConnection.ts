import { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { QueryColumns, SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import { isUtcTimeZoneName } from '../utils/processTimeZone.js'
import { connectionClassIdOf, keepNativeSqlDataType, keptNativeSqlDataType } from '../utils/sqlDataTypeNames.js'
import type { InsertExpression } from '../expressions/insert.js'
import type { UpdateExpression, UpdateExpressionAllowingNoWhere } from '../expressions/update.js'
import type { DeleteExpression, DeleteExpressionAllowingNoWhere } from '../expressions/delete.js'
import type { NoTableOrViewRequired, ITableOrView, ITable, SameDB, HasSource, ForUseInLeftJoin, AnyTableOrView } from '../utils/ITableOrView.js'
import type { SelectExpression, SelectExpressionFromNoTable, SelectExpressionSubquery } from '../expressions/select.js'
import type { ProjectionOutput, SqlDataType, TypeAdapter, DefaultTypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import type { IConnection } from '../utils/IConnection.js'
import type { FragmentBuilder0, FragmentBuilder1, FragmentBuilder2, FragmentBuilder3, FragmentBuilder4, FragmentBuilder5, FragmentBuilder0IfValue, FragmentBuilder1IfValue, FragmentBuilder2IfValue, FragmentBuilder3IfValue, FragmentBuilder4IfValue, FragmentBuilder5IfValue, FragmentBuilderMaybeOptional0, FragmentBuilderMaybeOptional1, FragmentBuilderMaybeOptional2, FragmentBuilderMaybeOptional3, FragmentBuilderMaybeOptional4, FragmentBuilderMaybeOptional5 } from '../expressions/fragment.js'
import { InsertQueryBuilder } from '../queryBuilders/InsertQueryBuilder.js'
import { UpdateQueryBuilder } from '../queryBuilders/UpdateQueryBuilder.js'
import { DeleteQueryBuilder } from '../queryBuilders/DeleteQueryBuilder.js'
import { __createAggregateFunction0, __createAggregateFunction1, __createAggregateFunction1or2, __createAggregateValueAsArray, __createConst, __createFunctionCall, __createIfValueAlwaysNoop, __createRawFragment, __createStatic0, __createStatic1, __createStaticBoolean, __createTableOrViewRawFragment, __asNodeValueSource } from '../typeSystem/valueSourceFactory.js'
import { SelectQueryBuilder } from '../queryBuilders/SelectQueryBuilder.js'
import { TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError, QueryExecutionSource } from '../TsSqlError.js'
import { FragmentQueryBuilder, FragmentFunctionBuilder, FragmentFunctionBuilderIfValue, FragmentFunctionBuilderMaybeOptional } from '../queryBuilders/FragmentQueryBuilder.js'
import { connection, source, transactionIsolationLevel, valueType } from '../utils/symbols.js'
import { callDeferredFunctions, callDeferredFunctionsStoppingOnError, isPromise } from '../utils/PromiseUtils.js'
import type { DynamicConditionExtension, DynamicConditionExpression, Filterable } from '../expressions/dynamicConditionUsingFilters.js'
import { DynamicConditionBuilder } from '../queryBuilders/DynamicConditionBuilder.js'
import type { RawFragment } from '../utils/RawFragment.js'
import type { CustomizedTableOrView } from '../utils/tableOrViewUtils.js'
import { __setQueryMetadata, __unnamedResultColumn } from '../queryBuilders/AbstractQueryBuilder.js'
import type { NAggregate, NDB, NNoTableOrViewRequired, NNotNestedAggregate, NSource, NWithDB } from '../utils/sourceName.js'
import type { DataToProject, GetDataToProjectSource } from '../complexProjections/dataToProject.js'
import type { ResultObjectValuesForAggregatedArray } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullableForAggregatedArray } from '../complexProjections/resultWithOptionalsAsNull.js'
import { __isAggregatedArrayClass, __isBigintClass, __isBooleanClass, __isDoubleClass, __isDnumDecimalClass, __isExactDecimalClass, __isIntClass, __isLocalDateClass, __isLocalDateTimeClass, __isLocalTimeClass, __isPlainDateClass, __isPlainMonthDayClass, __isPlainYearMonthClass, __isPlainDateTimeClass, __isPlainTimeClass, __isStringClass, __isDurationClass, __isInstantClass, __isUuidClass, __isZonedDateTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { __durationSqlDataTypeOf } from '../typeSystem/dataTypes.js'
import { parseUtcDateTimeText } from '../utils/utcDateTimeText.js'
import type { CombinedOptionalityOfUnion, OptionalType } from '../typeSystem/valueSource.js'
import type { AnyValueSource, IExecutableDeleteQuery, IExecutableInsertQuery, IExecutableSelectQuery, IExecutableUpdateQuery, ValueSourceOf, TypedValueSource } from '../typeSystem/valueSource.js'
import type { DataTypeName, DataTypeOfName, DataTypeValueOfName, DataTypeValueSources, DataTypeFragments } from '../typeSystem/dataTypeNames.js'
import { DoubleType, IntType } from '../typeSystem/number.js'
import type { IAnyAdditiveValueSource } from '../typeSystem/numeric.js'
import type { IAnyComparableValueSource } from '../typeSystem/comparable.js'
import type { AggregatedArrayProjectableAsNullableType, AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'
import { Argument } from '../typeSystem/arguments.js'
import type { AnyTypeClass, IValueSource, IValueWithType, OptionalityOf, RemapValueSourceTypeWithOptionalType, SourceOf, TypeClass, ValueSource, ValueTypeOf } from '../typeSystem/base.js'
import type { NullableType } from '../typeSystem/nullable.js'
import { type AlwaysIfValueSource, type IfValueSource, BooleanConditionType, BooleanType } from '../typeSystem/logical.js'
import type { FragmentExpression } from '../typeSystem/fragments.js'
import { LocalDateTimeType, LocalTimeType, LocalDateType } from '../typeSystem/localDates.js'
import { __temporal, type IntOfQuery, type TemporalDurationLike, type TemporalDurationLikeOfQuery, type TemporalPlainDateTime } from '../typeSystem/temporal.js'
import { PlainDateTimeType, PlainDateType, PlainTimeType } from '../typeSystem/plainDates.js'
import { InstantType, __instantFromEpoch } from '../typeSystem/instants.js'
import { parseInstantText, parsePlainDateTimeText, parseStoredZonedDateTimeText, parseZonedDateTimeText, plainDateTimeOfUtcDate, zonedDateTimeText } from '../utils/plainDateTimeText.js'
import { durationIsoText, durationOfArgument, durationOfReceivedValue, isDurationValue } from '../utils/durationValues.js'
import { DurationType, __durationArgument } from '../typeSystem/durations.js'
import { durationFieldNames } from '../nodes/durationOfFields.js'
import { isValueSource } from '../nodes/NodeStrategy.js'
import { dayOfStoredYearMonthsOf, yearOfStoredMonthDaysOf } from '../utils/temporalReference.js'
import type { NumberType } from '../typeSystem/number.js'
import type { BigintType } from '../typeSystem/bigint.js'
import type { StringDecimalType } from '../typeSystem/decimals.js'
import type { StringType } from '../typeSystem/strings.js'
import { __dataTypeClassFrom } from '../typeSystem/dataTypeClasses.js'
// Registers the data types of the library (the only module with side effects)
import '../typeSystem/registerDataTypes.js'
import { __typeClassOf } from '../typeSystem/valueSourceFactory.js'
import { __adaptedTypeClassOf, __keptClassOf, __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { NextTypeAdapter } from '../internal/TypeAdapterContextImpl.js'
import { __asTableOrViewRoot } from '../internal/TableOrViewRoot.js'
import { __inCreation } from '../utils/inCreation.js'
import { decimalsOfSqlDataType, dnumOfText, exactDecimalTextWithDecimals, isDnumValue, textOfDnum } from '../utils/exactDecimalValues.js'

export abstract class AbstractConnection</*in|out*/ DB extends NDB> implements IConnection<DB> {
    [connection]!: DB

    protected __sqlBuilder: SqlBuilder
    protected allowEmptyString: boolean = false
    /** Whether the database keeps a duration in an interval of its own (PostgreSQL, Oracle) */
    protected hasNativeDurations(): boolean {
        return false
    }
    /**
     * Whether a duration is kept in an interval of the database: on PostgreSQL and Oracle, unless the SQL data type of
     * its column is a text. Otherwise it is kept as its ISO 8601 text, the text of Temporal
     */
    protected isDurationKeptAsInterval(sqlDataType: SqlDataType | undefined): boolean {
        return this.hasNativeDurations() && sqlDataType?.family !== 'character string'
    }
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

    /**
     * The type of the database of this connection for a SQL data type: its native name of this database when it has
     * one, otherwise from its family and its properties, for the version and the strategies of the connection;
     * undefined when the database can't hold it (never another type). Built once for each class of connection and kept
     * in the SQL data type: override `buildNativeSqlDataTypeOf` to change it
     */
    /**
     * The SQL data type of a type of the database of this connection, as its catalogue writes it, aliases accepted, with
     * that name as its native one: for `withSqlDataType`, or a program that reads the catalogue. A name the connection
     * doesn't know gives a user-defined type
     */
    sqlDataTypeFrom(nativeName: string): SqlDataType {
        return { family: 'user-defined', name: nativeName.trim() }
    }
    nativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
        const connectionClassId = connectionClassIdOf(this)
        const kept = keptNativeSqlDataType(sqlDataType, connectionClassId)
        if (kept !== undefined) {
            return kept === null ? undefined : kept
        }
        const native = this.buildNativeSqlDataTypeOf(sqlDataType)
        keepNativeSqlDataType(sqlDataType, connectionClassId, native)
        return native
    }
    /** Builds what nativeSqlDataTypeOf gives (see it); called once for each SQL data type and class of connection */
    protected buildNativeSqlDataTypeOf(_sqlDataType: SqlDataType): string | undefined {
        return undefined
    }
    /**
     * The zone of the database, an IANA name like `'Europe/Madrid'`: the zone of its data, in which it gives its current
     * date and time. A localDateTime or a localTime stored without zone is a wall clock of this zone, and the session of
     * the connection must be in it. `'UTC'` by default. Another zone is supported on PostgreSQL and Oracle, where the
     * database completes the zone of those values with its session; MariaDB, MySQL, SQL Server and SQLite reject it.
     */
    protected databaseTimeZone: string = 'UTC'
    /**
     * With a databaseTimeZone other than UTC, the date a time of the day (a localTime) is converted between the zone of
     * the database and UTC with, which gives it the offset of that date: a date `'YYYY-MM-DD'` (`'1972-01-01'` by
     * default) or `'today'`, the current date of the database. The Date read keeps that date
     */
    protected dateToConvertTimesBetweenZones: string = '1972-01-01'
    /**
     * The day of the date a month of a year (plainYearMonth) is stored in: 1 to 28, a day every month has. 1 by
     * default, the one of Temporal. A date read is accepted on any day
     */
    protected dayOfStoredYearMonths: number = 1
    /**
     * The year of the date a day of a month (plainMonthDay) is stored in: a leap year, that has February 29. 1972 by
     * default, the one of Temporal. A date read is accepted in any year
     */
    protected yearOfStoredMonthDays: number = 1972
    /** Whether the databaseTimeZone isn't UTC */
    protected isDatabaseOutsideUtc(): boolean {
        return !isUtcTimeZoneName(this.databaseTimeZone)
    }
    readonly queryRunner: QueryRunner
    readonly defaultTypeAdapter: DefaultTypeAdapter

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        this.defaultTypeAdapter = this as any // transform protected methods to public
        sqlBuilder._defaultTypeAdapter = this.defaultTypeAdapter
        sqlBuilder._nextTypeAdapter = new NextTypeAdapter(this.defaultTypeAdapter)
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
        if (this.isTransactionActive() && !this.queryRunner.nestedTransactionsSupported) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions not supported'))
        }
        const opts: any = isolationLevel || []
        const executionParams = __setQueryMetadata(source, opts, this.__sqlBuilder, [])
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
            }, this.queryRunner, executionParams).then((result) => {
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
        if (!this.queryRunner.lowLevelTransactionManagementSupported) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'This query runner only supports a transaction with connection.transaction(fn)'))
        }
        if (this.isTransactionActive() && !this.queryRunner.nestedTransactionsSupported) {
            return this.queryRunner.createRejectedPromise(new TsSqlQueryExecutionError(source, { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions not supported'))
        }
        const opts: any = isolationLevel || []
        const executionParams = __setQueryMetadata(source, opts, this.__sqlBuilder, [])
        try {
            return this.queryRunner.executeBeginTransaction(executionParams).then((result) => {
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
        const executionParams = __setQueryMetadata(source, opts, this.__sqlBuilder, [])
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
                            return this.queryRunner.executeCommit(executionParams).then(() => {
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
            return this.queryRunner.executeCommit(executionParams).then(() => {
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
        const executionParams = __setQueryMetadata(source, opts, this.__sqlBuilder, [])
        try {
            return this.queryRunner.executeRollback(executionParams).then(() => {
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
    pi(): ValueSource<NNoTableOrViewRequired<DB>, DoubleType, 'required'>
    pi(): any {
        return __createStatic0('_pi', DoubleType, 'required')
    }
    random(): ValueSource<NNoTableOrViewRequired<DB>, DoubleType, 'required'>
    random(): any {
        return __createStatic0('_random', DoubleType, 'required')
    }
    currentDate(): ValueSource<NNoTableOrViewRequired<DB>, LocalDateType, 'required'>
    currentDate(): any {
        return __createStatic0('_currentDate', LocalDateType, 'required')
    }
    currentTime(): ValueSource<NNoTableOrViewRequired<DB>, LocalTimeType, 'required'>
    currentTime(): any {
        return __createStatic0('_currentTime', LocalTimeType, 'required')
    }
    currentDateTime(): ValueSource<NNoTableOrViewRequired<DB>, LocalDateTimeType, 'required'>
    currentDateTime(): any {
        return __createStatic0('_currentTimestamp', LocalDateTimeType, 'required')
    }
    currentTimestamp(): ValueSource<NNoTableOrViewRequired<DB>, LocalDateTimeType, 'required'>
    currentTimestamp(): any {
        return __createStatic0('_currentTimestamp', LocalDateTimeType, 'required')
    }
    /** The date of today in the database, as a Temporal.PlainDate: what `currentDate()` gives, as a plainDate */
    currentPlainDate(): ValueSource<NNoTableOrViewRequired<DB>, PlainDateType, 'required'>
    currentPlainDate(): any {
        return __createStatic0('_currentDate', PlainDateType, 'required')
    }
    /** The time of now in the database, as a Temporal.PlainTime: what `currentTime()` gives, as a plainTime */
    currentPlainTime(): ValueSource<NNoTableOrViewRequired<DB>, PlainTimeType, 'required'>
    currentPlainTime(): any {
        return __createStatic0('_currentTime', PlainTimeType, 'required')
    }
    /**
     * The date and time of now in the database, as a Temporal.PlainDateTime: what `currentDateTime()` gives, as a
     * plainDateTime, in the zone of the database
     */
    currentPlainDateTime(): ValueSource<NNoTableOrViewRequired<DB>, PlainDateTimeType, 'required'>
    currentPlainDateTime(): any {
        return __createStatic0('_currentPlainDateTime', PlainDateTimeType, 'required')
    }
    /**
     * The instant of now in the database, as a Temporal.Instant: Temporal's `Temporal.Now.instant()`, with the digits of
     * the fraction of a second the database gives
     */
    currentInstant(): ValueSource<NNoTableOrViewRequired<DB>, InstantType, 'required'>
    currentInstant(): any {
        return __createStatic0('_currentInstant', InstantType, 'required')
    }
    /** The duration of the fields given, as Temporal's `Temporal.Duration.from`: integers with one sign, sent as a value */
    duration(fields: TemporalDurationLike): ValueSource<NNoTableOrViewRequired<DB>, DurationType, 'required'>
    /**
     * The duration of the fields given, as Temporal's `Temporal.Duration.from`, where a field is an integer or an int of
     * the query, like a column (`{ days: tInvoice.graceDays }`): the database writes it as it keeps a duration (its ISO
     * 8601 text, as Temporal's toString, or its interval), and the query fails, as Temporal throws, for a row where the
     * fields have different signs. It has the sources of its fields, and is optional when one of them is
     */
    duration<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(fields: TemporalDurationLikeOfQuery<IntOfQuery<SOURCE2, OPTIONAL_TYPE2>>): ValueSource<NNoTableOrViewRequired<DB> | SOURCE2, DurationType, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>
    duration(fields: unknown): any {
        const argument = __durationArgument(fields, durationFieldNames)
        if (isValueSource(argument)) {
            return argument
        }
        const value = durationOfArgument(fields, 'duration')
        if (!value) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: fields, typeName: 'duration' }, 'Invalid fields of a duration: ' + JSON.stringify(fields))
        }
        return this.const(value as any, 'duration')
    }
    /**
     * The instant of the milliseconds since 1970-01-01T00:00Z given, as Temporal's `Temporal.Instant.fromEpochMilliseconds`:
     * a number is the Temporal.Instant sent as a value
     */
    instantFromEpochMilliseconds(epochMilliseconds: number): ValueSource<NNoTableOrViewRequired<DB>, InstantType, 'required'>
    /**
     * The instant of the milliseconds since 1970-01-01T00:00Z of an int or a bigint, as Temporal's
     * `Temporal.Instant.fromEpochMilliseconds`, computed by the database
     */
    instantFromEpochMilliseconds<VALUE extends IValueWithType<'type:int:number:'> | IValueWithType<'type:bigint:'>>(epochMilliseconds: VALUE): ValueSource<SourceOf<VALUE>, InstantType, OptionalityOf<VALUE>>
    instantFromEpochMilliseconds(epochMilliseconds: unknown): any {
        return __instantFromEpoch(epochMilliseconds, '_instantFromEpochMilliseconds')
    }
    /**
     * The instant of the nanoseconds since 1970-01-01T00:00Z given, as Temporal's `Temporal.Instant.fromEpochNanoseconds`:
     * a bigint is the Temporal.Instant sent as a value
     */
    instantFromEpochNanoseconds(epochNanoseconds: bigint): ValueSource<NNoTableOrViewRequired<DB>, InstantType, 'required'>
    /**
     * The instant of the nanoseconds since 1970-01-01T00:00Z of a bigint or an int, as Temporal's
     * `Temporal.Instant.fromEpochNanoseconds`, computed by the database with the digits it keeps
     */
    instantFromEpochNanoseconds<VALUE extends IValueWithType<'type:bigint:'> | IValueWithType<'type:int:number:'>>(epochNanoseconds: VALUE): ValueSource<SourceOf<VALUE>, InstantType, OptionalityOf<VALUE>>
    instantFromEpochNanoseconds(epochNanoseconds: unknown): any {
        return __instantFromEpoch(epochNanoseconds, '_instantFromEpochNanoseconds')
    }

    const<TYPE extends DataTypeName>(value: DataTypeValueOfName<TYPE>, type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<NNoTableOrViewRequired<DB>, 'required'>[TYPE]
    const<TYPE extends NullableType<any>>(value: ValueTypeOf<TYPE>, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<NNoTableOrViewRequired<DB>, TYPE, 'required'>
    const(value: any, type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        return __createConst(value, __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter), 'required')
    }

    optionalConst<TYPE extends DataTypeName>(value: DataTypeValueOfName<TYPE> | null | undefined, type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<NNoTableOrViewRequired<DB>, 'optional'>[TYPE]
    optionalConst<TYPE extends NullableType<any>>(value: ValueTypeOf<TYPE> | null | undefined, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<NNoTableOrViewRequired<DB>, TYPE, 'optional'>
    optionalConst(value: any, type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        return __createConst(value, __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter), 'optional')
    }

    true(): ValueSource<NNoTableOrViewRequired<DB>, BooleanType, 'required'> {
        return __createStaticBoolean('_true')
    }
    false(): ValueSource<NNoTableOrViewRequired<DB>, BooleanType, 'required'> {
        return __createStaticBoolean('_false')
    }
    exists<SOURCE extends NSource>(select: IExecutableSelectQuery<SOURCE, any, any> & SameDB<DB>): ValueSource<SOURCE, BooleanType, 'required'> {
        // `EXISTS(...)` / `NOT EXISTS(...)` are already SQL predicates in
        // every dialect — they don't need the boolean-to-int wrapping that
        // Oracle/SQL Server otherwise apply to boolean value sources
        // (e.g. `(exists(...) = 1)`, which SQL Server rejects as a syntax
        // error). Marking the result as a condition-only boolean keeps the
        // wrap from kicking in inside `where`/`and`/`or`.
        return __createStatic1('_exists', select, BooleanConditionType, 'required')
    }
    notExists<SOURCE extends NSource>(select: IExecutableSelectQuery<SOURCE, any, any> & SameDB<DB>): ValueSource<SOURCE, BooleanType, 'required'> {
        return __createStatic1('_notExists', select, BooleanConditionType, 'required')
    }

    protected executeProcedure(procedureName: string, params: readonly ValueSourceOf<NNoTableOrViewRequired<DB>>[]): Promise<void> {
        const source = new QueryExecutionSource('Query executed at')
        let query: string | undefined
        try {
            const queryParams: any[] = []
            query = this.__sqlBuilder._buildCallProcedure(new SqlBuildContext(queryParams), procedureName, params)
            const executionParams = __setQueryMetadata(source, queryParams, this.__sqlBuilder, [])
            return this.__sqlBuilder._queryRunner.executeQuery('executeProcedure', query, executionParams).catch((e) => {
                throw new TsSqlQueryExecutionError(source, this.__sqlBuilder._queryRunner.getErrorReason(e), e)
            })
        } catch (e) {
            return this.__rejectExecution(source, e, query)
        }
    }

    protected executeFunction<TYPE extends DataTypeName>(functionName: string, params: readonly ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: TYPE, required: 'required', adapter?: TypeAdapter): Promise<DataTypeValueOfName<TYPE>>
    protected executeFunction<TYPE extends NullableType<any>>(functionName: string, params: readonly ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: TypeClass<TYPE>, required: 'required', adapter?: TypeAdapter): Promise<ValueTypeOf<TYPE>>
    protected executeFunction<TYPE extends DataTypeName>(functionName: string, params: readonly ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: TYPE, required: 'optional', adapter?: TypeAdapter): Promise<DataTypeValueOfName<TYPE> | null>
    protected executeFunction<TYPE extends NullableType<any>>(functionName: string, params: readonly ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: TypeClass<TYPE>, required: 'optional', adapter?: TypeAdapter): Promise<ValueTypeOf<TYPE> | null>
    protected executeFunction(functionName: string, params: readonly ValueSourceOf<NNoTableOrViewRequired<DB>>[], returnType: string | AnyTypeClass, required: string, adapter?: TypeAdapter): Promise<any> {
        const source = new QueryExecutionSource('Query executed at')
        let query: string | undefined
        try {
            const typeClass = __dataTypeClassFrom(returnType)
            const type = typeClass.type
            const functionCall = __createFunctionCall(functionName, params as readonly AnyValueSource[], __adaptedTypeClassOf(typeClass, adapter), required === 'optional' ? 'optional' : 'required')
            const queryParams: any[] = []
            query = this.__sqlBuilder._buildCallFunction(new SqlBuildContext(queryParams), functionCall)
            const executionParams = __setQueryMetadata(source, queryParams, this.__sqlBuilder, __unnamedResultColumn(functionCall, this.__sqlBuilder))
            return this.__sqlBuilder._queryRunner.executeQuery('executeFunction', query, executionParams).then((value) => {
                let result
                try {
                    const adapterContext = this.__sqlBuilder._prepareTypeAdapterReadContext(functionCall, 'resultColumn')
                    result = this.__sqlBuilder._nextTypeAdapter.transformValueFromDB(value, adapterContext)
                } catch(e) {
                    if (e instanceof TsSqlError) {
                        throw e
                    } else {
                        throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, e)
                    }
                }
                if (value === undefined) {
                    throw new TsSqlProcessingError({ reason: 'NO_RESULT' }, 'No result returned by the database')
                }
                if (result === null && required !== 'optional') {
                    throw new TsSqlProcessingError({ reason: 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE', value: result, typeName: type }, 'Expected a value as result of the function `' + functionName + '`, but null or undefined value was found')
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

    fragmentWithType<TYPE extends DataTypeName>(type: TYPE, required: 'required', adapter?: TypeAdapter): DataTypeFragments<NNoTableOrViewRequired<DB>, 'required'>[TYPE]
    fragmentWithType<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'required', adapter?: TypeAdapter): FragmentExpression<NNoTableOrViewRequired<DB>, TYPE, 'required'>
    fragmentWithType<TYPE extends DataTypeName>(type: TYPE, required: 'optional', adapter?: TypeAdapter): DataTypeFragments<NNoTableOrViewRequired<DB>, 'optional'>[TYPE]
    fragmentWithType<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'optional', adapter?: TypeAdapter): FragmentExpression<NNoTableOrViewRequired<DB>, TYPE, 'optional'>
    fragmentWithType(type: string | AnyTypeClass, required: string, adapter?: TypeAdapter): any {
        return new FragmentQueryBuilder(__dataTypeClassFrom(type), required as any, adapter)
    }

    protected arg<TYPE extends DataTypeName>(type: TYPE, required: 'required', adapter?: TypeAdapter): Argument<DataTypeOfName<TYPE>, 'required', 'combined'>
    protected arg<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'required', adapter?: TypeAdapter): Argument<TYPE, 'required', 'combined'>
    protected arg<TYPE extends DataTypeName>(type: TYPE, required: 'optional', adapter?: TypeAdapter): Argument<DataTypeOfName<TYPE>, 'optional', 'combined'>
    protected arg<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'optional', adapter?: TypeAdapter): Argument<TYPE, 'optional', 'combined'>
    protected arg(type: string | AnyTypeClass, required: string, adapter?: TypeAdapter): any {
        return new Argument(__dataTypeClassFrom(type), required as any, 'combined', adapter)
    }

    protected valueArg<TYPE extends DataTypeName>(type: TYPE, required: 'required', adapter?: TypeAdapter): Argument<DataTypeOfName<TYPE>, 'required', 'value'>
    protected valueArg<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'required', adapter?: TypeAdapter): Argument<TYPE, 'required', 'value'>
    protected valueArg<TYPE extends DataTypeName>(type: TYPE, required: 'optional', adapter?: TypeAdapter): Argument<DataTypeOfName<TYPE>, 'optional', 'value'>
    protected valueArg<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'optional', adapter?: TypeAdapter): Argument<TYPE, 'optional', 'value'>
    protected valueArg(type: string | AnyTypeClass, required: string, adapter?: TypeAdapter): any {
        return new Argument(__dataTypeClassFrom(type), required as any, 'value', adapter)
    }

    protected buildFragmentWithArgs(): FragmentBuilder0<NNoTableOrViewRequired<DB>>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any>>(a1: A1): FragmentBuilder1<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>>(a1: A1, a2: A2): FragmentBuilder2<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>, A5 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgs(...args: Argument<any, any, any>[]): any {
        return new FragmentFunctionBuilder(args)
    }

    protected buildFragmentWithArgsIfValue(): FragmentBuilder0IfValue<NNoTableOrViewRequired<DB>>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any>>(a1: A1): FragmentBuilder1IfValue<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>>(a1: A1, a2: A2): FragmentBuilder2IfValue<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>, A5 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgsIfValue(...args: Argument<any, any, any>[]): any {
        return new FragmentFunctionBuilderIfValue(this as any, args) // make this protected fields as public
    }

    protected buildFragmentWithMaybeOptionalArgs(): FragmentBuilderMaybeOptional0<NNoTableOrViewRequired<DB>>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>>(a1: A1): FragmentBuilderMaybeOptional1<NNoTableOrViewRequired<DB>, A1>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>>(a1: A1, a2: A2): FragmentBuilderMaybeOptional2<NNoTableOrViewRequired<DB>, A1, A2>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilderMaybeOptional3<NNoTableOrViewRequired<DB>, A1, A2, A3>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilderMaybeOptional4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4>
    protected buildFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>, A5 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilderMaybeOptional5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5>
    protected buildFragmentWithMaybeOptionalArgs(...args: Argument<any, any, any>[]): any {
        return new FragmentFunctionBuilderMaybeOptional(this as any, args)
    }

    // --- Aggregate fragment variants ---
    // Same shape as the non-aggregate fragment builders, but the produced
    // value source carries the aggregate marker (NAggregate<DB> in its source
    // + __isAggregate at runtime), so a custom aggregate written as a fragment
    // is rejected outside aggregate-legal clauses, just like a built-in aggregate.
    aggregateFragmentWithType<TYPE extends DataTypeName>(type: TYPE, required: 'required', adapter?: TypeAdapter): DataTypeFragments<NNoTableOrViewRequired<DB>, 'required', NAggregate<DB>>[TYPE]
    aggregateFragmentWithType<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'required', adapter?: TypeAdapter): FragmentExpression<NNoTableOrViewRequired<DB>, TYPE, 'required', NAggregate<DB>>
    aggregateFragmentWithType<TYPE extends DataTypeName>(type: TYPE, required: 'optional', adapter?: TypeAdapter): DataTypeFragments<NNoTableOrViewRequired<DB>, 'optional', NAggregate<DB>>[TYPE]
    aggregateFragmentWithType<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'optional', adapter?: TypeAdapter): FragmentExpression<NNoTableOrViewRequired<DB>, TYPE, 'optional', NAggregate<DB>>
    aggregateFragmentWithType(type: string | AnyTypeClass, required: string, adapter?: TypeAdapter): any {
        return new FragmentQueryBuilder(__dataTypeClassFrom(type), required as any, adapter, true)
    }

    protected buildAggregateFragmentWithArgs(): FragmentBuilder0<NNoTableOrViewRequired<DB>, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any>>(a1: A1): FragmentBuilder1<NNoTableOrViewRequired<DB>, A1, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>>(a1: A1, a2: A2): FragmentBuilder2<NNoTableOrViewRequired<DB>, A1, A2, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3<NNoTableOrViewRequired<DB>, A1, A2, A3, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>, A5 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5, NAggregate<DB>>
    protected buildAggregateFragmentWithArgs(...args: Argument<any, any, any>[]): any {
        return new FragmentFunctionBuilder(args, true)
    }

    protected buildAggregateFragmentWithArgsIfValue(): FragmentBuilder0IfValue<NNoTableOrViewRequired<DB>, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any>>(a1: A1): FragmentBuilder1IfValue<NNoTableOrViewRequired<DB>, A1, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>>(a1: A1, a2: A2): FragmentBuilder2IfValue<NNoTableOrViewRequired<DB>, A1, A2, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilder3IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>, A5 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5IfValue<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5, NAggregate<DB>>
    protected buildAggregateFragmentWithArgsIfValue(...args: Argument<any, any, any>[]): any {
        return new FragmentFunctionBuilderIfValue(this as any, args, true) // make this protected fields as public
    }

    protected buildAggregateFragmentWithMaybeOptionalArgs(): FragmentBuilderMaybeOptional0<NNoTableOrViewRequired<DB>, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>>(a1: A1): FragmentBuilderMaybeOptional1<NNoTableOrViewRequired<DB>, A1, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>>(a1: A1, a2: A2): FragmentBuilderMaybeOptional2<NNoTableOrViewRequired<DB>, A1, A2, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3): FragmentBuilderMaybeOptional3<NNoTableOrViewRequired<DB>, A1, A2, A3, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilderMaybeOptional4<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs<A1 extends Argument<any, any, any>, A2 extends Argument<any, any, any>, A3 extends Argument<any, any, any>, A4 extends Argument<any, any, any>, A5 extends Argument<any, any, any>>(a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilderMaybeOptional5<NNoTableOrViewRequired<DB>, A1, A2, A3, A4, A5, NAggregate<DB>>
    protected buildAggregateFragmentWithMaybeOptionalArgs(...args: Argument<any, any, any>[]): any {
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
        return __createRawFragment(sql, params)
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
                const table = __createTableOrViewRawFragment(target, '_rawFragmentTableName')
                const alias = __createTableOrViewRawFragment(target, '_rawFragmentTableAlias')
                // The target is a copy being created (`as`, `forUseInLeftJoinAs`)
                const p = __inCreation(__asTableOrViewRoot(target))
                p.__template = fn(table, alias, ...params)
                p.__customizationName = name
                p.__customizationApply = apply
            }
            const as = __asTableOrViewRoot(tableOrView).__as
            const result = (tableOrView as any).as(as)
            apply(result)
            return result as any
        }
    }

    noValueBoolean(): IfValueSource<NNoTableOrViewRequired<DB>, 'required'> {
        return __createIfValueAlwaysNoop('required')
    }

    dynamicBooleanExpressionUsing<SOURCE extends NSource>(table: ITableOrView<SOURCE> & SameDB<DB>): AlwaysIfValueSource<SOURCE | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource, S4 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>, table4: ITableOrView<S4> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | S4 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing<S1 extends NSource, S2 extends NSource, S3 extends NSource, S4 extends NSource, S5 extends NSource>(table1: ITableOrView<S1> & SameDB<DB>, table2: ITableOrView<S2> & SameDB<DB>, table3: ITableOrView<S3> & SameDB<DB>, table4: ITableOrView<S4> & SameDB<DB>, table5: ITableOrView<S5> & SameDB<DB>): AlwaysIfValueSource<S1 | S2 | S3 | S4 | S5 | NNoTableOrViewRequired<DB>, any>
    dynamicBooleanExpressionUsing(..._tables: any[]): AlwaysIfValueSource<any, any> {
        return __createIfValueAlwaysNoop('required')
    }

    // Agregate functions
    countAll(): ValueSource<NNoTableOrViewRequired<DB> | NAggregate<DB>, IntType, 'required'> {
        return __createAggregateFunction0('_countAll', IntType, 'required')
    }
    count<SOURCE extends NSource>(value: ValueSourceOf<SOURCE> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, IntType, 'required'> {
        return __createAggregateFunction1('_count', value, IntType, 'required')
    }
    countDistinct<SOURCE extends NSource>(value: ValueSourceOf<SOURCE> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, IntType, 'required'> {
        return __createAggregateFunction1('_countDistinct', value, IntType, 'required')
    }
    max<TYPE extends IAnyComparableValueSource<any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<DB>, TYPE, 'optional'> {
        const nodeValue = __asNodeValueSource(value)
        return (__createAggregateFunction1('_max', value, __keptClassOf(nodeValue, __typeClassOf(nodeValue)), 'optional')) as any
    }
    min<TYPE extends IAnyComparableValueSource<any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<DB>, TYPE, 'optional'> {
        const nodeValue = __asNodeValueSource(value)
        return (__createAggregateFunction1('_min', value, __keptClassOf(nodeValue, __typeClassOf(nodeValue)), 'optional')) as any
    }
    sum<SOURCE extends NSource>(value: IValueSource<SOURCE, NumberType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, NumberType, 'optional'>
    sum<SOURCE extends NSource>(value: IValueSource<SOURCE, BigintType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, BigintType, 'optional'>
    sum<SOURCE extends NSource>(value: IValueSource<SOURCE, StringDecimalType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, StringDecimalType, 'optional'>
    sum<TYPE extends IAnyAdditiveValueSource<any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<DB>, TYPE, 'optional'>
    sum(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const nodeValue = __asNodeValueSource(value)
        return __createAggregateFunction1('_sum', value, __computedClassOf(nodeValue, __typeClassOf(nodeValue)), 'optional')
    }
    sumDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, NumberType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, NumberType, 'optional'>
    sumDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, BigintType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, BigintType, 'optional'>
    sumDistinct<SOURCE extends NSource>(value: IValueSource<SOURCE, StringDecimalType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, StringDecimalType, 'optional'>
    sumDistinct<TYPE extends IAnyAdditiveValueSource<any>>(value: TYPE & SameDB<DB> & NNotNestedAggregate<TYPE[typeof source], DB>): RemapValueSourceTypeWithOptionalType<TYPE[typeof source] | NAggregate<DB>, TYPE, 'optional'>
    sumDistinct(value: ValueSourceOf<any>): ValueSourceOf<any> {
        const nodeValue = __asNodeValueSource(value)
        return __createAggregateFunction1('_sumDistinct', value, __computedClassOf(nodeValue, __typeClassOf(nodeValue)), 'optional')
    }
    // `AVG` is conceptually a fractional operation: averaging any set of
    // numerics may yield a non-integer scalar. Every supported engine
    // except SQL Server reflects that (PostgreSQL → numeric, MariaDB /
    // MySQL → decimal, Oracle → NUMBER, SQLite → real); SQL Server is
    // the lone outlier and truncates `AVG(int)` back to int by
    // historical SQL convention. The library exposes the conceptual
    // semantics: `average(...)` / `averageDistinct(...)` always return
    // `ValueSource<..., NumberType, 'optional'>` (TS `number`, runtime
    // `'double'`) regardless of the input value-type, and SQL Server
    // emits a cast inside `_average` / `_averageDistinct` so the engine
    // also returns a fractional scalar — homogenising behaviour across
    // every dialect.
    average<SOURCE extends NSource>(value: (IValueSource<SOURCE, NumberType, any> | IValueSource<SOURCE, BigintType, any> | IValueSource<SOURCE, StringDecimalType, any> | IAnyAdditiveValueSource<SOURCE>) & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, DoubleType, 'optional'>
    average(value: ValueSourceOf<any>): ValueSourceOf<any> {
        return __createAggregateFunction1('_average', value, DoubleType, 'optional')
    }
    averageDistinct<SOURCE extends NSource>(value: (IValueSource<SOURCE, NumberType, any> | IValueSource<SOURCE, BigintType, any> | IValueSource<SOURCE, StringDecimalType, any> | IAnyAdditiveValueSource<SOURCE>) & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, DoubleType, 'optional'>
    averageDistinct(value: ValueSourceOf<any>): ValueSourceOf<any> {
        return __createAggregateFunction1('_averageDistinct', value, DoubleType, 'optional')
    }
    stringConcat<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>): ValueSource<SOURCE | NAggregate<DB>, StringType, 'optional'>
    stringConcat<SOURCE extends NSource>(value: IValueSource<SOURCE, StringType, any> & SameDB<DB> & NNotNestedAggregate<SOURCE, DB>, separator: string): ValueSource<SOURCE | NAggregate<DB>, StringType, 'optional'>
    stringConcat(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const nodeValue = __asNodeValueSource(value)
        return __createAggregateFunction1or2('_stringConcat', separator, value, __typeClassOf(nodeValue), 'optional')
    }
    // `stringConcatDistinct` is declared on each concrete connection whose
    // dialect accepts DISTINCT inside its string-aggregation function (PG,
    // MariaDB, MySQL, SQLite, Oracle, NoopDB) so the property is absent on
    // SqlServerConnection, whose STRING_AGG rejects DISTINCT entirely. See
    // each `<DB>Connection.ts` for the per-dialect declaration.

    aggregateAsArray<COLUMNS extends AggregatedArrayColumns<DB>>(columns: COLUMNS & NNotNestedAggregate<SourceOfAggregatedArray<COLUMNS>, DB>): ValueSource<SourceOfAggregatedArray<COLUMNS> | NAggregate<DB>, AggregatedArrayProjectableAsNullableType<Array<{ [P in keyof ResultObjectValuesForAggregatedArray<COLUMNS>]: ResultObjectValuesForAggregatedArray<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>]: ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS>[P] }>>, 'required'> {
        return __createAggregateValueAsArray(columns as QueryColumns, 'InnerResultObject', 'required', false)
    }
    aggregateAsArrayOfOneColumn<VALUE extends TypedValueSource<any, any, any>>(value: VALUE & NNotNestedAggregate<VALUE[typeof source], DB>): ValueSource<VALUE[typeof source] | NAggregate<DB>, AggregatedArrayType<Array<VALUE[typeof valueType]>>, 'required'> {
        return __createAggregateValueAsArray(value, 'InnerResultObject', 'required', false)
    }

    dynamicConditionFor<DEFINITION extends Filterable>(definition: DEFINITION): DynamicConditionExpression<DEFINITION, never>
    dynamicConditionFor<DEFINITION extends Filterable, EXTENSION extends DynamicConditionExtension>(definition: DEFINITION, extension: EXTENSION): DynamicConditionExpression<DEFINITION, EXTENSION>
    dynamicConditionFor(definition: Filterable, extension?: any): any {
        return new DynamicConditionBuilder(this.__sqlBuilder, definition, extension)
    }

    /**
     * The text of a uuid sent to or received from the database. A database that keeps the text of a uuid as it is
     * (a uuid strategy that stores it in a text column) writes it in lower case, as the others give it.
     */
    protected __normalizeUuidText(value: string): string {
        return value
    }
    /** Converts a value received from the database as the requested type */
    /**
     * Whether the text of an exact decimal received from that output lacks the decimals the database gives the value,
     * so the ones of its SQL data type complete it: the database writes them in the text (MariaDB, MySQL, PostgreSQL,
     * SQL Server)
     */
    protected __exactDecimalTextLacksTheDecimalsOfTheDatabase(_output: ProjectionOutput): boolean {
        return false
    }
    protected transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown {
        const type = context.requestedType.type
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        if (__isBooleanClass(context.requestedType)) {
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
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid boolean value received from the db: ' + String(value))
        }
        if (__isIntClass(context.requestedType)) {
            if (typeof value === 'number') {
                if (!Number.isInteger(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + String(value))
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
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + String(value))
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
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + String(value))
        }
        if (__isBigintClass(context.requestedType)) {
            if (typeof value === 'number') {
                if (!Number.isInteger(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid bigint value received from the db: ' + String(value))
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
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid bigint value received from the db: ' + String(value))
                }
            }
            if (typeof value === 'bigint') {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid int value received from the db: ' + String(value))
        }
        if (__isDoubleClass(context.requestedType)) {
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
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid double value received from the db: ' + String(value))
                }
                const result = +value
                return result
            }
            if (typeof value === 'bigint') {
                return Number(value)
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid double value received from the db: ' + String(value))
        }
        if (__isExactDecimalClass(context.requestedType)) {
            let text: string
            if (typeof value === 'string') {
                // The text the database gives keeps its digits, and its decimals when the database keeps them (`1.50`);
                // the query runner adds the zeros at its end when the driver says the decimals and the text doesn't
                // have them (Oracle). A number without the zero before the point (`.5`, as Oracle writes it) gets it
                if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid decimal value received from the db: ' + String(value))
                }
                if (value.startsWith('.')) {
                    text = '0' + value
                } else if (value.startsWith('-.')) {
                    text = '-0' + value.substring(1)
                } else {
                    text = value
                }
            } else if (typeof value === 'number') {
                // The driver gave a JavaScript number: the digits beyond its precision, and the scale, are already
                // lost, and nothing tells which
                throw new TsSqlProcessingError({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value, typeName: type }, 'Precision lost reading a decimal value from the db: the driver returned ' + value + ' as a JavaScript number')
            } else if (typeof value === 'bigint') {
                text = '' + value
            } else if (isDnumValue(value)) {
                text = textOfDnum(value)
            } else {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid decimal value received from the db: ' + String(value))
            }
            // The decimals of the value are the ones the database gives; where it doesn't give them, the ones the SQL
            // data type says (the scale of a `numeric(18, 4)`), and without them, the ones of the value received. A
            // digit other than a zero beyond them is never removed
            if (this.__exactDecimalTextLacksTheDecimalsOfTheDatabase(context.output)) {
                const decimals = decimalsOfSqlDataType(context.requestedSqlDataType)
                if (decimals !== undefined) {
                    text = exactDecimalTextWithDecimals(text, decimals)
                }
            }
            if (__isDnumDecimalClass(context.requestedType)) {
                return dnumOfText(text)
            }
            return text
        }
        if (__isStringClass(context.requestedType)) {
            if (typeof value === 'string') {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid string value received from the db: ' + String(value))
        }
        if (__isUuidClass(context.requestedType)) {
            if (typeof value === 'string') {
                return this.__normalizeUuidText(value)
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid uuid value received from the db: ' + String(value))
        }
        if (__isLocalDateClass(context.requestedType)) {
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
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid localDate value received from the db: ' + String(value))
            }
            const result: any = new Date(0)
            result.setUTCFullYear(received.getUTCFullYear(), received.getUTCMonth(), received.getUTCDate())
            result.setUTCHours(10) // date-stability offset (see the note above)
            result.___type___ = 'localDate'
            return result
        }
        if (__isLocalTimeClass(context.requestedType)) {
            // The time of a Date received is the one of its UTC getters, and a text is read as UTC (or as its
            // instant, when it has an offset). Some engines write a time with a date (Oracle's TIMESTAMP inside a
            // JSON aggregate is "1970-01-01T09:15:00"): only its time is kept, on 1970-01-01.
            const received = this.__receivedDate(value)
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid localTime value received from the db: ' + String(value))
            }
            // With a databaseTimeZone other than UTC the database gives the instant of the time on the day of the
            // dateToConvertTimesBetweenZones: that day gives it its offset, and the Date keeps it
            const result: any = this.isDatabaseOutsideUtc() ? new Date(received.getTime()) : new Date(Date.UTC(1970, 0, 1, received.getUTCHours(), received.getUTCMinutes(), received.getUTCSeconds(), received.getUTCMilliseconds()))
            result.___type___ = 'localTime'
            return result
        }
        if (__isLocalDateTimeClass(context.requestedType)) {
            // A Date received is kept: the query runner gives the UTC digits of a value without zone in its UTC
            // getters, and the instant of a zoned one. A text is read as UTC, or as its instant when it has an offset.
            const received = this.__receivedDate(value)
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid localDateTime value received from the db: ' + String(value))
            }
            (received as any).___type___ = 'localDateTime'
            return received
        }
        if (__isPlainDateClass(context.requestedType)) {
            // The day of a PlainDateTime or of a text with a time (Oracle's DATE inside a JSON aggregate is
            // "2024-01-15T00:00:00"), as the day of a localDate
            const temporal = __temporal(type)
            if (value instanceof temporal.PlainDate) {
                return value
            }
            const received = value instanceof temporal.PlainDateTime ? value : this.__receivedPlainDateTime(value, type)
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid plainDate value received from the db: ' + String(value))
            }
            return received.toPlainDate()
        }
        if (__isPlainYearMonthClass(context.requestedType) || __isPlainMonthDayClass(context.requestedType)) {
            // Kept in a date: the month of its year, or the day of its month, on any day or year, with the reference of
            // Temporal (as Temporal's from takes a date)
            const temporal = __temporal(type)
            const yearMonth = __isPlainYearMonthClass(context.requestedType)
            if (value instanceof (yearMonth ? temporal.PlainYearMonth : temporal.PlainMonthDay)) {
                return value
            }
            const date = value instanceof temporal.PlainDate ? value : value instanceof temporal.PlainDateTime ? value.toPlainDate() : this.__receivedPlainDateTime(value, type)?.toPlainDate()
            if (!date) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid ' + type + ' value received from the db: ' + String(value))
            }
            return yearMonth ? date.toPlainYearMonth() : date.toPlainMonthDay()
        }
        if (__isPlainTimeClass(context.requestedType)) {
            // The time of a PlainDateTime or of a text with a date (Oracle's TIMESTAMP inside a JSON aggregate is
            // "1970-01-01T09:15:00"), as the time of a localTime
            const temporal = __temporal(type)
            if (value instanceof temporal.PlainTime) {
                return value
            }
            const received = value instanceof temporal.PlainDateTime ? value : this.__receivedPlainDateTime(value, type)
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid plainTime value received from the db: ' + String(value))
            }
            return received.toPlainTime()
        }
        if (__isPlainDateTimeClass(context.requestedType)) {
            const temporal = __temporal(type)
            if (value instanceof temporal.PlainDateTime) {
                return value
            }
            const received = value instanceof temporal.PlainDate ? value.toPlainDateTime() : this.__receivedPlainDateTime(value, type)
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid plainDateTime value received from the db: ' + String(value))
            }
            return received
        }
        if (__isInstantClass(context.requestedType)) {
            // Its text with all the digits of its fraction of a second: with an offset it is that instant, without one
            // the wall clock of the zone of the database; or a valid Date, from a driver that gives one, its instant
            const temporal = __temporal(type)
            if (value instanceof temporal.Instant) {
                return value
            }
            const received = value instanceof Date ? (isNaN(value.getTime()) ? undefined : temporal.Instant.fromEpochMilliseconds(value.getTime())) : typeof value === 'string' ? parseInstantText(value, this.databaseTimeZone, type) : undefined
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid instant value received from the db: ' + String(value))
            }
            return received
        }
        if (__isZonedDateTimeClass(context.requestedType)) {
            // Its instant followed by its zone in brackets, the text the database writes of it (see parseZonedDateTimeText),
            // or on a database that keeps it as text, the RFC 9557 text kept (see parseStoredZonedDateTimeText)
            if (value instanceof __temporal(type).ZonedDateTime) {
                return value
            }
            const received = typeof value !== 'string' ? undefined : this.__sqlBuilder._zonedKeptAsText() ? parseStoredZonedDateTimeText(value, type) : parseZonedDateTimeText(value, type)
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid zonedDateTime value received from the db: ' + String(value))
            }
            return received
        }
        if (__isDurationClass(context.requestedType)) {
            // Its ISO text, the text of a PostgreSQL interval, an interval of oracledb or the number of its
            // microseconds, whatever the storage: a duration whose fields mix signs (PostgreSQL's `-1 days +02:03:00`)
            // can't be a Temporal.Duration
            const received = durationOfReceivedValue(value, type)
            if (!received) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'Invalid duration value received from the db: ' + String(value))
            }
            return received
        }
        if (__isAggregatedArrayClass(context.requestedType)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, 'This would not happened, something went wrong handling aggregate arrays coming from the database')
        }
        return value
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
    /**
     * The PlainDateTime of a plainDate, a plainTime or a plainDateTime received from the database: a text with all the
     * digits of its fraction of a second, the digits of the zone of the database when it has an offset (see
     * parsePlainDateTimeText), or a valid Date, from a driver that gives one, by its UTC getters; undefined for anything
     * else
     */
    private __receivedPlainDateTime(value: unknown, typeName: string): TemporalPlainDateTime | undefined {
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? undefined : plainDateTimeOfUtcDate(value, typeName)
        }
        if (typeof value === 'string') {
            return parsePlainDateTimeText(value, this.databaseTimeZone, typeName)
        }
        return undefined
    }
    /** Converts a value to send to the database as the requested type */
    protected transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown {
        const type = context.requestedType.type
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        if (__isBooleanClass(context.requestedType)) {
            if (typeof value === 'boolean') {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid boolean value to send to the db: ' + String(value))
        }
        if (__isIntClass(context.requestedType)) {
            if (typeof value === 'number') {
                if (!Number.isInteger(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid int value to send to the db: ' + String(value))
                }
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid int value to send to the db: ' + String(value))
        }
        if (__isBigintClass(context.requestedType)) {
            if (typeof value === 'bigint') {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid int value to send to the db: ' + String(value))
        }
        if (__isDoubleClass(context.requestedType)) {
            if (typeof value === 'number') {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid double value to send to the db: ' + String(value))
        }
        if (__isDnumDecimalClass(context.requestedType)) {
            // A dnum is sent as its text, with all its decimals (`[1250n, 2]` is `12.50`), as any exact decimal
            if (isDnumValue(value)) {
                return textOfDnum(value)
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid dnum decimal value to send to the db: ' + String(value))
        }
        if (__isExactDecimalClass(context.requestedType)) {
            // A decimal is sent as its text, with a point as the decimal separator and without an exponent, so every
            // database reads it with all its digits
            if (typeof value === 'string') {
                if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(value)) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid decimal value to send to the db: ' + String(value))
                }
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid decimal value to send to the db: ' + String(value))
        }
        if (__isStringClass(context.requestedType)) {
            if (typeof value === 'string') {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid string value to send to the db: ' + String(value))
        }
        if (__isUuidClass(context.requestedType)) {
            if (typeof value === 'string') {
                return this.__normalizeUuidText(value)
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid uuid value to send to the db: ' + String(value))
        }
        if (__isLocalDateClass(context.requestedType)) {
            if (value instanceof Date && !isNaN(value.getTime())) {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid localDate value to send to the db: ' + String(value))
        }
        if (__isLocalTimeClass(context.requestedType)) {
            if (value instanceof Date && !isNaN(value.getTime())) {
                if (this.isDatabaseOutsideUtc()) {
                    // With a databaseTimeZone other than UTC a localTime is the instant of a time on its own day, as it
                    // is read (on the dateToConvertTimesBetweenZones): that day gives the offset the database converts it with
                    return new Date(value.getTime())
                }
                // The time of a localTime is the one of its UTC getters, whatever the zone of the process, on
                // 1970-01-01 UTC: the day the value is read back on. Each query runner sends it in the form its
                // driver needs (a text, a TIME, a TIMESTAMP).
                return new Date(Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds()))
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid localTime value to send to the db: ' + String(value))
        }
        if (__isLocalDateTimeClass(context.requestedType)) {
            if (value instanceof Date && !isNaN(value.getTime())) {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid localDateTime value to send to the db: ' + String(value))
        }
        if (__isPlainDateClass(context.requestedType)) {
            // A Temporal value is sent as it is: each query runner gives its driver the form it needs
            if (value instanceof __temporal(type).PlainDate) {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid plainDate value to send to the db: ' + String(value))
        }
        if (__isPlainYearMonthClass(context.requestedType) || __isPlainMonthDayClass(context.requestedType)) {
            // Stored in the date of the day of a month of a year (dayOfStoredYearMonths), or of the year of a day of a
            // month (yearOfStoredMonthDays). A Temporal.PlainDate, which each query runner gives its driver as a date
            const temporal = __temporal(type)
            if (__isPlainYearMonthClass(context.requestedType) && value instanceof temporal.PlainYearMonth) {
                return value.toPlainDate({ day: dayOfStoredYearMonthsOf(this.dayOfStoredYearMonths) })
            }
            if (__isPlainMonthDayClass(context.requestedType) && value instanceof temporal.PlainMonthDay) {
                return value.toPlainDate({ year: yearOfStoredMonthDaysOf(this.yearOfStoredMonthDays) })
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid ' + type + ' value to send to the db: ' + String(value))
        }
        if (__isPlainTimeClass(context.requestedType)) {
            if (value instanceof __temporal(type).PlainTime) {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid plainTime value to send to the db: ' + String(value))
        }
        if (__isPlainDateTimeClass(context.requestedType)) {
            if (value instanceof __temporal(type).PlainDateTime) {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid plainDateTime value to send to the db: ' + String(value))
        }
        if (__isInstantClass(context.requestedType)) {
            if (value instanceof __temporal(type).Instant) {
                return value
            }
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid instant value to send to the db: ' + String(value))
        }
        if (__isZonedDateTimeClass(context.requestedType)) {
            if (!(value instanceof __temporal(type).ZonedDateTime)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid zonedDateTime value to send to the db: ' + String(value))
            }
            if (this.__sqlBuilder._zonedKeptAsText()) {
                return zonedDateTimeText(value)
            }
            if (!this.__sqlBuilder._supportZonedDateTimes()) {
                return this.__sqlBuilder._zonedDateTimeUnsupported()
            }
            return value
        }
        if (__isDurationClass(context.requestedType)) {
            if (!isDurationValue(value)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'Invalid duration value to send to the db: ' + String(value))
            }
            if (!this.isDurationKeptAsInterval(__durationSqlDataTypeOf(context.requestedSqlDataType, context.requestedType))) {
                return durationIsoText(value, this.durationFractionDigits())
            }
            // An interval of the database: each query runner gives its driver the form it needs
            return value
        }
        if (__isAggregatedArrayClass(context.requestedType)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, 'This would not happened, something went wrong handling aggregate arrays, aggregated arrays cannot be sent to the database')
        }
        return value
    }

    /**
     * The digits of the fraction of a second (0 to 9) a duration keeps where it is stored as its ISO 8601 text, the
     * storage the library emulates where the database has no type for it: the ones beyond are truncated, as Temporal's
     * `toString({ fractionalSecondDigits, roundingMode: 'trunc' })` does. All of them by default; fewer take less space,
     * like 3 for milliseconds. A duration a query computes keeps the digits of the database
     */
    protected getDurationFractionDigits(): number {
        return 9
    }

    /** The digits of getDurationFractionDigits, checked */
    private durationFractionDigits(): number {
        const digits = this.getDurationFractionDigits()
        if (!Number.isInteger(digits) || digits < 0 || digits > 9) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'getDurationFractionDigits', value: digits }, 'getDurationFractionDigits must give an integer from 0 to 9, not ' + String(digits))
        }
        return digits
    }

    protected transformPlaceholder(placeholder: string, _context: TypeAdapterPlaceholderContext): string {
        return placeholder
    }

    /**
     * The SQL of a value as it leaves the database, with the conversion of the library: the SQL it receives, unless the
     * connection of a database changes it (SQL Server writes a decimal of a column of the result as its text)
     */
    protected transformProjection(sql: string, _context: TypeAdapterProjectionContext): string {
        return sql
    }

    protected isReservedKeyword(word: string): boolean {
        return this.__sqlBuilder._isReservedKeyword(word)

    }
    protected forceAsIdentifier(identifier: string): string {
        return this.__sqlBuilder._forceAsIdentifier(identifier)
    }
    /**
     * The identifier written in the SQL: as it is when it is already quoted the way the database quotes one (a table or a
     * column declared `"plan"`, `` `plan` `` or `[plan]`); otherwise quoted when it is a reserved word or has a space, or,
     * when `strict`, when it isn't made only of letters, digits and underscores. `allowReservedKeyword` keeps a reserved word as it is: the name
     * of a function or a procedure called with executeFunction or executeProcedure, which quoted would no longer be the
     * built-in one of that name (SQL Server reads `[upper](@0)` as a function of the user without its schema)
     */
    protected escape(identifier: string, strict: boolean, allowReservedKeyword?: boolean): string {
        if (this.__sqlBuilder._isQuotedIdentifier(identifier)) {
            // Already quoted by the user, the way the database quotes one: written as it is
            return identifier
        }
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
