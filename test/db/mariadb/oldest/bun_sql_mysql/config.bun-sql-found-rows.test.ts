// `BunSqlMySqlQueryRunner` refuses a Bun SQL connection that was not created
// with `foundRows: true`: without it an UPDATE counts only the rows whose values
// changed, so `executeUpdate()` (and its min / max checks) would report fewer
// rows than the update matched.
//
// The check runs in the runner's constructor and only reads the connection's
// options — `new SQL(...)` opens no socket — so no database is needed. Bun SQL
// (`bun`) only loads under Bun; under node the tests are skipped.

import { describe, expect, test, TEST_RUNTIME } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

const onlyUnderBun = test.skipIf(TEST_RUNTIME !== 'bun')

async function constructionError(url: string, options: { foundRows?: boolean }): Promise<unknown> {
    const { SQL } = await import('bun')
    const { BunSqlMySqlQueryRunner } = await import('../../../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
    const sql = new SQL(url, options)
    try {
        new BunSqlMySqlQueryRunner(sql)
        return undefined
    } catch (error) {
        return error
    } finally {
        await sql.close()
    }
}

describe(ctx.label, () => {
    onlyUnderBun('found-rows: a connection without foundRows is rejected', async () => {
        const error = await constructionError('mysql://root:secret@127.0.0.1:3306/db', {})
        expect(error).toMatchObject({
            name: 'TsSqlProcessingError',
            errorReason: { reason: 'INVALID_CONFIGURATION', name: 'foundRows', value: false },
        })
    })

    onlyUnderBun('found-rows: a connection with foundRows: false is rejected', async () => {
        const error = await constructionError('mysql://root:secret@127.0.0.1:3306/db', { foundRows: false })
        expect(error).toMatchObject({
            name: 'TsSqlProcessingError',
            errorReason: { reason: 'INVALID_CONFIGURATION', name: 'foundRows', value: false },
        })
    })

    onlyUnderBun('found-rows: a connection with foundRows: true is accepted', async () => {
        const error = await constructionError('mysql://root:secret@127.0.0.1:3306/db', { foundRows: true })
        expect(error).toBeUndefined()
    })

    onlyUnderBun('found-rows: foundRows=true in the connection URL is accepted', async () => {
        const error = await constructionError('mysql://root:secret@127.0.0.1:3306/db?foundRows=true', {})
        expect(error).toBeUndefined()
    })
})
