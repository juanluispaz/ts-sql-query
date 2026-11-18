// oracledb keeps each statement in its statement cache by its text, with the types of the binds and of the columns of
// the result of its first execution. The runner executes a statement with a comment of the types of its binds, so the
// same text executed again with binds of other types is another statement of the cache: a column that takes the type of
// its bind (a constant selected, a case of binds, a union of constants) reads each value with its own type, with the
// cache of oracledb left at its default.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { OracleDBQueryRunner } from '../../../src/queryRunners/OracleDBQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'

class DBConnection extends OracleConnection<'DBConnection'> { }

describe.skipIf(!isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'))('Oracle: the statement cache of oracledb, with binds of other types', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: import('oracledb').Connection | undefined
    const sent: string[] = []
    let conn: DBConnection
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        const oracledb = (await import('oracledb')).default
        // The statement cache of oracledb at its default size
        connection = await oracledb.getConnection({ user: db.user, password: db.password, connectString: db.connectString })
        // The text each statement is executed with
        const execute = connection.execute.bind(connection) as (...args: unknown[]) => Promise<unknown>
        const spied = new Proxy(connection, {
            get(target, property, receiver) {
                if (property === 'execute') {
                    return (sql: string, ...rest: unknown[]) => {
                        sent.push(sql)
                        return execute(sql, ...rest)
                    }
                }
                return Reflect.get(target, property, receiver)
            },
        })
        conn = new DBConnection(new OracleDBQueryRunner(spied))
    }, 300_000)
    afterAll(async () => {
        await connection?.close()
        await db?.release()
    }, 300_000)

    test('a-constant-selected-is-read-with-its-own-type-after-one-of-another-type', async () => {
        const one = await conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int')).executeSelectOne()
        const text = await conn.selectFromNoTable().selectOneColumn(conn.const('hi', 'string')).executeSelectOne()
        const two = await conn.selectFromNoTable().selectOneColumn(conn.const(2, 'int')).executeSelectOne()
        const nothing = await conn.selectFromNoTable().selectOneColumn(conn.optionalConst(null, 'int')).executeSelectNoneOrOne()
        const three = await conn.selectFromNoTable().selectOneColumn(conn.const(3, 'int')).executeSelectOne()
        expect([one, text, two, nothing, three]).toEqual([1, 'hi', 2, null, 3])
        expect(sent.slice(-5)).toEqual([
            'select :0 as "result" from dual /* binds: n */',
            'select :0 as "result" from dual /* binds: t */',
            'select :0 as "result" from dual /* binds: n */',
            'select :0 as "result" from dual /* binds: n */',
            'select :0 as "result" from dual /* binds: n */',
        ])
    })

    test('a-case-of-binds-and-a-union-of-constants-are-read-with-their-own-type', async () => {
        const caseOf = (value: number | string) => conn.selectFromNoTable()
            .selectOneColumn(conn.fragmentWithType('string', 'required').sql`case when 1 = 1 then ${conn.const(String(value), 'string')} end`)
            .executeSelectOne()
        expect(await caseOf(1)).toBe('1')
        const unionOf = (first: number, second: number) => conn.selectFromNoTable().select({ v: conn.const(first, 'int') })
            .unionAll(conn.selectFromNoTable().select({ v: conn.const(second, 'int') }))
            .executeSelectMany()
        expect(await unionOf(1, 2)).toEqual([{ v: 1 }, { v: 2 }])
        const textUnion = await conn.selectFromNoTable().select({ v: conn.const('a', 'string') })
            .unionAll(conn.selectFromNoTable().select({ v: conn.const('b', 'string') }))
            .executeSelectMany()
        expect(textUnion).toEqual([{ v: 'a' }, { v: 'b' }])
        expect(await unionOf(3, 4)).toEqual([{ v: 3 }, { v: 4 }])
    })

    test('a-statement-without-binds-has-no-comment-and-repeated-binds-are-counted', async () => {
        expect(await conn.selectFromNoTable().selectOneColumn(conn.fragmentWithType('int', 'required').sql`1`).executeSelectOne()).toBe(1)
        expect(sent.at(-1)).toBe('select 1 as "result" from dual')
        await conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int').equals(1)).executeSelectOne()
        await conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int').in([1, 2, 3, 4])).executeSelectOne()
        expect(sent.slice(-2)).toEqual([
            'select case when :0 = :1 then 1 else 0 end as "result" from dual /* binds: nn */',
            'select case when :0 in (:1, :2, :3, :4) then 1 else 0 end as "result" from dual /* binds: n5 */',
        ])
    })
})
