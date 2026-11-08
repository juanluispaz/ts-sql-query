// The JavaScript uuid functions registerSqliteFunctions registers for the uuid strategy 'uuid-extension' give the
// results of SQLite's uuid extension: the extension is built from extensions/uuid.c and loaded on better-sqlite3, and
// the same queries run against it and against the JavaScript functions. Without a C compiler, or without the headers
// of SQLite, the comparison is skipped.

import Database from 'better-sqlite3'
import { describe, expect, test } from '../../lib/testRunner.js'
import { registerSqliteFunctions } from '../../../src/queryRunners/BetterSqlite3QueryRunner.js'
import { buildSqliteExtension } from './sqliteExtensions.js'

function loadUuidExtension(): { real: Database.Database } | { reason: string } {
    const built = buildSqliteExtension('uuid')
    if ('reason' in built) {
        return built
    }
    try {
        const real = new Database(':memory:')
        real.loadExtension(built.path)
        return { real }
    } catch (e) {
        return { reason: 'the uuid extension could not be loaded: ' + (e instanceof Error ? e.message : String(e)) }
    }
}
const extension = loadUuidExtension()
if ('reason' in extension) {
    console.warn('SqliteUuidFunctions: the uuid extension of SQLite could not be built, so the comparison is skipped: ' + extension.reason)
}

// The path of the built extension, when it could be built
function extensionPath(): string {
    const built = buildSqliteExtension('uuid')
    return 'path' in built ? built.path : ''
}

describe.skipIf('reason' in extension)('SQLite: the JavaScript uuid functions give the results of the uuid extension', () => {
    const real = 'real' in extension ? extension.real : new Database(':memory:')
    const javaScript = new Database(':memory:')
    registerSqliteFunctions(javaScript)

    test('uuid_blob-and-uuid_str', () => {
        const queries = [
            "select hex(uuid_blob('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) as v",
            "select uuid_str(uuid_blob('{A0EEBC99-9C0B4EF8-BB6D-6BB9BD380A11}')) as v",
            "select uuid_str(x'A0EEBC999C0B4EF8BB6D6BB9BD380A11') as v",
            "select uuid_str('a0eebc999c0b4ef8bb6d6bb9bd380a11') as v",
            "select uuid_blob('nope') as v",
            "select uuid_blob(x'0102') as v",
            'select uuid_str(null) as v',
            'select uuid_blob(null) as v',
            'select uuid_str(123) as v',
        ]
        for (const sql of queries) {
            expect([sql, javaScript.prepare(sql).get()]).toEqual([sql, real.prepare(sql).get()])
        }
    })

    test('registered-after-the-extension-it-replaces-its-functions-unless-skipped', () => {
        // The extension loaded first has its uuid(), a version 4 UUID; the library's replaces it with a version 7
        const both = new Database(':memory:')
        both.loadExtension(extensionPath())
        registerSqliteFunctions(both)
        expect(both.prepare('select substr(uuid(), 15, 1) as version').get()).toEqual({ version: '7' })
        expect(both.prepare("select ci_replace('Hello', 'h', 'x') as r").get()).toEqual({ r: 'xello' })
        both.close()
        // With skip, the extension's are kept
        const kept = new Database(':memory:')
        kept.loadExtension(extensionPath())
        registerSqliteFunctions(kept, { skip: ['uuid', 'uuid_str', 'uuid_blob'] })
        expect(kept.prepare('select substr(uuid(), 15, 1) as version').get()).toEqual({ version: '4' })
        kept.close()
    })

    test('uuid', () => {
        // The extension generates a version 4 UUID and the library a version 7: both are a text of 36 characters
        for (const db of [real, javaScript]) {
            expect(db.prepare('select typeof(uuid()) as t, length(uuid()) as l, uuid() <> uuid() as different').get()).toEqual({ t: 'text', l: 36, different: 1 })
        }
    })
})
