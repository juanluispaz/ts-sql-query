// Rule `no-op-expect` — an `expect(...)` chain with no matcher invoked.
//
// `expect(x)` (or `expect(x).not`, `await expect(p).rejects`) AS A STATEMENT
// builds a matcher object and then does nothing with it — it looks like an
// assertion but validates nothing and always passes. It is the classic "forgot
// the matcher" footgun, and it slips past `no-assertion-runtime`: that rule
// counts an `expect` call as an assertion, so a test whose only `expect` is a
// no-op reads as "has an assertion" when it has none. There is no legitimate
// committed use.
//
// Engine: AST, no type checker. A statement-level expression (through an optional
// `await`) that is either a bare `expect(...)` call or an `expect(...)` property
// chain (`.not` / `.resolves` / `.rejects` / a matcher name) with no final call.
// A real matcher call — `expect(x).toBe(1)`, `await expect(p).rejects.toThrow()`
// — is a CallExpression whose callee is the matcher property, so it is fine.
// Anchor 0 — a clean preventive gate.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

// Does this expression chain bottom out in an `expect(...)` call?
function rootedInExpect(expr: ts.Expression): boolean {
    let cur: ts.Expression = expr
    while (true) {
        if (ts.isCallExpression(cur) && ts.isIdentifier(cur.expression) && cur.expression.text === 'expect') return true
        if (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur)) { cur = cur.expression; continue }
        return false
    }
}

export function checkNoOpExpect(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        if (ts.isExpressionStatement(n)) {
            let e: ts.Expression = n.expression
            if (ts.isAwaitExpression(e)) e = e.expression
            // bare `expect(...)` call — no matcher at all
            const bare = ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'expect'
            // `expect(...).<prop>` chain with no final matcher call (`.not`, `.rejects`, a matcher name)
            const danglingChain = ts.isPropertyAccessExpression(e) && rootedInExpect(e)
            if (bare || danglingChain) {
                out.push({
                    rule: 'no-op-expect',
                    file,
                    line: lineOf(sf, n),
                    message: 'this `expect(...)` invokes no matcher — it builds a matcher object and does nothing, so it asserts nothing and always passes (the "forgot the matcher" footgun). Call a matcher (`toEqual`, `toThrow`, `rejects.toThrow`, …) or remove it',
                })
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
