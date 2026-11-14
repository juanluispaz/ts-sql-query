import { AbstractQueryRunner } from './AbstractQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, ExecutableQueryType, RollbackOpts } from './QueryRunner.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { TransactionOutcome } from '../utils/transactionOutcome.js'
import { existingQueryContextOf } from '../internal/QueryContextImpl.js'

/**
 * The base of a query runner over one connection of a driver. It executes each type of query with three primitives a
 * subclass gives (executeQueryReturning, the rows of a query; executeMutation, the number of rows a statement changed;
 * and, when the driver reads it apart, executeInsertReturningLastInsertedId), and gives the result the shape its type
 * asks for. It counts the transactions begun, and watches the ones the database rolls back by itself.
 *
 * A subclass begins, commits and rolls back a transaction in doBeginTransaction, doCommit and doRollback:
 * `SqlTransactionQueryRunner` with SQL, `DelegatedSetTransactionQueryRunner` with the methods of the driver.
 */
export abstract class ManagedTransactionQueryRunner extends AbstractQueryRunner {
    /** Whether the database rolled the current transaction back by itself */
    protected readonly transactionOutcome: TransactionOutcome = new TransactionOutcome()
    private transactionLevel = 0

    executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any> {
        switch (queryType) {
            case 'selectOneRow':
                return this.executeQueryReturning(query, params).then(oneRowOf)
            case 'selectManyRows':
                return this.executeQueryReturning(query, params)
            case 'selectOneColumnOneRow':
            case 'executeFunction':
                return this.executeQueryReturning(query, params).then(oneColumnOfOneRowOf)
            case 'selectOneColumnManyRows':
                return this.executeQueryReturning(query, params).then(oneColumnOfEachRowOf)
            case 'insert':
            case 'update':
            case 'delete':
                return this.executeMutation(query, params)
            case 'insertReturningLastInsertedId':
                return this.executeInsertReturningLastInsertedId(query, params)
            case 'insertReturningOneRow':
            case 'updateReturningOneRow':
            case 'deleteReturningOneRow':
                return this.executeMutationReturning(query, params).then(oneRowOf)
            case 'insertReturningManyRows':
            case 'updateReturningManyRows':
            case 'deleteReturningManyRows':
                return this.executeMutationReturning(query, params)
            case 'insertReturningOneColumnOneRow':
            case 'updateReturningOneColumnOneRow':
            case 'deleteReturningOneColumnOneRow':
                return this.executeMutationReturning(query, params).then(oneColumnOfOneRowOf)
            case 'insertReturningMultipleLastInsertedId':
            case 'insertReturningOneColumnManyRows':
            case 'updateReturningOneColumnManyRows':
            case 'deleteReturningOneColumnManyRows':
                return this.executeMutationReturning(query, params).then(oneColumnOfEachRowOf)
            case 'executeProcedure':
                return this.executeProcedure(query, params)
            case 'executeDatabaseSchemaModification':
                return this.executeDatabaseSchemaModification(query, params)
            case 'executeConnectionConfiguration':
                return this.executeMutation(query, params).then(nothing)
            default:
                return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'Unknown type of query: ' + queryType))
        }
    }

    /** The rows a query gives */
    protected abstract executeQueryReturning(query: string, params: any[]): Promise<any[]>
    /** The number of rows a statement changed */
    protected abstract executeMutation(query: string, params: any[]): Promise<number>
    /**
     * The rows the returning of a statement gives. An outermost returning that collapsed to nothing (an empty
     * `returning({})`) leaves the SQL without the clause: it runs as a plain statement and gives no rows, because the
     * path that reads rows fails on a statement without data on some drivers (better-sqlite3), and gives the header
     * of the result instead of rows on others (mysql2, mariadb).
     */
    protected executeMutationReturning(query: string, params: any[]): Promise<any[]> {
        if (existingQueryContextOf(params)?.containsMutationReturningClause === false) {
            return this.executeMutation(query, params).then(noRows)
        }
        return this.executeQueryReturning(query, params)
    }
    /** The id an insert generated: by default the only column of the row its returning gives */
    protected executeInsertReturningLastInsertedId(query: string, params: any[]): Promise<any> {
        return this.executeMutationReturning(query, params).then(oneColumnOfOneRowOf)
    }
    /** Executes the call of a procedure */
    protected executeProcedure(query: string, params: any[]): Promise<void> {
        return this.executeMutation(query, params).then(nothing)
    }
    /** Executes a statement that changes the schema of the database */
    protected executeDatabaseSchemaModification(query: string, params: any[]): Promise<void> {
        return this.executeMutation(query, params).then(nothing)
    }
    /**
     * Whether the insert has a returning clause the library wrote, as the context of the query says; for SQL without
     * context (written by hand and run through the query runner), whether its text has one
     */
    protected containsInsertReturningClause(query: string, params: any[]): boolean {
        const containsInsertReturningClause = existingQueryContextOf(params)?.containsInsertReturningClause
        if (containsInsertReturningClause === true) {
            return true
        } else if (containsInsertReturningClause === false) {
            return false
        } else {
            return /\sreturning\s/.test(query)
        }
    }
    /**
     * The number of rows a statement changed when the driver can't tell it (Oracle's insert of several rows, a block
     * of PL/SQL), as the SQL builder recorded it; undefined when the driver's own count is the one
     */
    protected getForcedAffectedRowCount(params: any[]): number | undefined {
        return existingQueryContextOf(params)?.forcedAffectedRowCount
    }

    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        const transactionLevel = this.transactionLevel
        if (!this.nestedTransactionsSupported && this.isTransactionActive()) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }
        let begun
        try {
            // An isolation level or an access mode the database doesn't offer throws here, before anything is sent
            begun = this.doBeginTransaction(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        return begun.then(() => {
            this.transactionLevel++
            if (this.transactionLevel !== transactionLevel + 1) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
        })
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        if (!this.isTransactionActive() && this.validateInTransaction()) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot commit the transaction'))
        }
        if (this.transactionOutcome.isRolledBackByTheDatabase()) {
            return this.createRejectedPromise(this.transactionOutcome.rolledBackError())
        }
        return this.doCommit(opts).then(() => {
            // Only a commit that worked ends the transaction: after an error it is still open
            this.transactionOutcome.transactionEnded()
            this.transactionEnded()
        })
    }
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        if (!this.isTransactionActive() && this.validateInTransaction()) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot rollback the transaction'))
        }
        if (this.transactionOutcome.rollbackAlreadyDone()) {
            this.rollbackAlreadyDoneByTheDatabase()
            this.transactionEnded()
            return this.createResolvedPromise(undefined)
        }
        return this.doRollback(opts).then(() => {
            this.transactionEnded()
        }, (error) => {
            // A rollback that failed ends the transaction too: nothing else can be done with it
            this.transactionEnded()
            throw error
        })
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    private transactionEnded(): void {
        this.transactionLevel--
        if (this.transactionLevel < 0) {
            this.transactionLevel = 0
        }
    }

    /** Begins the transaction in the database; it throws, before sending anything, for an option it doesn't offer */
    protected abstract doBeginTransaction(opts: BeginTransactionOpts): Promise<void>
    /** Commits the transaction in the database */
    protected abstract doCommit(opts: CommitOpts): Promise<void>
    /** Rolls the transaction back in the database */
    protected abstract doRollback(opts: RollbackOpts): Promise<void>
    /**
     * Whether a commit or a rollback outside a transaction is rejected with `NOT_IN_TRANSACTION`; Oracle runs every
     * statement in a transaction, so it can commit without one begun
     */
    protected validateInTransaction(): boolean {
        return true
    }
    /** The rollback of a transaction the database already rolled back: nothing is sent, the transaction ends */
    protected rollbackAlreadyDoneByTheDatabase(): void {
    }

    /** Rejects a transaction that begins on a query runner created for a transaction something else manages */
    protected rejectBeginInsideAManagedTransaction(): Promise<never> {
        return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.constructor.name + ' runs in a transaction that something else manages: a transaction cannot begin on it'))
    }

    /**
     * Whether the database still has the transaction open, after the statement of the transaction that failed with
     * the error given; undefined when the query runner can't tell. Some errors make the database roll the whole
     * transaction back by itself (a deadlock, a conflict clause that rolls back): the statements that follow would run
     * outside any transaction, each one committed at once. It is answered with what the driver already gives (the
     * error, a flag of the connection), never with a query of its own: the library sends only the queries asked for.
     */
    protected isTransactionOpenInTheDatabase(_error: unknown): boolean | undefined {
        return undefined
    }
    /** Rejects a statement of a transaction the database already rolled back, before it is sent */
    protected rejectWhenRolledBackByTheDatabase(): Promise<never> | undefined {
        if (this.isTransactionActive() && this.transactionOutcome.isRolledBackByTheDatabase()) {
            return this.createRejectedPromise(this.transactionOutcome.rolledBackError())
        }
        return undefined
    }
    /** A statement failed: inside a transaction, it checks whether the database rolled the transaction back with it */
    protected statementOfTheTransactionFailed<T>(error: unknown): Promise<T> {
        if (this.isTransactionActive()) {
            this.transactionOutcome.statementFailed(error, true)
            let open
            try {
                open = this.isTransactionOpenInTheDatabase(error)
            } catch {
                open = undefined
            }
            if (open === false) {
                this.transactionOutcome.rolledBackByTheDatabase(error)
            }
        }
        return this.createRejectedPromise(error)
    }
}

/** The only row of the rows, or undefined without one; MORE_THAN_ONE_ROW with more */
function oneRowOf(rows: any[]): any {
    if (rows.length > 1) {
        throw new TsSqlProcessingError({ reason: 'MORE_THAN_ONE_ROW', count: rows.length }, 'Too many rows, expected only zero or one row')
    }
    return rows[0]
}

/** The value of the only column of the only row, whatever its name, or undefined without a row */
function oneColumnOfOneRowOf(rows: any[]): any {
    const row = oneRowOf(rows)
    if (!row) {
        return undefined
    }
    const columns = Object.getOwnPropertyNames(row)
    if (columns.length > 1) {
        throw new TsSqlProcessingError({ reason: 'ONLY_ONE_COLUMN_EXPECTED' }, 'Too many columns, expected only one column')
    }
    return row[columns[0]!]
}

/** The value of the only column of each row, whatever its name */
function oneColumnOfEachRowOf(rows: any[]): any[] {
    const length = rows.length
    const output = new Array(length)
    for (let i = 0; i < length; i++) {
        const row = rows[i]
        const columns = Object.getOwnPropertyNames(row)
        if (columns.length > 1) {
            throw new TsSqlProcessingError({ reason: 'ONLY_ONE_COLUMN_EXPECTED' }, 'Too many columns, expected only one column')
        }
        output[i] = row[columns[0]!]
    }
    return output
}

/**
 * Gives no rows: the result of a returning without columns, passed to `then` without creating a function on each call
 */
function noRows(): any[] {
    return []
}

/**
 * Gives undefined: the result of a statement that gives nothing, passed to `then` without creating a function on each
 * call
 */
function nothing(): undefined {
    return undefined
}
