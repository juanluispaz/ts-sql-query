// A class that extends a class of another module can be evaluated only once that module is: if the module of the parent
// imports, directly or through others, the module of the child, loading the parent first evaluates the child first, and
// `extends` throws a ReferenceError. That depends on which module the program imports first: an entry point of the
// package can be fine and a deep import (`ts-sql-query/__UNSUPPORTED__/...`) not. This test reads the imports that
// exist at run time (not `import type` nor `type` specifiers) of every module of src/ and checks that no class extends
// a class of a module that reaches its own module.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { describe, expect, test } from '../../lib/testRunner.js'

const SRC = normalize(join(import.meta.dirname, '..', '..', '..', 'src'))

function modulesIn(folder: string): string[] {
    const result: string[] = []
    for (const name of readdirSync(folder)) {
        const path = join(folder, name)
        if (statSync(path).isDirectory()) {
            result.push(...modulesIn(path))
        } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
            result.push(path)
        }
    }
    return result
}

interface ModuleImports {
    // the modules of src/ it imports at run time
    readonly modules: Set<string>
    // the module each name imported at run time comes from
    readonly origins: Map<string, string>
    // the parents of the classes it declares, by their name in this module
    readonly parents: string[]
}

const IMPORT = /^import\s+(type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:from\s+)?['"](\.[^'"]+)['"]/gm
const EXTENDS = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+(?:<[^{]*?>)?\s+extends\s+(\w+)/gm

function importsOf(path: string): ModuleImports {
    const text = readFileSync(path, 'utf8')
    const modules = new Set<string>()
    const origins = new Map<string, string>()
    for (const match of text.matchAll(IMPORT)) {
        if (match[1]) {
            continue
        }
        const target = normalize(join(dirname(path), match[4]!.replace(/\.js$/, '.ts')))
        const names = (match[3] ?? '').split(',').map(name => name.trim()).filter(name => name !== '' && !name.startsWith('type '))
        if (match[2]) {
            names.push(match[2])
        }
        if (names.length === 0 && !match[3] && !match[2]) {
            // import './module.js': evaluated for its side effects
            modules.add(target)
        }
        for (const name of names) {
            const local = name.split(/\s+as\s+/).pop()!.trim()
            origins.set(local, target)
            modules.add(target)
        }
    }
    const parents = [...text.matchAll(EXTENDS)].map(match => match[1]!)
    return { modules, origins, parents }
}

const imports = new Map<string, ModuleImports>()
for (const path of modulesIn(SRC)) {
    imports.set(path, importsOf(path))
}

function reaches(from: string, to: string): boolean {
    const seen = new Set<string>()
    const pending = [from]
    while (pending.length > 0) {
        const current = pending.pop()!
        if (current === to) {
            return true
        }
        if (seen.has(current)) {
            continue
        }
        seen.add(current)
        for (const next of imports.get(current)?.modules ?? []) {
            pending.push(next)
        }
    }
    return false
}

describe('The order the modules load in', () => {
    test('no-class-extends-a-class-of-a-module-that-imports-its-own', () => {
        const problems: string[] = []
        for (const [path, { origins, parents }] of imports) {
            for (const parent of parents) {
                const origin = origins.get(parent)
                if (origin && imports.has(origin) && reaches(origin, path)) {
                    problems.push(relative(SRC, path) + ' extends ' + parent + ' of ' + relative(SRC, origin) + ', which imports it back')
                }
            }
        }
        expect(problems).toEqual([])
    })

    test('the-modules-of-the-type-system-are-read', () => {
        // The classes of the data types are found: the check above would pass on nothing if the parsing broke
        const equalable = imports.get(join(SRC, 'typeSystem', 'equalable.ts'))
        expect(equalable?.parents).toContain('NullableType')
        expect(equalable?.origins.get('NullableType')).toBe(join(SRC, 'typeSystem', 'nullable.ts'))
    })
})
