// Schema-v4 extra dimensions, kept out of extractSrc.ts to keep that file focused:
//
//   - version_gate : compatibility-version comparisons in the SqlBuilders (case E).
//   - sql_emit     : SQL string literals emitted by the SqlBuilders (the build-side
//                    bridge for `--emits-keyword`, case D/F).
//   - producer     : public members whose RETURN TYPE resolves to an indexed symbol —
//                    "what call returns a receiver of this type" (case B).
//   - bug_marker   : `// TODO[BUG]` markers across the test matrix (case C/D/F).
//
// All read the UNIFIED program (owned by build.ts); nothing is parsed in isolation.
// version_gate / sql_emit / producer reuse the declMap built by extractSrc (so a
// producer's return type resolves to our symbol rows). bug_marker is a plain comment scan.

import ts from 'typescript'
import { relative } from 'node:path'
import { cellOf } from './extractTests.js'
import type { DeclMap } from './resolve.js'
import type { EmittedSqlRow, Ids, ModuleRow, ProducerRow, SqlEmitRow, TodoMarkerRow, VersionGateRow } from './model.js'

export interface ExtrasExtract {
    versionGates: VersionGateRow[]
    sqlEmits: SqlEmitRow[]
    producers: ProducerRow[]
}

const OP_TEXT: Partial<Record<ts.SyntaxKind, string>> = {
    [ts.SyntaxKind.LessThanToken]: '<',
    [ts.SyntaxKind.LessThanEqualsToken]: '<=',
    [ts.SyntaxKind.GreaterThanToken]: '>',
    [ts.SyntaxKind.GreaterThanEqualsToken]: '>=',
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: '===',
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: '!==',
    [ts.SyntaxKind.EqualsEqualsToken]: '==',
    [ts.SyntaxKind.ExclamationEqualsToken]: '!=',
}

// Per-db compatibility-version fields the SqlBuilders branch on. A property access whose
// trailing name is one of these, compared against a numeric literal, is a version gate.
const VERSION_FIELDS = new Set(['compatibilityVersion'])

interface Scope { name: string | null, startLine: number | null, endLine: number | null }

// Track the nearest NAMED enclosing function/method/accessor while walking, and run
// `onNode` for every node with that scope — the shared spine for version_gate + sql_emit.
function walkWithScope(sf: ts.SourceFile, onNode: (node: ts.Node, scope: Scope) => void): void {
    const stack: Scope[] = []
    const nearest = (): Scope => {
        for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.name) return stack[i]!
        return { name: null, startLine: null, endLine: null }
    }
    const scopeFor = (node: ts.Node): Scope | null => {
        const at = (name: string | null): Scope => {
            const s = sf.getLineAndCharacterOfPosition(node.getStart(sf))
            const e = sf.getLineAndCharacterOfPosition(node.getEnd())
            return { name, startLine: s.line + 1, endLine: e.line + 1 }
        }
        if (ts.isFunctionDeclaration(node)) return at(node.name?.text ?? null)
        if (ts.isMethodDeclaration(node)) return at(ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null)
        if (ts.isGetAccessorDeclaration(node)) return at(ts.isIdentifier(node.name) ? node.name.text : null)
        if (ts.isSetAccessorDeclaration(node)) return at(ts.isIdentifier(node.name) ? node.name.text : null)
        if (ts.isConstructorDeclaration(node)) return at('constructor')
        if (ts.isFunctionExpression(node)) return at(node.name?.text ?? null)
        return null
    }
    const visit = (node: ts.Node): void => {
        onNode(node, nearest())
        const sc = scopeFor(node)
        if (sc) stack.push(sc)
        ts.forEachChild(node, visit)
        if (sc) stack.pop()
    }
    visit(sf)
}

// A SQL-ish string literal worth indexing: has at least one letter and either a space or
// a `(` (so it reads like a clause/fragment, not a one-char separator or identifier).
function looksLikeSql(text: string): boolean {
    if (!/[a-zA-Z]/.test(text)) return false
    return text.includes(' ') || text.includes('(') || text.length >= 4
}

// Resolve a return-type node to the indexed symbol it produces (the interface/class the
// caller gets back), via the declMap. Null when it resolves outside the lib or to `this`/primitive.
function producedSymbolId(checker: ts.TypeChecker, declMap: DeclMap, typeNode: ts.TypeNode): number | null {
    let type: ts.Type
    try { type = checker.getTypeAtLocation(typeNode) } catch { return null }
    const sym = type.aliasSymbol ?? type.getSymbol()
    if (!sym) return null
    for (const d of sym.declarations ?? []) {
        const row = declMap.get(d)
        if (row && row.member_id === null) return row.symbol_id
    }
    return null
}

// version_gate + sql_emit + producer, over src/ (moduleIdByPath gives each file its module row).
export function extractExtras(
    program: ts.Program, checker: ts.TypeChecker, declMap: DeclMap,
    modules: ModuleRow[], ids: Ids,
): ExtrasExtract {
    const versionGates: VersionGateRow[] = []
    const sqlEmits: SqlEmitRow[] = []
    const producers: ProducerRow[] = []
    const moduleByPath = new Map<string, ModuleRow>(modules.map(m => [m.path, m]))

    for (const sf of program.getSourceFiles()) {
        if (sf.fileName.endsWith('.d.ts')) continue
        const rel = relative(process.cwd(), sf.fileName)
        const mod = moduleByPath.get(rel)
        if (!mod) continue
        if (mod.area === 'examples' || mod.area === 'simplified') continue
        const isSqlBuilder = mod.area === 'sqlBuilders'

        walkWithScope(sf, (node, scope) => {
            // version_gate: <prop>.compatibilityVersion <op> <number>
            if (ts.isBinaryExpression(node) && OP_TEXT[node.operatorToken.kind]) {
                const sides: [ts.Expression, ts.Expression] = [node.left, node.right]
                for (let s = 0; s < 2; s++) {
                    const fieldExpr = sides[s]!, otherExpr = sides[1 - s]!
                    if (ts.isPropertyAccessExpression(fieldExpr) && VERSION_FIELDS.has(fieldExpr.name.text)
                        && ts.isNumericLiteral(otherExpr)) {
                        const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf))
                        const op = OP_TEXT[node.operatorToken.kind]!
                        // operator is written as left<op>right; if the field is on the right, mirror it.
                        const mirror: Record<string, string> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '===': '===', '!==': '!==', '==': '==', '!=': '!=' }
                        versionGates.push({
                            id: ids.next(), module_id: mod.id, scope_name: scope.name,
                            scope_start_line: scope.startLine, scope_end_line: scope.endLine,
                            field: fieldExpr.name.text, operator: s === 0 ? op : (mirror[op] ?? op),
                            breakpoint: otherExpr.getText(sf), line: pos.line + 1, col: pos.character + 1,
                        })
                        break
                    }
                }
            }
            // sql_emit: SQL-ish string literals inside the SqlBuilders.
            if (isSqlBuilder && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
                const text = node.text
                if (looksLikeSql(text)) {
                    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf))
                    sqlEmits.push({
                        id: ids.next(), module_id: mod.id, scope_name: scope.name,
                        scope_start_line: scope.startLine, scope_end_line: scope.endLine,
                        literal: text, literal_lc: text.toLowerCase(), line: pos.line + 1, col: pos.character + 1,
                    })
                }
            }
        })
    }

    // producer: member declarations with a return type that resolves to an indexed symbol.
    for (const [node, row] of declMap) {
        if (row.member_id === null) continue
        const typeNode = (node as { type?: ts.TypeNode }).type
        if (!typeNode || !ts.isTypeNode(typeNode)) continue
        if (!(ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isGetAccessor(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node))) continue
        const produced = producedSymbolId(checker, declMap, typeNode)
        if (produced === null || produced === row.symbol_id) continue   // skip unresolved + self-returns
        producers.push({ member_id: row.member_id, produces_symbol_id: produced })
    }

    return { versionGates, sqlEmits, producers }
}

// ── emitted_sql: the asserted SQL snapshots in test + documentation cells ────
// A toMatchInlineSnapshot whose argument reads like SQL. The matching test_block / doc_test_block
// is recovered by the searcher via file + line-containment, so no block FK is stored here.
const SQL_START = /^(select|insert|update|delete|with|create|drop|alter|truncate|begin|commit|rollback|savepoint|merge|set\s)/i
function sqlFromSnapshot(arg: ts.Node): string | null {
    if (!ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg)) return null
    // The snapshot text is the SQL wrapped in quotes (e.g. `"select … from …"`); strip them.
    const cleaned = arg.text.replace(/^\s*"/, '').replace(/"\s*$/, '').trim()
    return SQL_START.test(cleaned) ? cleaned : null
}
export function extractEmittedSql(program: ts.Program, ids: Ids): EmittedSqlRow[] {
    const out: EmittedSqlRow[] = []
    for (const sf of program.getSourceFiles()) {
        if (!sf.fileName.endsWith('.test.ts')) continue
        const rel = relative(process.cwd(), sf.fileName)
        const cell = cellOf(rel)
        if (!cell) continue
        const source: EmittedSqlRow['source'] = cell.connector === 'documentation' ? 'doc' : 'test'
        const visit = (node: ts.Node): void => {
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
                && node.expression.name.text === 'toMatchInlineSnapshot' && node.arguments[0]) {
                const sql = sqlFromSnapshot(node.arguments[0]!)
                if (sql) {
                    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
                    out.push({ id: ids.next(), source, file: rel, line, sql })
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sf)
    }
    return out
}

// ── todo_marker: ALL // TODO[...] across test files (a plain comment scan) ────
// Captures every // TODO with its bracketed modifier as `tag` (BUG, PERF, … or null for a
// bare // TODO). --bugs filters to tag='BUG'; the rest are indexed for completeness.
export function extractTodoMarkers(program: ts.Program, ids: Ids): TodoMarkerRow[] {
    const out: TodoMarkerRow[] = []
    const RE = /\/\/\s*TODO(?:\s*\[([^\]]*)\])?\s*:?\s*(.*)$/
    for (const sf of program.getSourceFiles()) {
        if (sf.fileName.endsWith('.d.ts')) continue
        const rel = relative(process.cwd(), sf.fileName)
        if (!rel.startsWith('test/')) continue
        const lines = sf.text.split('\n')
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i]!.match(RE)
            if (!m) continue
            const tag = m[1] !== undefined ? m[1].trim() : null
            out.push({ id: ids.next(), file: rel, line: i + 1, tag: tag || null, text: m[2]!.trim(), scope: null })
        }
    }
    return out
}
