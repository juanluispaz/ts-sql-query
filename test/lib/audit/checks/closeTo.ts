// Rule `close-to` — an approximate float comparison (`toBeCloseTo`) used where an
// exact assertion is expected.
//
// `toBeCloseTo` is the right tool in ONE place: a real-DB branch
// (`if (ctx.realDbEnabled) { … }`), where the real engine's floating-point
// rounding can yield `1.999999…` instead of exactly `2` (e.g. `cbrt` emulated as
// `sign(x) * power(abs(x), 1.0/3.0)`). It is the `mirror-image` APPROX_VALUE
// remedy — a valid value assertion against the real engine. Outside a real-DB
// branch the value comes from the mock, which returns exactly what `mockNext`
// set, so an exact `toBe` pins it; an approximate comparison there hides a value.
//
// This is kept as its OWN rule — deliberately separate from `weak-matcher` — so
// the stricter weak-matcher family (asymmetric matchers, `.toContain`/`.toMatch`
// on a value) can be promoted independently without this more lenient,
// real-branch-aware float case diluting it.
//
// Engine: AST, no type checker. Real-DB branch via the shared `isInRealBranch`.
// Anchor: 0 today (all 107 `toBeCloseTo` sit in a real-DB branch) — a clean
// preventive gate.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf, isInRealBranch } from '../ast.js'

export function checkCloseTo(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
            && n.expression.name.text === 'toBeCloseTo' && !isInRealBranch(n)) {
            out.push({
                rule: 'close-to',
                file,
                line: lineOf(sf, n),
                message: '`toBeCloseTo` is an approximate float comparison — warranted only against the real engine (a real-DB branch), where floating-point rounding can yield `1.999999…`. Here it is outside a real-DB branch, so the value comes from the mock (exactly what `mockNext` set): pin it with `toBe`. If a genuine float needs approximating in both modes, guard the approximate assertion behind `if (ctx.realDbEnabled)`',
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
