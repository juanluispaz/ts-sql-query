// Small AST helpers shared by the content checks.

import ts from 'typescript'

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
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
