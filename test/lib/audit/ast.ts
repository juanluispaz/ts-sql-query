// Small AST helpers shared by the content checks.

import ts from 'typescript'
import { NOT_APPLICABLE_REASON } from './reasons.js'

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

// 1-based lines carrying a `// NOT-APPLICABLE: <reason>` marker. Comment-scoped
// (TS scanner), so a string mentioning the text is never matched.
export function notApplicableMarkerLines(sf: ts.SourceFile): Set<number> {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, sf.text)
    const lines = new Set<number>()
    let tok = scanner.scan()
    while (tok !== ts.SyntaxKind.EndOfFileToken) {
        if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
            if (NOT_APPLICABLE_REASON.test(scanner.getTokenText())) {
                lines.add(sf.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1)
            }
        }
        tok = scanner.scan()
    }
    return lines
}

const RUNNER_ROOTS = new Set(['test', 'it', 'describe'])

// The leftmost identifier of a call's callee chain (`test.skipIf` → `test`).
function callRunnerRoot(call: ts.CallExpression): string | null {
    let cur: ts.Expression = call.expression
    while (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur)) cur = cur.expression
    return ts.isIdentifier(cur) ? cur.text : null
}

// The enclosing `test(...)` / `it(...)` / `describe(...)` registration call,
// returning the OUTERMOST consecutive runner-rooted call so the `.skipIf(cond)(…)`
// double-call form includes the body span (not just the `skipIf(cond)` slice). We
// return on the FIRST runner match while climbing, so a `describe` wrapper around
// the test is never reached.
function enclosingTestCall(node: ts.Node): ts.CallExpression | undefined {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if (ts.isCallExpression(p) && callRunnerRoot(p) !== null && RUNNER_ROOTS.has(callRunnerRoot(p)!)) {
            let call = p
            while (call.parent && ts.isCallExpression(call.parent) && call.parent.expression === call
                && callRunnerRoot(call.parent) !== null) {
                call = call.parent
            }
            return call
        }
        p = p.parent
    }
    return undefined
}

// Is `node` inside a test marked `// NOT-APPLICABLE: <reason>`? The marker must
// sit within the enclosing test's span (its body) or within 3 lines above its
// first line. NOT-APPLICABLE means a deliberate dialect boundary — the test runs
// and validates in the dialects that support it — so a LIVE test carrying it is
// allowed to be mock-only here (the `mock-only` / `skip-real-db` carve-out). Keyed
// on NOT-APPLICABLE specifically: a `TODO[*]` implies pending work and does NOT
// license a permanently mock-only live test.
export function isNotApplicableTest(node: ts.Node, sf: ts.SourceFile, naLines: Set<number>): boolean {
    if (naLines.size === 0) return false
    const call = enclosingTestCall(node)
    if (!call) return false
    const start = sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1
    const end = sf.getLineAndCharacterOfPosition(call.getEnd()).line + 1
    for (const l of naLines) if (l >= start - 3 && l <= end) return true
    return false
}

function within(root: ts.Node | undefined, target: ts.Node): boolean {
    if (!root) return false
    let x: ts.Node | undefined = target
    while (x) { if (x === root) return true; x = x.parent }
    return false
}

// Is `node` inside the branch of an `if (… realDbEnabled …)` that runs when the
// real DB is ENABLED — the THEN of `if (ctx.realDbEnabled)` or the ELSE of
// `if (!ctx.realDbEnabled)`? The real engine produces non-deterministic output
// (float rounding, environment data), so the rules that allow approximate
// matching there (the `mirror-image` APPROX_VALUE remedy) use this. The
// two-sided `if/else` form only — an early-return real-only guard is
// `one-sided-guard`'s concern.
export function isInRealBranch(node: ts.Node): boolean {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if (ts.isIfStatement(p) && /realDbEnabled/.test(p.expression.getText())) {
            const negated = ts.isPrefixUnaryExpression(p.expression) && p.expression.operator === ts.SyntaxKind.ExclamationToken
            if (within(p.thenStatement, node)) return !negated
            if (within(p.elseStatement, node)) return negated
        }
        p = p.parent
    }
    return false
}
