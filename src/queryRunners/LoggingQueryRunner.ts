import type { QueryRunner } from "./QueryRunner"
import { ChainedQueryRunner } from "./ChainedQueryRunner"
import type { UnwrapPromiseTuple } from "../utils/PromiseProvider";

export type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' |
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' |
    'insertReturningOneRow' | 'insertReturningManyRows' | 'insertReturningOneColumnOneRow' | 'insertReturningOneColumnManyRows' |
    'update' | 'updateReturningOneRow' | 'updateReturningManyRows' | 'updateReturningOneColumnOneRow' | 'updateReturningOneColumnManyRows' |
    'delete' | 'deleteReturningOneRow' | 'deleteReturningManyRows' | 'deleteReturningOneColumnOneRow' | 'deleteReturningOneColumnManyRows' |
    'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' | 'executeDatabaseSchemaModification' |
    'executeConnectionConfiguration'

export interface QueryLogger {
    onQuery?: (queryType: QueryType, query: string, params: any[], timestamps: { startedAt: bigint }) => void;
    onQueryResult?: (queryType: QueryType, query: string, params: any[], result: any, timestamps: { startedAt: bigint, endedAt: bigint }) => void;
    onQueryError?: (queryType: QueryType, query: string, params: any[], error: any, timestamps: { startedAt: bigint, endedAt: bigint }) => void;
}

export class LoggingQueryRunner<T extends QueryRunner> extends ChainedQueryRunner<T> {
    readonly logger: QueryLogger

    constructor(logger: QueryLogger, queryRunner: T) {
        super(queryRunner)
        this.logger = logger
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('selectOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeSelectOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('selectManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeSelectManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('selectOneColumnOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeSelectOneColumnOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectOneColumnOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectOneColumnOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('selectOneColumnManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeSelectOneColumnManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectOneColumnManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectOneColumnManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('insert', query, params, { startedAt })
        }
        let result = this.queryRunner.executeInsert(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insert', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insert', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('insertReturningLastInsertedId', query, params, { startedAt })
        }
        let result = this.queryRunner.executeInsertReturningLastInsertedId(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningLastInsertedId', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningLastInsertedId', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('insertReturningMultipleLastInsertedId', query, params, { startedAt })
        }
        let result = this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningMultipleLastInsertedId', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningMultipleLastInsertedId', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('insertReturningOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeInsertReturningOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('insertReturningManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeInsertReturningManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('insertReturningOneColumnOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeInsertReturningOneColumnOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningOneColumnOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningOneColumnOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('insertReturningOneColumnManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeInsertReturningOneColumnManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningOneColumnManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningOneColumnManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('update', query, params, { startedAt })
        }
        let result = this.queryRunner.executeUpdate(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('update', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('update', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeUpdateReturningOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('updateReturningOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeUpdateReturningOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('updateReturningOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('updateReturningOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeUpdateReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('updateReturningManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeUpdateReturningManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('updateReturningManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('updateReturningManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeUpdateReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('updateReturningOneColumnOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeUpdateReturningOneColumnOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('updateReturningOneColumnOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('updateReturningOneColumnOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeUpdateReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('updateReturningOneColumnManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeUpdateReturningOneColumnManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('updateReturningOneColumnManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('updateReturningOneColumnManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('delete', query, params, { startedAt })
        }
        let result = this.queryRunner.executeDelete(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('delete', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('delete', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeDeleteReturningOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('deleteReturningOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeDeleteReturningOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('deleteReturningOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('deleteReturningOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeDeleteReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('deleteReturningManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeDeleteReturningManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('deleteReturningManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('deleteReturningManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeDeleteReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('deleteReturningOneColumnOneRow', query, params, { startedAt })
        }
        let result = this.queryRunner.executeDeleteReturningOneColumnOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('deleteReturningOneColumnOneRow', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('deleteReturningOneColumnOneRow', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeDeleteReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('deleteReturningOneColumnManyRows', query, params, { startedAt })
        }
        let result = this.queryRunner.executeDeleteReturningOneColumnManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('deleteReturningOneColumnManyRows', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('deleteReturningOneColumnManyRows', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('executeProcedure', query, params, { startedAt })
        }
        let result = this.queryRunner.executeProcedure(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('executeProcedure', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('executeProcedure', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('executeFunction', query, params, { startedAt })
        }
        let result = this.queryRunner.executeFunction(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('executeFunction', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('executeFunction', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any> {
        if (!this.queryRunner.lowLevelTransactionManagementSupported()) {
            // Emulate beginTransaction, commit and rollback to see in logs
            return this.queryRunner.executeInTransaction(() => {
                const query: string = ''
                const params: any[] = []
                const logger = this.logger
                if (logger.onQuery) {
                    logger.onQuery('beginTransaction', query, params, { startedAt: 0n })
                }
                if (logger.onQueryResult) {
                    logger.onQueryResult('beginTransaction', query, params, undefined, { startedAt: 0n, endedAt: 0n })
                }
                return fn()
            }, outermostQueryRunner).then((r) => {
                try {
                    const query: string = ''
                    const params: any[] = []
                    const logger = this.logger
                    if (logger.onQuery) {
                        logger.onQuery('commit', query, params, { startedAt: 0n })
                    }
                    if (logger.onQueryResult) {
                        logger.onQueryResult('commit', query, params, undefined, { startedAt: 0n, endedAt: 0n })
                    }
                } catch {
                    // Keep same behaviour of the transaction
                }
                return r
            }, (e) => {
                try {
                    const query: string = ''
                    const params: any[] = []
                    const logger = this.logger
                    const startedAt = process.hrtime.bigint()
                    if (logger.onQuery) {
                        logger.onQuery('rollback', query, params, { startedAt })
                    }
                    if (logger.onQueryResult) {
                        logger.onQueryResult('rollback', query, params, undefined, { startedAt, endedAt: process.hrtime.bigint() })
                    }
                } catch {
                    // Throw the innermost error
                }
                throw e
            })
        }
        return this.queryRunner.executeInTransaction(fn, outermostQueryRunner)
    }
    executeBeginTransaction(): Promise<void> {
        const query: string = ''
        const params: any[] = []
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('beginTransaction', query, params, { startedAt })
        }
        let result = this.queryRunner.executeBeginTransaction()
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('beginTransaction', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('beginTransaction', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeCommit(): Promise<void> {
        const query: string = ''
        const params: any[] = []
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('commit', query, params, { startedAt })
        }
        let result = this.queryRunner.executeCommit()
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('commit', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('commit', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeRollback(): Promise<void> {
        const query: string = ''
        const params: any[] = []
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('rollback', query, params, { startedAt })
        }
        let result = this.queryRunner.executeRollback()
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('rollback', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('rollback', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('executeDatabaseSchemaModification', query, params, { startedAt })
        }
        let result = this.queryRunner.executeDatabaseSchemaModification(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('executeDatabaseSchemaModification', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('executeDatabaseSchemaModification', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
    executeConnectionConfiguration(query: string, params: any[] = []): Promise<void> {
        const logger = this.logger
        const startedAt = process.hrtime.bigint()
        if (logger.onQuery) {
            logger.onQuery('executeConnectionConfiguration', query, params, { startedAt })
        }
        let result = this.queryRunner.executeConnectionConfiguration(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result = result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('executeConnectionConfiguration', query, params, r, { startedAt, endedAt: process.hrtime.bigint() })
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('executeConnectionConfiguration', query, params, e, { startedAt, endedAt: process.hrtime.bigint() })
                }
                throw e
            })
        }
        return result
    }
}
