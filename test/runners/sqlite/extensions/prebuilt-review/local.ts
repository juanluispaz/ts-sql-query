// Loads two extension files given by path (uuid, then decimal) and prints what each function gives: the binaries of
// sqlite-extensions copied out of a container, run under sandbox-exec (see README.md), or a decimal.c built from
// SQLite's source to check a fix.
//   sandbox-exec -f sandbox.sb bun local.ts better-sqlite3 <uuid.dylib> <decimal.dylib>
//   (under the sandbox use bun: tsx needs to write its IPC pipe, which the profile denies)

import { run } from './queries.js'

const [kind, uuid, decimal] = process.argv.slice(2)
if (!kind || !uuid || !decimal) {
    console.log('usage: local.ts better-sqlite3|node <uuid extension> <decimal extension>')
} else if (kind === 'better-sqlite3') {
    const Database = (await import('better-sqlite3')).default
    const db = new Database(':memory:')
    db.loadExtension(uuid)
    db.loadExtension(decimal)
    run(kind, sql => db.prepare(sql).get())
} else {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(':memory:', { allowExtension: true })
    db.loadExtension(uuid)
    db.loadExtension(decimal)
    run(kind, sql => db.prepare(sql).get())
}
// The network and writes are denied by the sandbox profile: these two lines show it
try { await fetch('https://example.com'); console.log('NETWORK REACHABLE') } catch { console.log('network blocked') }
try { (await import('node:fs')).writeFileSync('/private/tmp/sandbox-write-test', 'x'); console.log('WRITE ALLOWED') } catch { console.log('write blocked') }
