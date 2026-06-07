// Enumerate the cell `.test.ts` files the content checks run over — the same
// exclusions the symmetry audit applies (domain/, types.negative/, the
// `documentation` connector, the `general` db, and generated files).

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TEST_DB_DIR = 'test/db'
const NON_CELL_DIRS = new Set(['domain', 'types.negative'])
const NON_CELL_CONNECTORS = new Set(['documentation'])
const NON_CELL_DATABASES = new Set(['general'])

function isDir(p: string): boolean {
    try { return statSync(p).isDirectory() } catch { return false }
}
function isFile(p: string): boolean {
    try { return statSync(p).isFile() } catch { return false }
}
function dirs(p: string): string[] {
    return readdirSync(p).filter(n => isDir(join(p, n)))
}

export function cellTestFiles(): string[] {
    const out: string[] = []
    if (!isDir(TEST_DB_DIR)) return out
    for (const db of dirs(TEST_DB_DIR)) {
        if (NON_CELL_DATABASES.has(db)) continue
        const dbDir = join(TEST_DB_DIR, db)
        for (const version of dirs(dbDir)) {
            if (NON_CELL_DIRS.has(version)) continue
            const versionDir = join(dbDir, version)
            for (const connector of dirs(versionDir)) {
                if (NON_CELL_CONNECTORS.has(connector)) continue
                const cellDir = join(versionDir, connector)
                for (const fn of readdirSync(cellDir)) {
                    if (!fn.endsWith('.test.ts')) continue
                    if (fn.endsWith('.generated.test.ts')) continue
                    const p = join(cellDir, fn)
                    if (isFile(p)) out.push(p)
                }
            }
        }
    }
    return out.sort()
}

// The `*.test.ts` files under every `<db>/types.negative/` directory — the
// negative-type cells excluded from `cellTestFiles()`. The `ts-ignore` rule
// alone scans these too (a `@ts-ignore` is forbidden EVERYWHERE in the tests,
// including the negative-type cells, where the legitimate tool is the
// line-scoped `@ts-expect-error`). No other content rule runs here: these files
// have no runtime, deliberately fail to compile, and are full of expected-error
// assertions that would false-positive every other check.
export function typesNegativeTestFiles(): string[] {
    const out: string[] = []
    if (!isDir(TEST_DB_DIR)) return out
    for (const db of dirs(TEST_DB_DIR)) {
        if (NON_CELL_DATABASES.has(db)) continue
        const negDir = join(TEST_DB_DIR, db, 'types.negative')
        if (!isDir(negDir)) continue
        const walk = (d: string): void => {
            for (const fn of readdirSync(d)) {
                const p = join(d, fn)
                if (isDir(p)) { walk(p); continue }
                if (fn.endsWith('.test.ts') && isFile(p)) out.push(p)
            }
        }
        walk(negDir)
    }
    return out.sort()
}
