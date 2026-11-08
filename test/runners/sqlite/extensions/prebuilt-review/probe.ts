// Loads the uuid and decimal extensions of the npm package sqlite-extensions and prints what each function gives.
// Run it ONLY inside a throwaway container with the network cut (see README.md), never on the host:
//   npx tsx probe.ts better-sqlite3 | npx tsx probe.ts node | bun probe.ts bun
// The package isn't a dependency of the repository: it's imported by a name the compiler doesn't resolve.

import { run } from './queries.js'

const packageName = 'sqlite-extensions'
const { extensionPath, SQLITE_EXTENSIONS } = await import(packageName)
const uuid: string = extensionPath(SQLITE_EXTENSIONS.UUID)
const decimal: string = extensionPath(SQLITE_EXTENSIONS.DECIMAL)

const kind = process.argv[2]
if (kind === 'better-sqlite3') {
    const Database = (await import('better-sqlite3')).default
    const db = new Database(':memory:')
    db.loadExtension(uuid)
    db.loadExtension(decimal)
    run(kind, sql => db.prepare(sql).get())
} else if (kind === 'node') {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(':memory:', { allowExtension: true })
    db.loadExtension(uuid)
    db.loadExtension(decimal)
    run(kind, sql => db.prepare(sql).get())
} else if (kind === 'bun') {
    const { Database } = await import('bun:sqlite')
    const db = new Database(':memory:')
    db.loadExtension(uuid)
    db.loadExtension(decimal)
    run(kind, sql => db.query(sql).get())
} else {
    console.log('usage: probe.ts better-sqlite3 | node | bun')
}
