import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, DbType } from 'oracledb'
import oracleDb from 'oracledb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getOracleDBErrorReason, isOracleDBError } from './connectorErrorMappers/OracleDBErrorMapper.js'
import { getParamTypeCategoryAt } from '../utils/queryParamsMetadata.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'

export interface OracleDBQueryRunnerConfig {
    /** The connection is in a transaction that something else manages, and that something else ends: the statements don't commit, and none begins, commits or rolls back through this query runner */
    forUseInTransaction?: boolean | undefined
}

export class OracleDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection
    private config?: OracleDBQueryRunnerConfig | undefined

    constructor(connection: Connection, config?: OracleDBQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'oracle'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. OracleDBQueryRunner only supports oracle databases')
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
        return this.connection.execute(query, this.bindParams(params), {outFormat: oracleDb.OUT_FORMAT_OBJECT, autoCommit: this.autoCommit()}).then((result) => result.rows || [])
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.execute(query, this.bindParams(params), {autoCommit: this.autoCommit()}).then((result) => {
            // A multi-row INSERT is executed as an anonymous PL/SQL block, for
            // which Oracle doesn't populate rowsAffected; the SqlBuilder recorded
            // the affected-row count instead (see OracleSqlBuilder._buildInsertMultiple).
            const forced = this.getForcedAffectedRowCount(params)
            if (forced !== undefined) {
                return forced
            }
            return result.rowsAffected || 0
        })
    }
    protected override executeMutationReturning(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.execute(query, this.bindParams(this.resolveOutBindTypes(params)), {autoCommit: this.autoCommit()}).then((result) => {
            return this.processOutBinds(params, result.outBinds)
        })
    }
    /**
     * The params as oracledb binds them by name: the placeholders this runner emits are named after the index of their
     * value (`:0`, `:1`, …), and binding by name gives every occurrence of a placeholder the same value, so the same
     * placeholder can be repeated in the query (an array binds one value per occurrence, in the order of the text).
     */
    protected bindParams(params: any[]): Record<string, any> {
        const result: Record<string, any> = {}
        for (let i = 0, length = params.length; i < length; i++) {
            const value = params[i]
            if (value === null || value === undefined) {
                // oracledb binds a null without a type Oracle can use where nothing else gives it one: a row of a
                // union (ORA-01790) or a `case :0 when 1` (ORA-00932). A null of a number, a date or a time is bound
                // with its type.
                const type = this.oracleDbType(getParamTypeCategoryAt(params, i))
                if (type !== undefined) {
                    result[i] = { val: null, type: type }
                    continue
                }
            }
            result[i] = value
        }
        return result
    }
    // The oracledb DbType of a value of each category, the one oracledb gives the values the library sends: a number
    // or a bigint is a NUMBER, a boolean is sent as a number (see OracleConnection), and a Date is a TIMESTAMP, also
    // for a localDate and a localTime (Oracle has no TIME type). A text has no DbType here: it's how oracledb binds a
    // null.
    private oracleDbType(typeCategory: TypeCategory | undefined): DbType | undefined {
        switch (typeCategory) {
            case 'boolean':
            case 'int':
            case 'bigint':
            case 'customInt':
            case 'customBigint':
            case 'double':
            case 'customDouble':
                return oracleDb.DB_TYPE_NUMBER
            case 'localDate':
            case 'customLocalDate':
            case 'localTime':
            case 'customLocalTime':
            case 'localDateTime':
            case 'customLocalDateTime':
                return oracleDb.DB_TYPE_TIMESTAMP
            default:
                return undefined
        }
    }
    private resolveOutBindTypes(params: any[]): any[] {
        // Each RETURNING OUT bind keeps the category of the type of its column (addOutParam). Here,
        // only in the array handed to the driver, a temporal column's OUT bind is given its oracledb
        // DbType. The original array — used by processOutBinds and captured for the snapshot — is
        // left untouched; the copy is made lazily only when there is a type to resolve.
        let resolved: any[] | undefined = undefined
        for (let i = 0, length = params.length; i < length; i++) {
            const param = params[i]
            if (!param || typeof param !== 'object' || param.dir !== oracleDb.BIND_OUT) {
                continue
            }
            const dbType = this.oracleDbType(getParamTypeCategoryAt(params, i))
            if (dbType === undefined || dbType === oracleDb.DB_TYPE_NUMBER) {
                // Without a type, oracledb returns an OUT number as a string, with all its digits
                continue
            }
            if (!resolved) {
                resolved = params.slice()
            }
            resolved[i] = { ...param, type: dbType }
        }
        return resolved ?? params
    }
    /**
     * Oracle always runs statements inside a transaction, and oracledb doesn't commit it unless asked (its autoCommit
     * defaults to false): outside a transaction begun through ts-sql-query, each statement is committed, as on every
     * other database; inside one, only commit() does. With forUseInTransaction the commit belongs to what manages the
     * transaction.
     */
    private autoCommit(): boolean {
        return !this.isTransactionActive() && !this.config?.forUseInTransaction
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config?.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    override doSetTransaction(sql: string, _opts: BeginTransactionOpts): Promise<void> {
        // SET TRANSACTION opens the transaction it configures, so it must not be committed
        return this.connection.execute(sql, [], {autoCommit: false}).then(() => undefined)
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        // Oracle automatically begins the transaction, but the level must set in a query
        return  Promise.resolve()
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    override validateIntransaction(): boolean {
        // Do not validate if in transaction due automatic in transaction oracle's hehaviour, but with forUseInTransaction
        // the transaction of the connection is not this query runner's to commit or roll back
        return !!this.config?.forUseInTransaction
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory): string {
        setQueryParamType(params, params.length, type, typeCategory)
        const index = params.length
        params.push(value)
        return ':' + index
    }
    override addOutParam(params: any[], name: string, type: string, typeCategory: TypeCategory): string {
        setQueryParamType(params, params.length, type, typeCategory)
        const index = params.length
        if (name) {
            params.push({dir: oracleDb.BIND_OUT, as: name})
        } else {
            params.push({dir: oracleDb.BIND_OUT})
        }
        return ':' + index
    }
    processOutBinds(params: any[], outBinds: any): any[] {
        if (!outBinds) {
            return []
        }
        if (typeof outBinds !== 'object' || Array.isArray(outBinds)) {
            // Bound by name, oracledb returns the OUT binds as an object keyed by their name (the index of the param)
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid out binds returned', value: outBinds }, 'Invalid outBinds returned by the database')
        }

        const rows: any[][] = []
        let current: any[] = []
        rows.push(current)
        for (let i = 0, length = params.length; i < length; i++) {
            const param = params[i]
            if (!param || typeof param !== 'object' || param.dir !== oracleDb.BIND_OUT) {
                continue
            }
            const name: string = param.as || ''
            const value = outBinds[i]

            if (current.length > 0 && name in current[0]) {
                current = []
                rows.push(current)
            }

            if (!Array.isArray(value)) {
                if (current.length <= 0) {
                    current.push({})
                }
                current[0][name] = value
                continue
            }

            for (let j = current.length, length2 = value.length; j < length2; j++) {
                current[j] = {}
            }

            for (let j = 0, length2 = value.length; j < length2; j++) {
                current[j][name] = value[j]
            }
        }

        const result: any[] = []
        rows.forEach(value => {
            result.push(...value)
        })
        return result
    }

    override getErrorReason(error: unknown): TsSqlErrorReason {
        return OracleDBQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return OracleDBQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getOracleDBErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isOracleDBError(error)
    }
}
