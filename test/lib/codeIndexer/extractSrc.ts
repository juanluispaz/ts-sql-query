// Extract the declaration structure of the library source into index rows.
//
// Covers BOTH:
//   - src/**/*.ts        — the real implementation. Each declaration is tagged
//                          is_public when it is reachable by name through the
//                          package.json `exports` map (so the index can tell
//                          "internal: reach it via the public API" apart from
//                          "doesn't exist").
//   - simplifiedQueryDefinition.ts — the hand-maintained, human-readable map of the
//                          query-building structure (its own 'simplified' pseudo-module).
//                          Only the part between its `// BEGIN` / `// END` markers is
//                          indexed; the trailing `makeCompilerHappy` ValueSource merge
//                          and noop type aliases (compiler scaffolding) fall outside.
//
// The Program is the UNIFIED src+test build (see resolve.ts) — owned by build.ts and
// passed in. This module only READS its source files; it does NOT parse anything in
// isolation. While walking it builds the declMap (declaration node → emitted row),
// which the resolver uses to turn name-matches into exact links — here for the
// invocation callees, and in the test/example/doc extractors for their refs.

import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { resolveToken } from './resolve.js'
import type { DeclMap } from './resolve.js'
import type { HeritageRow, Ids, InvocationRow, MemberRow, ModuleRow, SymbolRow } from './model.js'

export interface SrcExtract {
    modules: ModuleRow[]
    symbols: SymbolRow[]
    members: MemberRow[]
    heritage: HeritageRow[]
    invocations: InvocationRow[]
    declMap: DeclMap   // declaration node → row, for the ref resolvers downstream
}

// The hand-maintained simplified query API map (a valid .ts). Indexed as its own
// 'simplified' pseudo-module, restricted to its BEGIN/END region.
const SIMPLIFIED = 'src/examples/documentation/simplifiedQueryDefinition.ts'

// src/examples/prisma/ is GENERATED Prisma client code (pure noise) — dropped from
// the walk. (The doc-code templates live under test/templates/doc-code/ and the
// generated output under test/db/<db>/newest/documentation/ — handled by the doc-test
// extractor, not here.)
function isIgnoredSrc(relPath: string): boolean {
    return relPath.startsWith('src/examples/prisma/')
}

// ── public surface: (declaring file, name) pairs reachable through exports ───
interface PublicInfo {
    publicKeys: Set<string>                 // `${fileAbs} ${name}`
    moduleSubpath: Map<string, string>      // fileAbs → export subpath ('.' etc.)
}

function zoneOf(subpath: string): string {
    const p = subpath.replace(/^\.\//, '')
    if (p === '.' || p === '' || !p.includes('/')) return 'root'
    return p.split('/')[0]!
}

function computePublic(program: ts.Program, checker: ts.TypeChecker, entries: { subpath: string, src: string }[]): PublicInfo {
    const publicKeys = new Set<string>()
    const moduleSubpath = new Map<string, string>()

    for (const entry of entries) {
        const abs = resolve(entry.src)
        const sf = program.getSourceFile(abs)
        if (!sf) continue
        moduleSubpath.set(abs, entry.subpath)
        const moduleSym = checker.getSymbolAtLocation(sf)
        if (!moduleSym) continue
        for (const exp of checker.getExportsOfModule(moduleSym)) {
            if (exp.getName() === 'default') continue
            let target = exp
            if (exp.flags & ts.SymbolFlags.Alias) {
                try { target = checker.getAliasedSymbol(exp) } catch { /* keep alias */ }
            }
            for (const decl of target.declarations ?? []) {
                const declFile = decl.getSourceFile().fileName
                publicKeys.add(`${declFile} ${target.getName()}`)
                // also record under the originally-exported name (re-export rename)
                publicKeys.add(`${declFile} ${exp.getName()}`)
            }
        }
    }
    return { publicKeys, moduleSubpath }
}

// ── jsdoc / span helpers ────────────────────────────────────────────────────
function jsdocOf(node: ts.Node, sf: ts.SourceFile): string | null {
    const ranges = ts.getLeadingCommentRanges(sf.text, node.getFullStart())
    if (!ranges) return null
    const docs = ranges
        .filter(r => sf.text.slice(r.pos, r.pos + 3) === '/**')
        .map(r => sf.text.slice(r.pos, r.end))
    return docs.length ? docs.join('\n') : null
}

function span(node: ts.Node, sf: ts.SourceFile) {
    const s = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    const e = sf.getLineAndCharacterOfPosition(node.getEnd())
    return { start_line: s.line + 1, start_col: s.character + 1, end_line: e.line + 1, end_col: e.character + 1 }
}

function memberKind(m: ts.ClassElement | ts.TypeElement): string {
    if (ts.isMethodSignature(m) || ts.isMethodDeclaration(m)) return 'method'
    if (ts.isPropertySignature(m) || ts.isPropertyDeclaration(m)) return 'property'
    if (ts.isGetAccessor(m)) return 'getter'
    if (ts.isSetAccessor(m)) return 'setter'
    if (ts.isIndexSignatureDeclaration(m)) return 'index'
    if (ts.isCallSignatureDeclaration(m)) return 'call'
    if (ts.isConstructSignatureDeclaration(m) || ts.isConstructorDeclaration(m)) return 'construct'
    return 'other'
}

function memberName(m: ts.ClassElement | ts.TypeElement): string | null {
    const n = (m as { name?: ts.Node }).name
    if (n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isPrivateIdentifier(n))) return n.text
    const k = memberKind(m)
    if (k === 'index') return '[index]'
    if (k === 'call') return '[call]'
    if (k === 'construct') return '[construct]'
    return null
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    return ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some(m => m.kind === kind) ?? false)
}

function isExported(node: ts.Node): boolean {
    return hasModifier(node, ts.SyntaxKind.ExportKeyword)
}

// The member SIGNATURE only — the declaration up to (but not including) an
// implementation body or property initializer. For a class method we keep
// `foo(a: X): Y`, NOT its body; for an interface member (no body) it's the whole
// text. The body is implementation detail, reachable by opening the member's span
// (start_line..end_line) — storing it here would just be truncated source noise.
function memberSignature(m: ts.Node, sf: ts.SourceFile): string {
    const stop = (m as { body?: ts.Node }).body ?? (m as { initializer?: ts.Node }).initializer
    const raw = stop ? sf.text.slice(m.getStart(sf), stop.getStart(sf)) : m.getText(sf)
    return raw.replace(/\s+/g, ' ').trim().replace(/[={]\s*$/, '').trim().slice(0, 400)
}

// Emit members for an interface/class declaration, registering each member NODE in
// the declMap so a `.where()`-style reference can resolve straight to its row.
function emitMembers(
    members: ts.NodeArray<ts.TypeElement | ts.ClassElement>,
    symbolId: number, sf: ts.SourceFile, out: MemberRow[], ids: Ids, declMap: DeclMap,
): void {
    for (const m of members) {
        // skip private (#x or `private`) members — not public API
        if (hasModifier(m, ts.SyntaxKind.PrivateKeyword)) continue
        const name = memberName(m)
        if (!name || name.startsWith('#')) continue
        const sp = span(m, sf)
        const id = ids.next()
        out.push({
            id, symbol_id: symbolId, name, kind: memberKind(m),
            is_optional: (m as { questionToken?: unknown }).questionToken ? 1 : 0,
            is_static: hasModifier(m, ts.SyntaxKind.StaticKeyword) ? 1 : 0,
            visibility: 'internal',   // provisional — the publics-marking phase sets the real value
            signature: memberSignature(m, sf),
            ...sp, jsdoc: jsdocOf(m, sf),
        })
        declMap.set(m, { symbol_id: symbolId, member_id: id })
    }
}

function emitHeritage(node: ts.InterfaceDeclaration | ts.ClassDeclaration, symbolId: number, out: HeritageRow[], sf: ts.SourceFile): void {
    for (const clause of node.heritageClauses ?? []) {
        const relation = clause.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements'
        for (const t of clause.types) {
            const expr = t.expression
            const base = ts.isIdentifier(expr) ? expr.text
                : ts.isPropertyAccessExpression(expr) ? expr.name.text : null
            if (base) out.push({ symbol_id: symbolId, base_name: base, relation, commented: 0, simplified: 0 })
        }
        // Commented-out implements live INSIDE the clause text as /*Name<…>, …*/ —
        // deliberate gaps (types the compiler choked on). The AST drops them, so
        // parse the clause's raw text: strip generic args, then split on commas.
        if (relation === 'implements') {
            for (const block of clause.getText(sf).matchAll(/\/\*([^]*?)\*\//g)) {
                let body = block[1]!
                let prev: string
                do { prev = body; body = body.replace(/<[^<>]*>/g, '') } while (body !== prev)
                for (const entry of body.split(',')) {
                    const name = entry.trim().match(/^[A-Za-z_$][A-Za-z0-9_$]*/)?.[0]
                    if (name) out.push({ symbol_id: symbolId, base_name: name, relation: 'implements', commented: 1, simplified: 0 })
                }
            }
        }
    }
}

// Walk one source file's full AST recording call sites as edges `enclosing-scope →
// callee`. Enclosing scope is the nearest NAMED function / method / accessor / class;
// module top-level when none. callee_name is the literal identifier/member name (the
// name-based fallback); the callee token is also checker-resolved to its declaration
// row (resolved_*_id) so the call edge is exact, not just a name match.
function walkInvocations(sf: ts.SourceFile, moduleId: number, ids: Ids, out: InvocationRow[], checker: ts.TypeChecker, declMap: DeclMap): void {
    interface Scope { name: string | null, kind: string, startLine: number | null, endLine: number | null }
    const stack: Scope[] = []

    const nearestNamed = (): Scope => {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i]!.name) return stack[i]!
        }
        return { name: null, kind: 'top', startLine: null, endLine: null }
    }

    // The callee {token, name}: identifier for a plain call, the member-name node for
    // a method call. The token is what we hand the resolver. element-access /
    // parenthesised callees are skipped (no static name).
    const calleeOf = (expr: ts.Expression): { token: ts.Node, name: string } | null => {
        if (ts.isIdentifier(expr)) return { token: expr, name: expr.text }
        if (ts.isPropertyAccessExpression(expr)) return { token: expr.name, name: expr.name.text }
        return null
    }

    const push = (name: string, kind: InvocationRow['kind'], at: ts.Node, resolveTok: ts.Node | null): void => {
        const sc = nearestNamed()
        const pos = sf.getLineAndCharacterOfPosition(at.getStart(sf))
        const r = resolveTok ? resolveToken(checker, declMap, resolveTok) : null
        out.push({
            id: ids.next(), module_id: moduleId, caller_name: sc.name, caller_kind: sc.kind,
            caller_start_line: sc.startLine, caller_end_line: sc.endLine,
            callee_name: name, kind, line: pos.line + 1, col: pos.character + 1,
            resolved_symbol_id: r?.symbol_id ?? null, resolved_member_id: r?.member_id ?? null,
        })
    }

    const record = (callee: { token: ts.Node, name: string } | null, kind: InvocationRow['kind'], node: ts.Node): void => {
        if (!callee) return
        push(callee.name, kind, node, callee.token)
    }

    const scopeFor = (node: ts.Node): Scope | null => {
        // The enclosing scope's full span = the function/method/class the agent
        // should READ to see how the callee is used in context.
        const named = (name: string | null, kind: string): Scope => {
            const s = sf.getLineAndCharacterOfPosition(node.getStart(sf))
            const e = sf.getLineAndCharacterOfPosition(node.getEnd())
            return { name, kind, startLine: s.line + 1, endLine: e.line + 1 }
        }
        if (ts.isFunctionDeclaration(node)) return named(node.name?.text ?? null, 'function')
        if (ts.isMethodDeclaration(node)) return named(ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null, 'method')
        if (ts.isConstructorDeclaration(node)) return named('constructor', 'constructor')
        if (ts.isGetAccessorDeclaration(node)) return named(ts.isIdentifier(node.name) ? node.name.text : null, 'getter')
        if (ts.isSetAccessorDeclaration(node)) return named(ts.isIdentifier(node.name) ? node.name.text : null, 'setter')
        if (ts.isClassDeclaration(node)) return named(node.name?.text ?? null, 'class')
        if (ts.isFunctionExpression(node)) return named(node.name?.text ?? null, 'function')
        if (ts.isArrowFunction(node)) return named(null, 'arrow')
        return null
    }

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            record(calleeOf(node.expression), ts.isPropertyAccessExpression(node.expression) ? 'method' : 'call', node)
        } else if (ts.isNewExpression(node)) {
            const ctor = calleeOf(node.expression)
            record(ctor, 'new', node)
            // keyof-dispatch bridge: `new SqlOperation*ValueSource('_op', …)` stores
            // '_op' as `__operation: keyof Sql…` and later runs `sqlBuilder['_op'](…)`
            // via element access — a dynamic index the checker CANNOT resolve to a
            // method. Capture '_op' (the exact SqlBuilder method) at the construction
            // site, where the name is statically known, so the call chain can cross
            // the keyof. This edge stays name-only (resolved_* = NULL) by design.
            const arg0 = node.arguments?.[0]
            if (ctor && /^SqlOperation.*ValueSource/.test(ctor.name) && arg0 && ts.isStringLiteralLike(arg0) && arg0.text.startsWith('_')) {
                push(arg0.text, 'operation', node, null)
            }
        }
        const sc = scopeFor(node)
        if (sc) stack.push(sc)
        ts.forEachChild(node, visit)
        if (sc) stack.pop()
    }
    visit(sf)
}

// Walk one source file's top-level (and namespace) declarations. `inRange`, when
// given (the simplified master), keeps only declarations inside the BEGIN/END region.
function walkModule(
    sf: ts.SourceFile, moduleId: number, pub: PublicInfo,
    ids: Ids, symbols: SymbolRow[], members: MemberRow[], heritage: HeritageRow[], declMap: DeclMap,
    inRange?: (line: number) => boolean,
): void {
    const fileName = sf.fileName
    const isPublicName = (name: string): boolean => pub.publicKeys.has(`${fileName} ${name}`)
    const accept = (node: ts.Node): boolean => !inRange || inRange(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1)

    const visit = (node: ts.Node): void => {
        let name: string | null = null
        let kind: string | null = null
        let decl: ts.InterfaceDeclaration | ts.ClassDeclaration | null = null

        if (ts.isInterfaceDeclaration(node)) { name = node.name.text; kind = 'interface'; decl = node }
        else if (ts.isClassDeclaration(node) && node.name) { name = node.name.text; kind = 'class'; decl = node }
        else if (ts.isTypeAliasDeclaration(node)) { name = node.name.text; kind = 'type' }
        else if (ts.isEnumDeclaration(node)) { name = node.name.text; kind = 'enum' }
        else if (ts.isFunctionDeclaration(node) && node.name) { name = node.name.text; kind = 'function' }
        else if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
            node.body.statements.forEach(visit)   // descend into namespaces
            return
        } else if (ts.isVariableStatement(node)) {
            if (!accept(node)) return
            for (const d of node.declarationList.declarations) {
                if (ts.isIdentifier(d.name)) {
                    const vn = d.name.text
                    const sp = span(node, sf)
                    const id = ids.next()
                    symbols.push({
                        id, module_id: moduleId, name: vn, kind: 'const', is_abstract: 0,
                        is_exported: isExported(node) ? 1 : 0, is_public: isPublicName(vn) ? 1 : 0,
                        is_public_surface: 0,   // provisional — set by the publics-marking phase
                        exported_name: isPublicName(vn) ? vn : null, ...sp, jsdoc: jsdocOf(node, sf),
                    })
                    // Register the VariableDeclaration node (what the symbol resolves to), not the statement.
                    declMap.set(d, { symbol_id: id, member_id: null })
                }
            }
            return
        }

        if (!name || !kind || !accept(node)) return
        const sp = span(node, sf)
        const symId = ids.next()
        symbols.push({
            id: symId, module_id: moduleId, name, kind,
            is_abstract: kind === 'class' && hasModifier(node, ts.SyntaxKind.AbstractKeyword) ? 1 : 0,
            is_exported: isExported(node) ? 1 : 0, is_public: isPublicName(name) ? 1 : 0,
            is_public_surface: 0,   // provisional — set by the publics-marking phase
            exported_name: isPublicName(name) ? name : null, ...sp, jsdoc: jsdocOf(node, sf),
        })
        declMap.set(node, { symbol_id: symId, member_id: null })
        if (decl) {
            emitMembers(decl.members, symId, sf, members, ids, declMap)
            emitHeritage(decl, symId, heritage, sf)
        }
    }

    sf.statements.forEach(visit)
}

// BEGIN/END region of the simplified master → predicate "is this line inside it?".
// The master uses page-less `// BEGIN` / `// END` markers; everything outside (the
// makeCompilerHappy ValueSource merge + noop aliases) is compiler scaffolding.
function masterRange(sf: ts.SourceFile): (line: number) => boolean {
    const lines = sf.text.split('\n')
    let begin = 0, end = lines.length + 1
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i]!.trim()
        if (t === '// BEGIN') begin = i + 1
        else if (t === '// END') { end = i + 1; break }
    }
    return (line: number) => line > begin && line < end
}

export function extractSrc(program: ts.Program, checker: ts.TypeChecker, ids: Ids): SrcExtract {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
        exports: Record<string, { types?: string } | string>
    }
    const entries: { subpath: string, src: string }[] = []
    for (const [subpath, val] of Object.entries(pkg.exports)) {
        if (subpath.includes('*') || subpath === './package.json') continue
        const types = typeof val === 'string' ? undefined : val.types
        if (!types) continue
        entries.push({ subpath, src: 'src/' + types.replace(/^\.\//, '').replace(/\.d\.ts$/, '.ts') })
    }
    const pub = computePublic(program, checker, entries)

    const modules: ModuleRow[] = []
    const symbols: SymbolRow[] = []
    const members: MemberRow[] = []
    const heritage: HeritageRow[] = []
    const invocations: InvocationRow[] = []
    const declMap: DeclMap = new Map()

    // The src/ files we index (the master is one of them, special-cased below).
    interface SrcFile { sf: ts.SourceFile, rel: string, area: string, moduleId: number, isMaster: boolean }
    const srcFiles: SrcFile[] = []

    // Pass 1 — modules + symbols/members/heritage + declMap, over every src/ file.
    for (const sf of program.getSourceFiles()) {
        const abs = sf.fileName
        if (abs.endsWith('.d.ts')) continue
        const rel = relative(process.cwd(), abs)
        if (!rel.startsWith('src/') || isIgnoredSrc(rel)) continue
        const isMaster = rel === SIMPLIFIED
        const after = rel.slice('src/'.length)
        const area = isMaster ? 'simplified' : (after.includes('/') ? after.split('/')[0]! : 'root')
        const subpath = isMaster ? null : (pub.moduleSubpath.get(abs) ?? null)
        const moduleId = ids.next()
        modules.push({
            id: moduleId, path: rel, area,
            is_public: subpath ? 1 : 0, export_subpath: subpath,
            zone: isMaster ? 'simplified' : (subpath ? zoneOf(subpath) : null),
        })
        srcFiles.push({ sf, rel, area, moduleId, isMaster })
        // The master: empty public surface (its names live in its own pseudo-namespace),
        // restricted to the BEGIN/END region.
        if (isMaster) {
            const simpPub: PublicInfo = { publicKeys: new Set(), moduleSubpath: new Map() }
            walkModule(sf, moduleId, simpPub, ids, symbols, members, heritage, declMap, masterRange(sf))
        } else {
            walkModule(sf, moduleId, pub, ids, symbols, members, heritage, declMap)
        }
    }

    // Pass 2 — the LIBRARY-INTERNAL call graph (for the private→public chain), now
    // that declMap is complete so callees resolve. Example files are leaf consumers
    // (their usage is the examples dimension) and the simplified master has no runtime
    // — both excluded to keep the graph to real library code.
    for (const { sf, area, moduleId } of srcFiles) {
        if (area === 'examples' || area === 'simplified') continue
        walkInvocations(sf, moduleId, ids, invocations, checker, declMap)
    }

    // ── publics-marking phase ────────────────────────────────────────────────
    // Now that every symbol and member is known, derive the public-surface flags in
    // one place. RULE (per the architecture): only functions exposed by a PUBLIC
    // INTERFACE are public. A public interface is an `interface` that is directly
    // exported (is_public) OR lives in the fluent-API area 'expressions' / the curated
    // 'simplified' map — reached through the public connection methods even though the
    // module itself isn't directly importable. From that:
    //   symbol.is_public_surface = directly importable OR is such an interface.
    //   member.visibility = 'public'      (declared on a public interface — the contract),
    //                       'public_impl' (a CLASS method whose name a public interface
    //                                      exposes — public by implementation),
    //                       'internal'    (declared on no public interface, e.g. __addOrderBy).
    const areaById = new Map<number, string>(modules.map(m => [m.id, m.area]))
    const isPublicIface = (s: SymbolRow): boolean => {
        if (s.kind !== 'interface') return false
        if (s.is_public === 1) return true
        const area = areaById.get(s.module_id)
        return area === 'expressions' || area === 'simplified'
    }
    const publicIfaceIds = new Set<number>()
    for (const s of symbols) {
        const pubIface = isPublicIface(s)
        s.is_public_surface = (s.is_public === 1 || pubIface) ? 1 : 0
        if (pubIface) publicIfaceIds.add(s.id)
    }
    const publicMemberNames = new Set<string>()
    for (const mb of members) if (publicIfaceIds.has(mb.symbol_id)) publicMemberNames.add(mb.name)
    const kindById = new Map<number, string>(symbols.map(s => [s.id, s.kind]))
    for (const mb of members) {
        mb.visibility = publicIfaceIds.has(mb.symbol_id) ? 'public'
            : (kindById.get(mb.symbol_id) === 'class' && publicMemberNames.has(mb.name)) ? 'public_impl'
                : 'internal'
    }

    return { modules, symbols, members, heritage, invocations, declMap }
}
