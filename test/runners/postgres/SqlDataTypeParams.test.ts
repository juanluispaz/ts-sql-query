// A parameter where PostgreSQL needs its type (a constant selected on its own) gets the one of its SQL data type
// (withSqlDataType), without the arguments that would round or cut it (numeric(18, 4) is a numeric): a jsonb, an inet,
// an enum of the database, which the library doesn't know. pg and Bun SQL write it as a cast; postgres.js and PGlite
// send the parameter with its oid when the type has a fixed one, and otherwise as without a SQL data type.

import pg from 'pg'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { withSqlDataType } from '../../../src/TypeAdapter.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { CustomDecimalType, CustomEqualableType, EnumType, IntType, StringType } from '../../../src/exports/v2/index.js'

const isBun = typeof globalThis.Bun !== 'undefined'

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }

const payload = withSqlDataType({ family: 'document', format: 'jsonb' })
const address = withSqlDataType({ family: 'network address', kind: 'inet' })
const mood = withSqlDataType({ family: 'enumeration', name: 'rt_mood' })
const price = withSqlDataType({ family: 'exact numeric', precision: 18, scale: 4 })
const code = withSqlDataType({ family: 'character string', length: 5, fixed: true })
const flags = withSqlDataType({ family: 'bit string', length: 3, fixed: true })
const small = withSqlDataType({ family: 'exact numeric', scale: 0, bytes: 2 })

function describeSqlDataTypeParams(label: string, enabled: boolean, typesTheParam: boolean, jsonbAsText: boolean, create: () => Promise<{ runner: QueryRunner, raw(sql: string): Promise<unknown>, close(): Promise<unknown> }>): void {
    describe.skipIf(!enabled)(label + ': the type of a parameter from its SQL data type', () => {
        let created: Awaited<ReturnType<typeof create>> | undefined
        beforeAll(async () => {
            created = await create()
            await created.raw("drop type if exists rt_mood; create type rt_mood as enum ('happy', 'sad')")
        }, 300_000)
        afterAll(async () => {
            await created?.raw('drop type if exists rt_mood')
            await created?.close()
        }, 300_000)

        test('a-constant-selected-gets-the-type-of-its-sql-data-type', async () => {
            const conn = new DBConnection(created!.runner)
            const query = conn.selectFromNoTable().select({
                payload: conn.const('{"a": 1}', CustomEqualableType.of<string, 'Payload'>('Payload'), payload),
                address: conn.const('10.0.0.1', CustomEqualableType.of<string, 'Address'>('Address'), address),
                mood: conn.const('happy', EnumType.of<string, 'Mood'>('Mood'), mood),
                price: conn.const('1.23456', CustomDecimalType.of<string, 'Price'>('Price'), price),
            })
            expect(query.query()).toBe(typesTheParam
                // Typed by the oid: the SQL has no cast
                ? 'select $1 as payload, $2 as address, $3 as mood, $4 as price'
                : 'select $1::jsonb as payload, $2::inet as address, $3::rt_mood as mood, $4::numeric as price')
            const row = await query.executeSelectOne()
            // jsonb is given as an object by pg and PGlite, and as its text by Bun SQL and postgres.js (which sends a text
            // untyped: typed as a jsonb, it would serialize it as a JSON string); inet as its text; the decimal keeps every digit
            expect(row).toEqual({ payload: jsonbAsText ? '{"a": 1}' : { a: 1 }, address: '10.0.0.1', mood: 'happy', price: '1.23456' })
        })

        test('a-constant-of-a-fixed-length-type-keeps-every-character', async () => {
            const conn = new DBConnection(created!.runner)
            const query = conn.selectFromNoTable().select({
                code: conn.const('abcde', StringType, code),
                flags: conn.const('101', CustomEqualableType.of<string, 'Flags'>('Flags'), flags),
                small: conn.const(7, IntType, small),
            })
            // A char or a bit without its length would be of length 1, and cut the value: a bpchar or a varbit holds any
            expect(query.query()).toBe(typesTheParam
                ? 'select $1 as code, $2 as flags, $3 as small'
                : 'select $1::bpchar as code, $2::varbit as flags, $3::int2 as small')
            expect(await query.executeSelectOne()).toEqual({ code: 'abcde', flags: '101', small: 7 })
        })
    })
}

describeSqlDataTypeParams('PgQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'pg'), false, false, async () => {
    const db = await acquireRunnerTestDatabase()
    const client = new pg.Client({ connectionString: db.uri })
    await client.connect()
    return { runner: new PgQueryRunner(client), raw: sql => client.query(sql), close: async () => { await client.end(); await db.release() } }
})

describeSqlDataTypeParams('PostgresQueryRunner', isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'), true, true, async () => {
    const db = await acquireRunnerTestDatabase()
    const sql = postgres(db.uri, { max: 1, onnotice: () => {} })
    return { runner: new PostgresQueryRunner(sql), raw: text => sql.unsafe(text), close: async () => { await sql.end(); await db.release() } }
})

describeSqlDataTypeParams('PgLiteQueryRunner', isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'), true, false, async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })
    return { runner: new PgLiteQueryRunner(db), raw: sql => db.exec(sql), close: () => db.close() }
})

describeSqlDataTypeParams('BunSqlPostgresQueryRunner', isBun && isRealDbEnabled('postgres', 'docker', 'newest', 'bun_sql_postgres'), false, true, async () => {
    const { BunSqlPostgresQueryRunner } = await import('../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
    const db = await acquireRunnerTestDatabase()
    const { SQL } = await import('bun')
    const sql = new SQL(db.uri, { max: 1 })
    return { runner: new BunSqlPostgresQueryRunner(sql), raw: text => sql.unsafe(text), close: async () => { await sql.close(); await db.release() } }
})
