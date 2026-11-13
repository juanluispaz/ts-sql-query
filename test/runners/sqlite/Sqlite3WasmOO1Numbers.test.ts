// sqlite-wasm binds a JS number that is an integer as a 64-bit integer, so one beyond that range (1e20, 2^63,
// 1.5e300) would wrap without an error. Sqlite3WasmOO1QueryRunner sends it as a real, and the value read back is the
// one sent.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { Sqlite3WasmOO1QueryRunner } from '../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { addParam } from '../lib/params.js'

describe.skipIf(!isRealDbEnabled('sqlite', 'wasm', 'newest', 'sqlite-wasm-OO1'))('Sqlite3WasmOO1QueryRunner: numbers beyond a 64-bit integer', () => {
    let db: import('@sqlite.org/sqlite-wasm').Database | undefined
    let runner: Sqlite3WasmOO1QueryRunner | undefined

    beforeAll(async () => {
        const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default
        const sqlite3 = await sqlite3InitModule()
        db = new sqlite3.oo1.DB(':memory:', 'c')
        runner = new Sqlite3WasmOO1QueryRunner(db)
        await runner.executeDatabaseSchemaModification('create table numbers (v real not null)')
    })
    afterAll(() => {
        db?.close()
    })

    const values = [1e20, -1e20, 2 ** 63, -(2 ** 63), 1.5e300, -1.5e300, 1e18, 2 ** 53 + 2, 1.5]

    test('stored-and-read-back', async () => {
        for (const value of values) {
            await runner!.executeDelete('delete from numbers')
            const params: any[] = []
            await runner!.executeInsert(`insert into numbers (v) values (${addParam(runner!, params, value, 'double', 'double', false)})`, params)
            const read = await runner!.executeSelectOneColumnOneRow('select v from numbers')
            expect([value, read]).toEqual([value, value])
        }
    })

    test('as-a-value-in-the-query', async () => {
        // An integer within the 64-bit range comes back from an expression as a bigint, as the driver reads an integer
        for (const value of [1e20, -1e20, 2 ** 63, 1.5e300, -1.5e300, 1.5]) {
            const params: any[] = []
            const read = await runner!.executeSelectOneColumnOneRow(`select ${addParam(runner!, params, value, 'double', 'double', false)}`, params)
            expect([value, read]).toEqual([value, value])
        }
    })
})
