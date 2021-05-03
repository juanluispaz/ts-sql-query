import type { QueryRunner } from "./QueryRunner"
import { ChainedQueryRunner } from "./ChainedQueryRunner"

export type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' | 'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' | 'update' | 'delete' | 'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' | 'executeDatabaseSchemaModification'

export interface QueryLogger {
    onQuery?: (queryType: QueryType, query: string, params: any[]) => void;
    onQueryResult?: (queryType: QueryType, query: string, params: any[], result: any) => void;
    onQueryError?: (queryType: QueryType, query: string, params: any[], error: any) => void;
}

export class LoggingQueryRunner<T extends QueryRunner> extends ChainedQueryRunner<T> {
    readonly logger: QueryLogger

    constructor(logger: QueryLogger, queryRunner: T) {
        super(queryRunner)
        this.logger = logger
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('selectOneRow', query, params)
        }
        let result = this.queryRunner.executeSelectOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectOneRow', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectOneRow', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('selectManyRows', query, params)
        }
        let result = this.queryRunner.executeSelectManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectManyRows', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectManyRows', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('selectOneColumnOneRow', query, params)
        }
        let result = this.queryRunner.executeSelectOneColumnOneRow(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectOneColumnOneRow', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectOneColumnOneRow', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('selectOneColumnManyRows', query, params)
        }
        let result = this.queryRunner.executeSelectOneColumnManyRows(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('selectOneColumnManyRows', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('selectOneColumnManyRows', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('insert', query, params)
        }
        let result = this.queryRunner.executeInsert(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insert', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insert', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('insertReturningLastInsertedId', query, params)
        }
        let result = this.queryRunner.executeInsertReturningLastInsertedId(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningLastInsertedId', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningLastInsertedId', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('insertReturningMultipleLastInsertedId', query, params)
        }
        let result = this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('insertReturningMultipleLastInsertedId', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('insertReturningMultipleLastInsertedId', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('update', query, params)
        }
        let result = this.queryRunner.executeUpdate(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('update', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('update', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('delete', query, params)
        }
        let result = this.queryRunner.executeDelete(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('delete', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('delete', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('executeProcedure', query, params)
        }
        let result = this.queryRunner.executeProcedure(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('executeProcedure', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('executeProcedure', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('executeFunction', query, params)
        }
        let result = this.queryRunner.executeFunction(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('executeFunction', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('executeFunction', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeBeginTransaction(): Promise<void> {
        const query: string = ''
        const params: any[] = []
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('beginTransaction', query, params)
        }
        let result = this.queryRunner.executeBeginTransaction()
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('beginTransaction', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('beginTransaction', query, params, e)
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
        if (logger.onQuery) {
            logger.onQuery('commit', query, params)
        }
        let result = this.queryRunner.executeCommit()
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('commit', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('commit', query, params, e)
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
        if (logger.onQuery) {
            logger.onQuery('rollback', query, params)
        }
        let result = this.queryRunner.executeRollback()
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('rollback', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('rollback', query, params, e)
                }
                throw e
            })
        }
        return result
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        const logger = this.logger
        if (logger.onQuery) {
            logger.onQuery('executeDatabaseSchemaModification', query, params)
        }
        let result = this.queryRunner.executeDatabaseSchemaModification(query, params)
        if (logger.onQueryResult || logger.onQueryError) {
            result.then(r => {
                if (logger.onQueryResult) {
                    logger.onQueryResult('executeDatabaseSchemaModification', query, params, r)
                }
                return r
            }, e => {
                if (logger.onQueryError) {
                    logger.onQueryError('executeDatabaseSchemaModification', query, params, e)
                }
                throw e
            })
        }
        return result
    }
}