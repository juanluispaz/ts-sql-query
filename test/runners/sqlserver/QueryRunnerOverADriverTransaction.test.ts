// MssqlPoolQueryRunner created with a transaction the caller began with mssql.

import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'
import { describeOverADriverTransaction } from '../lib/overADriverTransaction.js'

describeOverADriverTransaction({
    label: 'MssqlPoolQueryRunner (transaction of mssql)',
    realEnabled: isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const pool = await new db.mssql.ConnectionPool({ ...db.config, pool: { max: 2, min: 0 } }).connect()
        return {
            async begin(fn) {
                const transaction = pool.transaction()
                await transaction.begin()
                try {
                    const result = await fn(transaction)
                    await transaction.commit()
                    return result
                } catch (error) {
                    await transaction.rollback()
                    throw error
                }
            },
            run: sql => pool.request().query(sql),
            count: async () => Number((await pool.request().query('select count(*) as n from rt_given')).recordset[0].n),
            close: async () => { await pool.close(); await db.release() },
        }
    },
    createRunner: transaction => new MssqlPoolQueryRunner(transaction),
})
