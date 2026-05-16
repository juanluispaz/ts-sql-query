import type { BeginTransactionOpts, CommitOpts, QueryRunner, QueryType, RollbackOpts } from './QueryRunner.js'
import { ChainedQueryRunner } from './ChainedQueryRunner.js'

export abstract class InterceptorQueryRunner<PLAYLOAD_TYPE, T extends QueryRunner = QueryRunner> extends ChainedQueryRunner<T> {
    constructor(queryRunner: T) {
        super(queryRunner)
    }

    abstract onQuery(queryType: QueryType, query: string, params: any[]): PLAYLOAD_TYPE
    abstract onQueryResult(queryType: QueryType, query: string, params: any[], result: any, playload: PLAYLOAD_TYPE): void
    abstract onQueryError(queryType: QueryType, query: string, params: any[], error: any, playload: PLAYLOAD_TYPE): void

    override executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('selectOneRow', query, params)
        return this.queryRunner.executeSelectOneRow(query, params).then(r => {
            this.onQueryResult('selectOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('selectOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('selectManyRows', query, params)
        return this.queryRunner.executeSelectManyRows(query, params).then(r => {
            this.onQueryResult('selectManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('selectManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('selectOneColumnOneRow', query, params)
        return this.queryRunner.executeSelectOneColumnOneRow(query, params).then(r => {
            this.onQueryResult('selectOneColumnOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('selectOneColumnOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('selectOneColumnManyRows', query, params)
        return this.queryRunner.executeSelectOneColumnManyRows(query, params).then(r => {
            this.onQueryResult('selectOneColumnManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('selectOneColumnManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeInsert(query: string, params: any[] = []): Promise<number> {
        const playload = this.onQuery('insert', query, params)
        return this.queryRunner.executeInsert(query, params).then(r => {
            this.onQueryResult('insert', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('insert', query, params, e, playload)
            throw e
        })
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('insertReturningLastInsertedId', query, params)
        return this.queryRunner.executeInsertReturningLastInsertedId(query, params).then(r => {
            this.onQueryResult('insertReturningLastInsertedId', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('insertReturningLastInsertedId', query, params, e, playload)
            throw e
        })
    }
    override executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('insertReturningMultipleLastInsertedId', query, params)
        return this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params).then(r => {
            this.onQueryResult('insertReturningMultipleLastInsertedId', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('insertReturningMultipleLastInsertedId', query, params, e, playload)
            throw e
        })
    }
    override executeInsertReturningOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('insertReturningOneRow', query, params)
        return this.queryRunner.executeInsertReturningOneRow(query, params).then(r => {
            this.onQueryResult('insertReturningOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('insertReturningOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeInsertReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('insertReturningManyRows', query, params)
        return this.queryRunner.executeInsertReturningManyRows(query, params).then(r => {
            this.onQueryResult('insertReturningManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('insertReturningManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeInsertReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('insertReturningOneColumnOneRow', query, params)
        return this.queryRunner.executeInsertReturningOneColumnOneRow(query, params).then(r => {
            this.onQueryResult('insertReturningOneColumnOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('insertReturningOneColumnOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeInsertReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('insertReturningOneColumnManyRows', query, params)
        return this.queryRunner.executeInsertReturningOneColumnManyRows(query, params).then(r => {
            this.onQueryResult('insertReturningOneColumnManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('insertReturningOneColumnManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeUpdate(query: string, params: any[] = []): Promise<number> {
        const playload = this.onQuery('update', query, params)
        return this.queryRunner.executeUpdate(query, params).then(r => {
            this.onQueryResult('update', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('update', query, params, e, playload)
            throw e
        })
    }
    override executeUpdateReturningOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('updateReturningOneRow', query, params)
        return this.queryRunner.executeUpdateReturningOneRow(query, params).then(r => {
            this.onQueryResult('updateReturningOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('updateReturningOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeUpdateReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('updateReturningManyRows', query, params)
        return this.queryRunner.executeUpdateReturningManyRows(query, params).then(r => {
            this.onQueryResult('updateReturningManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('updateReturningManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeUpdateReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('updateReturningOneColumnOneRow', query, params)
        return this.queryRunner.executeUpdateReturningOneColumnOneRow(query, params).then(r => {
            this.onQueryResult('updateReturningOneColumnOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('updateReturningOneColumnOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeUpdateReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('updateReturningOneColumnManyRows', query, params)
        return this.queryRunner.executeUpdateReturningOneColumnManyRows(query, params).then(r => {
            this.onQueryResult('updateReturningOneColumnManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('updateReturningOneColumnManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeDelete(query: string, params: any[] = []): Promise<number> {
        const playload = this.onQuery('delete', query, params)
        return this.queryRunner.executeDelete(query, params).then(r => {
            this.onQueryResult('delete', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('delete', query, params, e, playload)
            throw e
        })
    }
    override executeDeleteReturningOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('deleteReturningOneRow', query, params)
        return this.queryRunner.executeDeleteReturningOneRow(query, params).then(r => {
            this.onQueryResult('deleteReturningOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('deleteReturningOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeDeleteReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('deleteReturningManyRows', query, params)
        return this.queryRunner.executeDeleteReturningManyRows(query, params).then(r => {
            this.onQueryResult('deleteReturningManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('deleteReturningManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeDeleteReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('deleteReturningOneColumnOneRow', query, params)
        return this.queryRunner.executeDeleteReturningOneColumnOneRow(query, params).then(r => {
            this.onQueryResult('deleteReturningOneColumnOneRow', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('deleteReturningOneColumnOneRow', query, params, e, playload)
            throw e
        })
    }
    override executeDeleteReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const playload = this.onQuery('deleteReturningOneColumnManyRows', query, params)
        return this.queryRunner.executeDeleteReturningOneColumnManyRows(query, params).then(r => {
            this.onQueryResult('deleteReturningOneColumnManyRows', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('deleteReturningOneColumnManyRows', query, params, e, playload)
            throw e
        })
    }
    override executeProcedure(query: string, params: any[] = []): Promise<void> {
        const playload = this.onQuery('executeProcedure', query, params)
        return this.queryRunner.executeProcedure(query, params).then(r => {
            this.onQueryResult('executeProcedure', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('executeProcedure', query, params, e, playload)
            throw e
        })
    }
    override executeFunction(query: string, params: any[] = []): Promise<any> {
        const playload = this.onQuery('executeFunction', query, params)
        return this.queryRunner.executeFunction(query, params).then(r => {
            this.onQueryResult('executeFunction', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('executeFunction', query, params, e, playload)
            throw e
        })
    }
    override executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (!this.queryRunner.lowLevelTransactionManagementSupported()) {
            // Emulate beginTransaction, commit and rollback to see in logs
            return this.queryRunner.executeInTransaction(() => {
                const query: string = ''
                const params: any[] = opts || []
                const playload = this.onQuery('beginTransaction', query, params)
                this.onQueryResult('beginTransaction', query, params, undefined, playload)
                return fn()
            }, outermostQueryRunner, opts).then((r) => {
                try {
                    const query: string = ''
                    const params: any[] = opts || []
                    const playload = this.onQuery('commit', query, params)
                    this.onQueryResult('commit', query, params, r, playload)
                } catch {
                    // Keep same behaviour of the transaction
                }
                return r
            }, (e) => {
                try {
                    const query: string = ''
                    const params: any[] = opts || []
                    const playload = this.onQuery('rollback', query, params)
                    this.onQueryResult('rollback', query, params, undefined, playload)
                } catch {
                    // Throw the innermost error
                }
                throw e
            })
        }
        return this.queryRunner.executeInTransaction(fn, outermostQueryRunner, opts)
    }
    override executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        const query: string = ''
        const params: any[] = opts
        const playload = this.onQuery('beginTransaction', query, params)
        return this.queryRunner.executeBeginTransaction(opts).then(r => {
            this.onQueryResult('beginTransaction', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('beginTransaction', query, params, e, playload)
            throw e
        })
    }
    override executeCommit(opts: CommitOpts = []): Promise<void> {
        const query: string = ''
        const params: any[] = opts
        const playload = this.onQuery('commit', query, params)
        return this.queryRunner.executeCommit(opts).then(r => {
            this.onQueryResult('commit', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('commit', query, params, e, playload)
            throw e
        })
    }
    override executeRollback(opts: RollbackOpts = []): Promise<void> {
        const query: string = ''
        const params: any[] = opts
        const playload = this.onQuery('rollback', query, params)
        return this.queryRunner.executeRollback(opts).then(r => {
            this.onQueryResult('rollback', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('rollback', query, params, e, playload)
            throw e
        })
    }
    override executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        const playload = this.onQuery('executeDatabaseSchemaModification', query, params)
        return this.queryRunner.executeDatabaseSchemaModification(query, params).then(r => {
            this.onQueryResult('executeDatabaseSchemaModification', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('executeDatabaseSchemaModification', query, params, e, playload)
            throw e
        })
    }
    override executeConnectionConfiguration(query: string, params: any[] = []): Promise<void> {
        const playload = this.onQuery('executeConnectionConfiguration', query, params)
        return this.queryRunner.executeConnectionConfiguration(query, params).then(r => {
            this.onQueryResult('executeConnectionConfiguration', query, params, r, playload)
            return r
        }, e => {
            this.onQueryError('executeConnectionConfiguration', query, params, e, playload)
            throw e
        })
    }
}