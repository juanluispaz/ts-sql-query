// The unified TypeScript build + the declaration→row resolver.
//
// ONE ts.Program covers src/ + test/ at once (test/tsconfig.json includes both:
// `["**/*.ts", "../src/**/*.ts"]`), so every file — the real source, the simplified
// master, the hand-written matrix tests, and the generated doc cells — is compiled
// together and references resolve ACROSS the whole tree. There is no per-file
// createSourceFile and no second program: whatever ts compiles is the complete file.
//
// resolveToken turns a name-match into a precise link. `getSymbolAtLocation` binds a
// reference token to its declaration; declMap maps that declaration NODE back to the
// symbol/member row we indexed for it. Node identity is stable within one Program, so
// the mapping is exact — no position-key arithmetic. The ~0.1% of tokens that don't
// resolve (or resolve outside the indexed surface — test helpers, locals, Bun globals)
// keep only the name-based fallback the ref tables still carry.

import ts from 'typescript'
import { resolve as resolvePath } from 'node:path'

export interface BuiltProgram {
    program: ts.Program
    checker: ts.TypeChecker
}

/** Build the single Program over src/ + test/ from test/tsconfig.json. */
export function buildProgram(): BuiltProgram {
    const cfgPath = resolvePath('test/tsconfig.json')
    const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, resolvePath('test'))
    const program = ts.createProgram(parsed.fileNames, { ...parsed.options, skipLibCheck: true, noEmit: true })
    return { program, checker: program.getTypeChecker() }
}

// A resolved reference points at the row(s) indexed for the declaration it binds to:
// the owning symbol always, plus the member when it resolves to a member.
export interface RowRef {
    symbol_id: number | null
    member_id: number | null
}

// Declaration NODE → the row(s) emitted for it. extractSrc populates this while it
// walks (every symbol and member registers its declaration node here). Keyed by
// ts.Node (declarations are Nodes) so set/get stay identity-based without casts.
export type DeclMap = Map<ts.Node, RowRef>

// Master switch for type resolution. When off (the `--no-resolve` build), resolveToken
// short-circuits BEFORE touching the checker, so `getSymbolAtLocation` is never called and
// the checker's type cache never grows — a low-memory / fast build (~1–2 GB vs ~8 GB) whose
// only cost is that every `resolved_*_id` FK is NULL (name-based search still works). The
// Program is still built (extractors read its compiled files; is_public still uses the
// checker on the ~50 export modules). Set once in build.ts before extraction.
let resolveEnabled = true
export function setResolveEnabled(on: boolean): void { resolveEnabled = on }

/**
 * Resolve a reference token to the row(s) of the declaration it binds to, or null when
 * it binds outside the indexed surface. Aliases (re-exports / imports) are followed to
 * the real declaration before lookup.
 */
export function resolveToken(checker: ts.TypeChecker, declMap: DeclMap, token: ts.Node): RowRef | null {
    if (!resolveEnabled) return null   // --no-resolve: never touch the checker (keeps it cold)
    let sym = checker.getSymbolAtLocation(token)
    if (!sym) return null
    if (sym.flags & ts.SymbolFlags.Alias) {
        try { sym = checker.getAliasedSymbol(sym) } catch { /* not aliased after all — keep */ }
    }
    for (const d of sym.declarations ?? []) {
        const r = declMap.get(d)
        if (r) return r
    }
    return null
}
