import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, QueryOptions } from 'mariadb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getMariaDbErrorReason, isMariaDbError } from './connectorErrorMappers/MariaDBErrorMapper.js'
import { isTransactionOpenAfterMySqlMariaDBError } from '../utils/mySqlMariaDB/mySqlMariaDBTransactionRollback.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { mySqlMariaDBDriverParams } from '../utils/mySqlMariaDB/mySqlMariaDBParamTypes.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/**
 * The options the mariadb connector is given with every query of the library, which replace the ones of the
 * connection, so the values are received as the library reads them whatever the connection was configured with:
 * - `dateStrings`: a DATE, a DATETIME and a TIMESTAMP as their text, which the library reads as UTC (the connector
 *   builds a Date from the zone of the process or of `timezone`), with the microseconds;
 * - `supportBigNumbers: false`, `bigIntAsNumber: false`, `decimalAsNumber: false` and `insertIdAsNumber: false`: a
 *   BIGINT and the id of an inserted row as a bigint, and a DECIMAL as its text, all exact (with supportBigNumbers the
 *   connector gives a BIGINT and the id as text, exact too, but a bigint is what the library always received; without
 *   it bigNumberStrings has no effect);
 * - `rowsAsArray: false`, `metaAsArray: false`, `nestTables: false`: the rows as objects with a key per column,
 *   the library reads each column by its name;
 * - `typeCast: undefined`: no function of the user changes the values (the connector skips a typeCast that is not
 *   set, and its typing doesn't admit undefined).
 */
const mariaDBQueryOptions = {
    dateStrings: true,
    supportBigNumbers: false,
    bigIntAsNumber: false,
    decimalAsNumber: false,
    insertIdAsNumber: false,
    rowsAsArray: false,
    metaAsArray: false,
    nestTables: false,
    typeCast: undefined,
} as unknown as Omit<QueryOptions, 'sql'>

/** What mariadb gives for a statement without rows: the number of rows changed and the id it generated */
type UpsertResult = {
    affectedRows: number
    insertId: number | bigint
}


/** The options of MariaDBQueryRunner */
export interface MariaDBQueryRunnerConfig {
    /** The database: 'mariaDB' by default; the connection sets its own when it receives the query runner */
    database?: 'mariaDB' | 'mySql' | undefined
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

/**
 * The query runner of MariaDB and MySQL through the driver `mariadb`, over a `Connection`.
 */
export class MariaDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    private currentDatabase: DatabaseType
    /** The `Connection` of mariadb the query runner was created with */
    readonly connection: Connection

    private config: MariaDBQueryRunnerConfig

    constructor(connection: Connection, config: MariaDBQueryRunnerConfig = {}) {
        super()
        this.connection = connection
        this.config = config
        this.currentDatabase = config.database || 'mariaDB'
    }

    /** The database the SQL is written for: MySQL or MariaDB, the one of the connection */
    get database(): DatabaseType {
        return this.currentDatabase
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
        } else {
            this.currentDatabase = database
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
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query({ ...mariaDBQueryOptions, sql: query }, mySqlMariaDBDriverParams(params)).catch((error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query({ ...mariaDBQueryOptions, sql: query }, mySqlMariaDBDriverParams(params)).then((result: UpsertResult) => result.affectedRows, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected override executeInsertReturningLastInsertedId(query: string, params: any[]): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        // A suppressed `insert ignore` inserts no row and reports insert id 0: fall back to null (the same absence
        // the RETURNING path reports) when nothing was inserted.
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query({ ...mariaDBQueryOptions, sql: query }, mySqlMariaDBDriverParams(params)).then((result: UpsertResult) => result.affectedRows === 0 ? null : result.insertId, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected override isTransactionOpenInTheDatabase(error: unknown): boolean | undefined {
        return isTransactionOpenAfterMySqlMariaDBError(this.getErrorReason(error))
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    protected beginTransactionInTheDriver(_opts: BeginTransactionOpts): Promise<void> {
        return this.connection.beginTransaction()
    }
    protected doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    protected doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.MariaDBQueryRunner(params, value, type)
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
