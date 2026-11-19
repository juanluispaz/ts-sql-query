// The modules of src/ import only what they use. `noUnusedLocals` doesn't report an unused name that starts with an
// underscore, and every internal function of the library does (`__classOf`), so this test reads the syntax of each
// module and fails on a name it imports and never uses.

import { readFileSync } from 'node:fs'
import { join, normalize, relative } from 'node:path'
import { execSync } from 'node:child_process'
import ts from 'typescript6'
import { describe, expect, test } from '../../lib/testRunner.js'

const ROOT = normalize(join(import.meta.dirname, '..', '..', '..'))

function unusedImportsOf(path: string): string[] {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    const imported: string[] = []
    const used = new Set<string>()
    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node)) {
            const clause = node.importClause
            if (clause?.name) {
                imported.push(clause.name.text)
            }
            const bindings = clause?.namedBindings
            if (bindings && ts.isNamedImports(bindings)) {
                for (const element of bindings.elements) {
                    imported.push(element.name.text)
                }
            }
            if (bindings && ts.isNamespaceImport(bindings)) {
                imported.push(bindings.name.text)
            }
            return
        }
        if (ts.isIdentifier(node)) {
            used.add(node.text)
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    return imported.filter(name => !used.has(name))
}

describe('The imports of the library', () => {
    test('no-module-imports-a-name-it-does-not-use', () => {
        const files = execSync("git ls-files 'src/*.ts'", { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(file => file !== '' && !file.endsWith('.d.ts'))
        expect(files.length).toBeGreaterThan(100)
        const problems: string[] = []
        for (const file of files) {
            const unused = unusedImportsOf(join(ROOT, file))
            if (unused.length > 0) {
                problems.push(relative(ROOT, join(ROOT, file)) + ': ' + unused.join(', '))
            }
        }
        expect(problems).toEqual([])
    })
})
