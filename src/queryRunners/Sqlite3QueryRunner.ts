import type { DatabaseType } from './QueryRunner.js'
import type { Database } from 'sqlite3'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqlite3ErrorReason, isSqlite3Error } from './connectorErrorMappers/Sqlite3ErrorMapper.js'

/**
 * @deprecated The [sqlite3](https://www.npmjs.com/package/sqlite3) driver was deprecated by its
 * maintainers on 2025-12-11; consequently, `Sqlite3QueryRunner` is deprecated as well. Existing
 * code keeps working — runtime behavior is unchanged and the runner will continue to ship for
 * the time being — but new projects should pick another SQLite runner: `BetterSqlite3QueryRunner`
 * (fast synchronous driver, the default choice for Node), `NodeSqliteQueryRunner` (Node 22+'s
 * built-in `node:sqlite`, zero dependencies), `BunSqliteQueryRunner` (when running on Bun), or
 * `Sqlite3WasmOO1QueryRunner` (for environments without native bindings).
 */
export class Sqlite3QueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database

    constructor(connection: Database) {
        super()
        this.connection = connection
        this.database = 'sqlite'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. Sqlite3QueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): Database {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.all(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else {
                    resolve(rows)
                }
            })
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.changes)
                }
            })
        })
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.lastID)
                }
            })
        })
    }
    override executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningMultipleLastInsertedId(query, params)
        }
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, "Unsupported executeInsertReturningMultipleLastInsertedId on queries thar doesn't include the returning clause")
    }
    addParam(params: any[], value: any): string {
        if (typeof value === 'bigint') {
            // The deprecated sqlite3 driver cannot bind a JS BigInt: it ends up binding NULL instead.
            // As a best-effort fallback for this connector, coerce the BigInt to a number so the value
            // still reaches the database. This loses precision for integers outside JavaScript's safe
            // integer range (Number.MAX_SAFE_INTEGER); use another SQLite runner if you need full int64 fidelity.
            params.push(Number(value))
        } else {
            params.push(value)
        }
        return '?'
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return Sqlite3QueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return Sqlite3QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getSqlite3ErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isSqlite3Error(error)
    }
}
