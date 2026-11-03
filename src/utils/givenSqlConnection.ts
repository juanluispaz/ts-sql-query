/**
 * What the `sql` a postgres.js or Bun SQL query runner was created with is: the client of a pool, a connection the
 * caller reserved (it can be released), or a transaction the caller began (it can create savepoints)
 */
export type GivenSqlConnection = 'pool' | 'reserved' | 'transaction'

export function getGivenSqlConnection(sql: object): GivenSqlConnection {
    const candidate = sql as { savepoint?: unknown, release?: unknown }
    if (typeof candidate.savepoint === 'function') {
        return 'transaction'
    }
    if (typeof candidate.release === 'function') {
        return 'reserved'
    }
    return 'pool'
}
