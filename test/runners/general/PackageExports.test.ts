// The paths a user imports from are the files of src/exports, which only re-export: src/exports/v2 has the paths of
// version 2, by what they offer (the root for every database, one path per database and one per driver of each
// database), and src/exports/v1 the paths of version 1, kept so its code keeps compiling, each name marked deprecated
// with the path of version 2; a path of version 1 also defines, deprecated, the functions version 2 dropped. The exports map of package.json lists exactly those files, a name is exported by only one
// path of version 2 (a driver that serves MySQL and MariaDB is under both), and every import of the documentation is
// of a path and a name the package exports.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, test } from '../../lib/testRunner.js'

const root = resolve(import.meta.dirname, '../../..')
const exportsDir = join(root, 'src/exports')

interface Specifier {
    /** The name in the module it comes from */
    name: string
    /** The name it is exported with */
    exported: string
    /** The module it comes from, relative to src, without extension */
    from: string
    deprecated: boolean
}

function filesOf(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? filesOf(path) : path.endsWith('.ts') ? [path] : []
    })
}

/**
 * The re-exports of an entry file: blocks `export { ... } from '...'`, the only statements an entry has; a path of
 * version 1 can also define the functions version 2 dropped, each one deprecated, with the imports they need
 */
function specifiersOf(file: string): Specifier[] {
    const text = readFileSync(file, 'utf8')
    const code = text.replace(/^\/\/.*$/gm, '').trim()
    const result: Specifier[] = []
    const block = /export \{\n([\s\S]*?)\n\} from '([^']+)'\n?/g
    let match: RegExpExecArray | null
    let rest = code
    if (file.startsWith(join(exportsDir, 'v1') + '/')) {
        const self = relative(join(root, 'src'), file).replace(/\.ts$/, '')
        const imports = /import \{[^}\n]*\} from '[^']+'\n?/g
        while ((match = imports.exec(code)) !== null) {
            rest = rest.replace(match[0], '')
        }
        const definition = /\/\*\* @deprecated [^\n]+ \*\/\nexport function (\w+)\([^\n]*\{\n[\s\S]*?\n\}\n?/g
        while ((match = definition.exec(code)) !== null) {
            rest = rest.replace(match[0], '')
            result.push({ name: match[1]!, exported: match[1]!, from: self, deprecated: true })
        }
    }
    while ((match = block.exec(code)) !== null) {
        rest = rest.replace(match[0], '')
        const from = relative(join(root, 'src'), resolve(dirname(file), match[2]!)).replace(/\.js$/, '')
        let deprecated = false
        for (const line of match[1]!.split('\n').map(l => l.trim()).filter(l => l)) {
            if (/^\/\*\* @deprecated .+ \*\/$/.test(line)) {
                deprecated = true
                continue
            }
            const spec = /^(?:type )?(\w+)(?: as (\w+))?,$/.exec(line)
            if (!spec) {
                throw new Error('Unexpected line in ' + file + ': ' + line)
            }
            result.push({ name: spec[1]!, exported: spec[2] ?? spec[1]!, from, deprecated })
            deprecated = false
        }
    }
    // Nothing else
    expect(rest.trim()).toBe('')
    return result
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { exports: Record<string, { types: string, default: string }> }
const entryPaths = Object.keys(packageJson.exports).filter(key => key !== './package.json' && key !== './__UNSUPPORTED__/*')
/** The entry file in src of a path of the exports map */
const sourceOf = (key: string) => join(root, 'src', packageJson.exports[key]!.default.replace(/\.js$/, '.ts'))
const v2Entries = entryPaths.filter(key => sourceOf(key).startsWith(join(exportsDir, 'v2') + '/'))
const v1Entries = entryPaths.filter(key => sourceOf(key).startsWith(join(exportsDir, 'v1') + '/'))
const specifiers = new Map(entryPaths.map(key => [key, specifiersOf(sourceOf(key))]))

describe('The exports of the package', () => {
    test('the-exports-map-lists-exactly-the-files-of-src-exports', () => {
        for (const key of entryPaths) {
            const entry = packageJson.exports[key]!
            expect(entry.types).toBe(entry.default.replace(/\.js$/, '.d.ts'))
        }
        expect(entryPaths.map(sourceOf).sort()).toEqual(filesOf(exportsDir).sort())
        expect(v2Entries.length + v1Entries.length).toBe(entryPaths.length)
    })

    test('a-name-is-exported-by-only-one-path-of-version-2', () => {
        // The same driver for MySQL and for MariaDB
        const sameDriver = (a: string, b: string) => a.replace(/^\.\/mariadb\//, './mysql/') === b.replace(/^\.\/mariadb\//, './mysql/')
        const pathsOf = new Map<string, string[]>()
        for (const key of v2Entries) {
            for (const spec of specifiers.get(key)!) {
                const id = spec.from + '#' + spec.name
                pathsOf.set(id, [...(pathsOf.get(id) ?? []), key])
            }
        }
        const repeated = [...pathsOf].filter(([, keys]) => keys.length > 1 && !(keys.length === 2 && sameDriver(keys[0]!, keys[1]!)))
        expect(repeated).toEqual([])
    })

    test('a-path-of-version-2-is-not-deprecated-and-each-name-of-version-1-is', () => {
        for (const key of v2Entries) {
            expect(specifiers.get(key)!.filter(spec => spec.deprecated).map(spec => spec.exported)).toEqual([])
        }
        for (const key of v1Entries) {
            for (const spec of specifiers.get(key)!) {
                expect({ key, name: spec.exported, deprecated: spec.deprecated }).toEqual({ key, name: spec.exported, deprecated: true })
                if (spec.from.startsWith('exports/v2/')) {
                    // It comes from a path of version 2, so it is the same object or type
                    expect(specifiers.get(v2Entries.find(v2 => sourceOf(v2) === join(root, 'src', spec.from + '.ts'))!)!.some(v2 => v2.exported === spec.name)).toBe(true)
                } else {
                    // A name version 2 dropped, kept for the code of version 1: no path of version 2 exports it
                    expect({ key, name: spec.exported, inVersion2: v2Entries.some(v2 => specifiers.get(v2)!.some(v2Spec => v2Spec.exported === spec.exported)) }).toEqual({ key, name: spec.exported, inVersion2: false })
                }
            }
        }
    })

    test('each-import-of-the-documentation-is-of-a-path-and-a-name-the-package-exports', () => {
        const docs = readdirRecursive(join(root, 'docs')).filter(file => file.endsWith('.md'))
        const missing: string[] = []
        for (const file of docs) {
            const text = readFileSync(file, 'utf8')
            const imports = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"](ts-sql-query(?:\/[^'"]*)?)['"]/g
            let match: RegExpExecArray | null
            while ((match = imports.exec(text)) !== null) {
                const key = match[3] === 'ts-sql-query' ? '.' : './' + match[3]!.slice('ts-sql-query/'.length)
                const where = relative(root, file) + ': ' + match[3]
                if (key.startsWith('./__UNSUPPORTED__/')) {
                    continue
                }
                const entry = specifiers.get(key)
                if (!entry) {
                    missing.push(where)
                    continue
                }
                for (const name of match[2]!.split(',').map(n => n.trim().replace(/^type\s+/, '').replace(/\s+as\s+\w+$/, '')).filter(n => n)) {
                    if (!entry.some(spec => spec.exported === name)) {
                        missing.push(where + ' { ' + name + ' }')
                    }
                }
            }
        }
        expect(missing).toEqual([])
    })
})

function readdirRecursive(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? readdirRecursive(path) : [path]
    })
}
