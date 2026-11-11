// Rule `non-public-api` — a test reaching past the supported surface through a
// relative import.
//
// Threat (same family as `as-any`): an agent that can't do something through
// the PUBLIC library API reaches into the library's internals with a relative
// import (`../../../../../src/sqlBuilders/…`), or pulls test infrastructure that
// isn't meant for tests out of `test/lib/`. Either way the test stops exercising
// the surface real users have, and couples to implementation detail.
//
// Two arms, one rule:
//   - **non-public `src/`** — what a consumer may import is exactly the
//     `exports` map in [`package.json`](../../../../package.json), whose entries
//     re-export from the modules that declare each name; a relative reach into
//     any src module that is neither an entry nor one of those (everything
//     reachable only via the `./__UNSUPPORTED__/*` escape hatch — `internal`,
//     `queryBuilders`, `sqlBuilders`, `expressions`, …) is forbidden even
//     though it *is* a relative import (the cheat the rule name calls out). The
//     public set is derived from `package.json` so it never drifts from what
//     actually ships.
//   - **non-admitted `test/lib/`** — tests may use only a few sanctioned
//     helpers; everything else in `test/lib/` is infra (the audit itself, the
//     searcher/indexer, container lifecycle, backends, …) and must not be
//     imported from a `*.test.ts`.
//
// Comment references to internal files (`[InsertQueryBuilder.ts:205](…/src/queryBuilders/…)`)
// are NOT imports — this walks the AST, so only real import/export/dynamic-import
// specifiers are considered. Domain (`../../domain/…`) and cell-local
// (`./setup.js`) imports are neither `src/` nor `test/lib/`, so they are fine.

import ts from 'typescript6'
import { resolve, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

// The public src surface = the entry files the `package.json` `exports` map points at (the re-export files of
// `src/exports/`, minus `./package.json` and the `./__UNSUPPORTED__/*` escape-hatch wildcard), and every module those
// files re-export from: a test imports a public name from the module that declares it, or the entry itself.
const PUBLIC_SRC: ReadonlySet<string> = loadPublicSrc()

function loadPublicSrc(): Set<string> {
    const root = new URL('../../../../', import.meta.url).pathname
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    const set = new Set<string>()
    for (const [key, value] of Object.entries<{ default?: string }>(pkg.exports ?? {})) {
        if (key === './package.json' || key.includes('*') || !value.default) continue
        const entry = value.default.replace(/^\.\//, '').replace(/\.js$/, '')
        set.add(entry)
        const text = readFileSync(resolve(root, 'src', entry + '.ts'), 'utf8')
        for (const match of text.matchAll(/from '([^']+)'/g)) {
            const target = resolve(dirname(resolve(root, 'src', entry)), match[1]!)
            set.add(target.slice(resolve(root, 'src').length + 1).replace(/\.js$/, ''))
        }
    }
    return set
}

// The few `test/lib/` files a `*.test.ts` may import (paths relative to
// `test/lib/`). Everything else under `test/lib/` is infrastructure.
const ADMITTED_TEST_LIB = new Set(['testRunner.js', 'assertType.js', 'queryIntrospection.js'])

export function checkNonPublicApi(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        const spec = importSpecifierOf(n)
        if (spec !== undefined && spec.startsWith('.')) {
            const message = classify(spec, file)
            if (message) out.push({ rule: 'non-public-api', file, line: lineOf(sf, n), message })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}

function importSpecifierOf(n: ts.Node): string | undefined {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        return n.moduleSpecifier.text
    }
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = n.arguments[0]
        if (arg && ts.isStringLiteral(arg)) return arg.text
    }
    return undefined
}

function classify(spec: string, file: string): string | undefined {
    const abs = resolve(dirname(file), spec)
    const lib = abs.match(/\/test\/lib\/(.+)$/)
    if (lib) {
        const tail = lib[1]!
        if (!ADMITTED_TEST_LIB.has(tail)) {
            return `imports test infrastructure \`test/lib/${tail}\` — a *.test.ts may use only the admitted helpers (${[...ADMITTED_TEST_LIB].join(', ')}). Use one of those, or move the shared behaviour into one`
        }
        return undefined
    }
    const src = abs.match(/\/src\/(.+)$/)
    if (src) {
        const mod = src[1]!.replace(/\.js$/, '')
        if (!PUBLIC_SRC.has(mod)) {
            return `imports \`src/${mod}\`, not a public export (package.json \`exports\`) — it is implementation detail reachable for consumers only via __UNSUPPORTED__. Build through the public API; if it is genuinely impossible, the gap belongs in the library, not behind a relative import`
        }
    }
    return undefined
}
