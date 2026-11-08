// Builds a loadable extension of SQLite from its C source in ./extensions (see its README), with the C compiler of
// the machine and the headers of a full SQLite: the ones the macOS SDK ships don't build a loadable extension.
//
// - The library is kept in node_modules/.cache/ts-sql-query/sqlite-extensions/ (gitignored), named after a hash of
//   the source, the platform, the architecture and the header used (its path and its content), in a folder of that
//   name (the file keeps the name of the extension), so it is built once and again only when one of them changes.
// - It is written under a temporary name and renamed, so a worker never loads a half-written library; one worker
//   builds while the others wait for it (a lock file), and they skip if it takes too long.
// - A build that fails is remembered too (a .failed file with the reason, same key): a machine without a compiler or
//   headers gets the reason at once, without trying again.
// - It never throws: what can't be built gives the reason, and the tests that need it are skipped with it (on CI too).
// - Headers older than the SQLite version of the sources (3.53.0) give a reason too: the extension would be built
//   against an older SQLite than the one its source belongs to, so its results aren't the ones to compare with.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type SqliteExtensionName = 'decimal' | 'uuid'

/** The version of SQLite the sources of ./extensions come from (SQLITE_VERSION_NUMBER) */
export const sqliteExtensionsSourceVersion = 3_053_000

/** The folders where the headers of a full SQLite usually are (Homebrew on arm64 and Intel, the system on Linux) */
export const sqliteHeaderFolders = ['/opt/homebrew/opt/sqlite/include', '/usr/local/opt/sqlite/include', '/usr/include', '/usr/local/include']

const cacheFolder = fileURLToPath(new URL('../../../node_modules/.cache/ts-sql-query/sqlite-extensions/', import.meta.url))

// How long a worker waits for another one that is building, and when a lock is considered abandoned
const waitForBuildMs = 60_000
const abandonedLockMs = 120_000

function sleep(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function writeAtomically(path: string, content: string): void {
    const temporary = path + '.' + process.pid + '.tmp'
    writeFileSync(temporary, content)
    renameSync(temporary, path)
}

/**
 * The command that compiles an extension: the one the page of the documentation on SQLite's extensions gives for
 * macOS and Linux, which a test checks
 */
export function sqliteExtensionCompileCommand(platform: NodeJS.Platform, include: string, output: string, source: string): string[] {
    const args = ['cc', '-O2', '-fPIC', '-shared', '-I', include, '-o', output, source]
    if (platform === 'darwin') {
        args.splice(1, 0, '-dynamiclib')
    }
    return args
}

/** The path of the built library, or why it can't be used */
export function buildSqliteExtension(name: SqliteExtensionName): { path: string } | { reason: string } {
    try {
        const include = sqliteHeaderFolders.find(folder => existsSync(join(folder, 'sqlite3ext.h')))
        if (!include) {
            return { reason: 'sqlite3ext.h not found in ' + sqliteHeaderFolders.join(', ') }
        }
        const headerVersion = /#define\s+SQLITE_VERSION_NUMBER\s+(\d+)/.exec(readFileSync(join(include, 'sqlite3.h'), 'utf8'))?.[1]
        if (!headerVersion || Number(headerVersion) < sqliteExtensionsSourceVersion) {
            return { reason: 'the SQLite headers in ' + include + ' are version ' + (headerVersion ?? 'unknown') + ', older than ' + sqliteExtensionsSourceVersion + ', the version of the sources' }
        }
        const source = fileURLToPath(new URL('./extensions/' + name + '.c', import.meta.url))
        const key = createHash('sha256')
            .update(readFileSync(source))
            .update('\0' + process.platform + '\0' + process.arch + '\0' + include + '\0')
            .update(readFileSync(join(include, 'sqlite3ext.h')))
            .update(readFileSync(join(include, 'sqlite3.h')))
            .digest('hex')
            .substring(0, 16)
        // The file keeps the name of the extension: SQLite finds its entry point (sqlite3_decimal_init) by that name
        const folder = join(cacheFolder, key)
        mkdirSync(folder, { recursive: true })
        const path = join(folder, name + (process.platform === 'darwin' ? '.dylib' : '.so'))
        const failed = path + '.failed'
        const lock = path + '.lock'
        const deadline = Date.now() + waitForBuildMs
        for (;;) {
            if (existsSync(path)) {
                return { path }
            }
            if (existsSync(failed)) {
                return { reason: readFileSync(failed, 'utf8') }
            }
            let lockFile: number
            try {
                lockFile = openSync(lock, 'wx')
            } catch {
                // Another worker is building it
                try {
                    if (Date.now() - statSync(lock).mtimeMs > abandonedLockMs) {
                        rmSync(lock, { force: true })
                        continue
                    }
                } catch {
                    continue
                }
                if (Date.now() > deadline) {
                    return { reason: 'another worker is still building ' + path }
                }
                sleep(200)
                continue
            }
            try {
                const temporary = path + '.' + process.pid + '.tmp'
                const [compiler, ...args] = sqliteExtensionCompileCommand(process.platform, include, temporary, source)
                const compiled = spawnSync(compiler!, args, { encoding: 'utf8' })
                if (compiled.error || compiled.status !== 0) {
                    rmSync(temporary, { force: true })
                    const reason = 'cc failed: ' + (compiled.error?.message ?? compiled.stderr)
                    writeAtomically(failed, reason)
                    return { reason }
                }
                renameSync(temporary, path)
                return { path }
            } finally {
                closeSync(lockFile)
                rmSync(lock, { force: true })
            }
        }
    } catch (e) {
        return { reason: 'the extension could not be built: ' + (e instanceof Error ? e.message : String(e)) }
    }
}
