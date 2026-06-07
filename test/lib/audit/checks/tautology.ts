// Rule `tautology` — a vacuously-true assertion that validates nothing.
//
// The general question "is this assertion meaningful?" is unbounded and belongs
// to the quality-gate sub-agent. This rule stays MECHANICAL: it flags only the
// handful of shapes that are provably constant by language rule, never a
// judgement about whether a real assertion is strong enough. Three forms:
//
//   - literal-self-compare  `expect(<lit>).toBe(<same lit>)` — comparing a
//                           literal to an equal literal (`expect(true).toBe(true)`,
//                           `expect(1).toEqual(1)`). Always passes.
//   - same-expression       `expect(x).toBe(x)` — the SAME pure reference
//                           (identifier / property / element access, no call) on
//                           both sides. Always passes (no value is pinned).
//   - length-non-negative   `expect(<x>.length).toBeGreaterThanOrEqual(0)` — an
//                           array/string `.length` is always ≥ 0 by language
//                           rule, so the bound is vacuous (it was once a real
//                           mirror-image weakening: `else expect(rows.length)
//                           .toBeGreaterThanOrEqual(0)`).
//
// Engine: AST (no type checker). `.not` chains are naturally excluded (the
// matcher's receiver is then `expect(x).not`, not the `expect(x)` call itself),
// as are `toBeGreaterThanOrEqual(0)` on a non-`.length` value (a real, if weak,
// non-negativity bound the audit cannot prove constant — `month`, an affected
// count — stays unflagged).

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

const EQ_MATCHERS = new Set(['toBe', 'toEqual', 'toStrictEqual'])

// A canonical key for a literal whose value is fixed at parse time, or null if
// the node is not such a literal. Two nodes are equal-by-value iff their keys match.
function literalKey(n: ts.Expression): string | null {
    if (ts.isNumericLiteral(n)) return 'num:' + n.text
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return 'str:' + n.text
    if (n.kind === ts.SyntaxKind.TrueKeyword) return 'bool:true'
    if (n.kind === ts.SyntaxKind.FalseKeyword) return 'bool:false'
    if (n.kind === ts.SyntaxKind.NullKeyword) return 'null'
    // `-1`, `+2` etc. — a unary on a numeric literal is still a fixed value.
    if (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand)
        && (n.operator === ts.SyntaxKind.MinusToken || n.operator === ts.SyntaxKind.PlusToken)) {
        return 'num:' + (n.operator === ts.SyntaxKind.MinusToken ? '-' : '') + n.operand.text
    }
    return null
}

// A "pure reference" — an identifier or a property/element-access chain rooted in
// one, with no call anywhere. Reading it twice yields the same value, so
// `expect(x).toBe(x)` on it is vacuous. A call (`expect(f()).toBe(f())`) is NOT
// pure (the two calls could differ) and is excluded.
function isPureRef(n: ts.Expression): boolean {
    if (ts.isIdentifier(n)) return true
    if (ts.isPropertyAccessExpression(n)) return isPureRef(n.expression)
    if (ts.isElementAccessExpression(n)) return isPureRef(n.expression)
    if (ts.isNonNullExpression(n)) return isPureRef(n.expression)
    if (ts.isParenthesizedExpression(n)) return isPureRef(n.expression)
    return false
}

// `<x>.length` — the property whose value the language guarantees to be ≥ 0.
function isLengthAccess(n: ts.Expression): boolean {
    return ts.isPropertyAccessExpression(n) && n.name.text === 'length'
}

// The `expect(<actual>)` call a matcher property hangs off, or null.
function expectActual(receiver: ts.Expression): ts.Expression | null {
    if (!ts.isCallExpression(receiver)) return null
    if (!ts.isIdentifier(receiver.expression) || receiver.expression.text !== 'expect') return null
    return receiver.arguments[0] ?? null
}

export function checkTautologies(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const flag = (n: ts.Node, message: string): void => {
        out.push({ rule: 'tautology', file, line: lineOf(sf, n), message })
    }

    const visit = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
            const matcher = n.expression.name.text
            const actual = expectActual(n.expression.expression)
            if (actual) {
                if (EQ_MATCHERS.has(matcher) && n.arguments.length === 1) {
                    const expected = n.arguments[0]!
                    const ak = literalKey(actual), ek = literalKey(expected)
                    if (ak !== null && ek !== null && ak === ek) {
                        flag(n, `\`expect(${actual.getText(sf)}).${matcher}(${expected.getText(sf)})\` compares a literal to the same literal — it always passes and validates nothing. Assert the actual computed value instead`)
                    } else if (isPureRef(actual) && isPureRef(expected) && actual.getText(sf) === expected.getText(sf)) {
                        flag(n, `\`expect(${actual.getText(sf)}).${matcher}(${expected.getText(sf)})\` compares a value to itself — it always passes and pins nothing. Assert against the expected value, not the same expression`)
                    }
                } else if (matcher === 'toBeGreaterThanOrEqual' && n.arguments.length === 1
                    && literalKey(n.arguments[0]!) === 'num:0' && isLengthAccess(actual)) {
                    flag(n, `\`expect(${actual.getText(sf)}).toBeGreaterThanOrEqual(0)\` is vacuous — a \`.length\` is always ≥ 0. Assert the exact length (\`.toBe(n)\`) or the actual contents`)
                }
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
