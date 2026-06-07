// Rule `non-deterministic-input` — a non-deterministic JS value used as test data.
//
// `new Date()` (no argument), `Date.now()`, `Math.random()` produce a different
// value on every run. Used as a QUERY INPUT (a parameter / value source) they
// make the emitted params — and the snapshot — non-deterministic, so the test
// either can't have a stable param snapshot or silently drifts. A fixed
// `new Date('2024-01-02T03:04:05Z')` (with arguments) is deterministic and NOT
// flagged.
//
// Carve-out — MOCK DATA (project decision): the same constructors are legitimate
// as the value the MOCK returns, simulating what the database produces for its
// own `current_date` / `current_timestamp` / `random()` (probing the DB
// equivalents). That value flows through `mockNext(...)` — directly
// (`ctx.mockNext({ createdAt: new Date() })`) or via a variable passed to it
// (`const expected = [{ today: new Date() }]; ctx.mockNext(expected)`). Such uses
// are tolerated; everything else (a value reaching the query builder) is flagged.
//
// Engine: AST, no type checker. Anchor 0 — every `new Date()` in the suite today
// is mock data; a clean preventive gate against a non-deterministic input.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

// Identifier names passed (anywhere) inside a `*.mockNext(...)` call — the
// variables that carry mock data, e.g. `expected` in `mockNext(expected)`.
function mockNextArgNames(sf: ts.SourceFile): Set<string> {
    const names = new Set<string>()
    const visit = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'mockNext') {
            for (const arg of n.arguments) {
                const collect = (m: ts.Node): void => {
                    if (ts.isIdentifier(m)) names.add(m.text)
                    ts.forEachChild(m, collect)
                }
                collect(arg)
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return names
}

// Is `node` an argument (transitively) to a `mockNext(...)` call?
function insideMockNext(node: ts.Node): boolean {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === 'mockNext') return true
        p = p.parent
    }
    return false
}

// The name of the nearest enclosing variable declaration, or null.
function enclosingVarName(node: ts.Node): string | null {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
        p = p.parent
    }
    return null
}

// The non-deterministic constructors: `new Date()` (no args), `Date.now()`,
// `Math.random()`.
function nonDeterministicKind(n: ts.Node): string | null {
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Date'
        && (!n.arguments || n.arguments.length === 0)) return 'new Date()'
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression)) {
        const obj = n.expression.expression.text, m = n.expression.name.text
        if (obj === 'Date' && m === 'now') return 'Date.now()'
        if (obj === 'Math' && m === 'random') return 'Math.random()'
    }
    return null
}

export function checkNonDeterministicInput(sf: ts.SourceFile, file: string): Finding[] {
    const mockVars = mockNextArgNames(sf)
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        const kind = nonDeterministicKind(n)
        if (kind) {
            const varName = enclosingVarName(n)
            const isMockData = insideMockNext(n) || (varName !== null && mockVars.has(varName))
            if (!isMockData) {
                out.push({
                    rule: 'non-deterministic-input',
                    file,
                    line: lineOf(sf, n),
                    message: `\`${kind}\` is non-deterministic — used as a query input it makes the emitted params (and the snapshot) change every run. Use a fixed value (\`new Date('2024-01-02T03:04:05Z')\`). The constructor is allowed only as MOCK data (passed to \`mockNext\`) simulating the database's own \`current_date\` / \`random()\``,
                })
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
