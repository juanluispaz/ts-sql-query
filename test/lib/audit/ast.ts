// Small AST helpers shared by the content checks.

import ts from 'typescript'

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

// 1-based lines of every COMMENT whose text matches `marker`. Comment-scoped
// (TS scanner), so a string or live code that merely mentions the text is never
// matched. A multi-line comment is recorded at its start line.
export function markerLines(sf: ts.SourceFile, marker: RegExp): Set<number> {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, sf.text)
    const lines = new Set<number>()
    let tok = scanner.scan()
    while (tok !== ts.SyntaxKind.EndOfFileToken) {
        if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
            if (marker.test(scanner.getTokenText())) {
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

// Is `node` inside a test whose span carries one of the `markerLines`? "Span"
// is the enclosing test call's body PLUS the 3 lines immediately above it (a
// marker sitting on the comment line(s) just above the `test(...)`). The caller
// chooses which marker set to pass:
//   - NOT-APPLICABLE ∪ TODO[BUG]  → the `mock-only` / `skip-real-db` carve-out
//     (a dialect boundary, or a bug repro that stays mock-only until fixed);
//   - TODO[BUG] alone             → the `as-any` / `any-type` / meaningless-cast
//     / meaningless-type carve-out (a bug repro may need a type bypass to compile).
// `TODO[LIMITATION]` licenses neither.
export function isNodeInMarkedTest(node: ts.Node, sf: ts.SourceFile, markerLineSet: Set<number>): boolean {
    if (markerLineSet.size === 0) return false
    const call = enclosingTestCall(node)
    if (!call) return false
    const start = sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1
    const end = sf.getLineAndCharacterOfPosition(call.getEnd()).line + 1
    for (const l of markerLineSet) if (l >= start - 3 && l <= end) return true
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
