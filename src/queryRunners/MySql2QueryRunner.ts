import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, QueryError, ResultSetHeader, RowDataPacket } from 'mysql2'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getMySql2ErrorReason, isMySql2Error } from './connectorErrorMappers/MySql2ErrorMapper.js'
import { isTransactionOpenAfterMySqlError } from '../utils/mySqlTransactionRollback.js'


export interface MySql2QueryRunnerConfig {
    database?: 'mariaDB' | 'mySql' | undefined
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

export class MySql2QueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    private config: MySql2QueryRunnerConfig

    constructor(connection: Connection, databaseOrConfig: 'mariaDB' | 'mySql' | MySql2QueryRunnerConfig = 'mySql') {
        super()
        this.connection = connection
        this.config = typeof databaseOrConfig === 'string' ? { database: databaseOrConfig } : databaseOrConfig
        this.database = this.config.database || 'mySql'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MySql2QueryRunner only supports mySql or mariaDB databases')
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
        return this.rejectWhenRolledBackByTheDatabase() || new Promise<any[]>((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: RowDataPacket[]) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results)
                }
            })
        }).catch((error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || new Promise<number>((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.affectedRows)
                }
            })
        }).catch((error) => this.statementOfTheTransactionFailed(error))
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return this.rejectWhenRolledBackByTheDatabase() || new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    // A suppressed `insert ignore` inserts no row and reports insert id 0: fall back to null (the
                    // same absence the RETURNING path reports) when nothing was inserted.
                    resolve(results.affectedRows === 0 ? null : results.insertId)
                }
            })
        }).catch((error) => this.statementOfTheTransactionFailed(error))
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
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.commit((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.rollback((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return MySql2QueryRunner.getErrorReason(error, this.database)
    }
    override isSqlError(error: unknown): boolean {
        return MySql2QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getMySql2ErrorReason(error, database)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMySql2Error(error)
    }
}
