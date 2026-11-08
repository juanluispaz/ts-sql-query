import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection } from 'mariadb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getMariaDbErrorReason, isMariaDbError } from './connectorErrorMappers/MariaDBErrorMapper.js'
import { isTransactionOpenAfterMySqlError } from '../utils/mySqlTransactionRollback.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

type UpsertResult = {
    affectedRows: number
    insertId: number | bigint
}


export interface MariaDBQueryRunnerConfig {
    database?: 'mariaDB' | 'mySql' | undefined
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

export class MariaDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    private config: MariaDBQueryRunnerConfig

    constructor(connection: Connection, databaseOrConfig: 'mariaDB' | 'mySql' | MariaDBQueryRunnerConfig = 'mariaDB') {
        super()
        this.connection = connection
        this.config = typeof databaseOrConfig === 'string' ? { database: databaseOrConfig } : databaseOrConfig
        this.database = this.config.database || 'mariaDB'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
        } else {
            // @ts-ignore
            this.database = database
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    getCurrentNativeConnection(): Connection | undefined {
        return this.isTransactionActive() ? this.connection : undefined
    }

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query({ sql: query, bigNumberStrings: true }, params).catch((error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows, (error) => this.statementOfTheTransactionFailed(error))
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        // A suppressed `insert ignore` inserts no row and reports insert id 0: fall back to null (the same absence
        // the RETURNING path reports) when nothing was inserted.
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows === 0 ? null : result.insertId, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected override isTransactionOpenInTheDatabase(error: unknown): boolean | undefined {
        return isTransactionOpenAfterMySqlError(this.getErrorReason(error))
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        return this.connection.beginTransaction()
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.MariaDBQueryRunner(params, value, type, typeCategory, forceTypeCast)
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return MariaDBQueryRunner.getErrorReason(error, this.database)
    }
    override isSqlError(error: unknown): boolean {
        return MariaDBQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getMariaDbErrorReason(error, database)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMariaDbError(error)
    }
}
