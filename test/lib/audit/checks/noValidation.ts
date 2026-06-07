// Rules for a test that does not actually validate anything — three mechanical
// shapes, split into three rule ids so each tunes severity independently:
//
//   - `no-assertion-runtime`  a `test`/`it` that runs a query (calls an
//                             `execute*` method) but contains NO assertion at all
//                             (`expect` / `assertType` / `expectTypeOf` /
//                             `toThrow`). It runs the query and checks nothing —
//                             always green. (A pure type-demonstration test with
//                             no `execute*` call is compiler-gated and NOT
//                             flagged: it asserts by compiling.)
//   - `empty-catch`           an empty `catch { }` swallows its error
//                             unconditionally, so the guarded code can never fail
//                             the test. Carve-out (project decision): a
//                             DELIBERATE `throw` inside the try block — the catch
//                             is swallowing the test's OWN intentional throw, the
//                             mechanism of the scenario (e.g. `throw` to force a
//                             rollback while testing `executeAfterNextRollback`).
//                             A `catch { }` around an `execute*` with no such
//                             throw is NOT exempt: swallowing a real execution
//                             failure to assert only the interceptor-captured SQL
//                             is a mock-only pattern (you could validate that on
//                             the mock without the swallow). The conditional
//                             swallow `catch { if (!realDbEnabled) throw e }` is
//                             the `mock-only` rule's job (it is not an empty body).
//   - `weak-boolean`          `expect(x).toBeTruthy()` / `toBeFalsy()` — pins
//                             only truthiness, not the value. Assert the exact
//                             value (`toBe(true)` / the real result).
//
// Engine: AST, no type checker.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

const TEST_FNS = new Set(['test', 'it'])
const ASSERT_FNS = new Set(['expect', 'assertType', 'expectTypeOf'])
const THROW_MATCHERS = new Set(['toThrow', 'toThrowError'])
const WEAK_BOOL = new Set(['toBeTruthy', 'toBeFalsy'])

// The callback body of a `test(...)` / `it(...)` call, or null.
function testCallbackBody(n: ts.CallExpression): ts.Node | null {
    if (!ts.isIdentifier(n.expression) || !TEST_FNS.has(n.expression.text)) return null
    const cb = n.arguments.find(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a))
    return cb && (cb as ts.ArrowFunction | ts.FunctionExpression).body ? (cb as ts.ArrowFunction | ts.FunctionExpression).body : null
}

// Does this subtree contain at least one assertion, and does it call an execute*?
function scanBody(body: ts.Node): { hasAssert: boolean, hasExecute: boolean } {
    let hasAssert = false
    let hasExecute = false
    const scan = (m: ts.Node): void => {
        if (ts.isCallExpression(m) && ts.isIdentifier(m.expression) && ASSERT_FNS.has(m.expression.text)) hasAssert = true
        if (ts.isPropertyAccessExpression(m)) {
            if (THROW_MATCHERS.has(m.name.text)) hasAssert = true
            if (m.name.text.startsWith('execute')) hasExecute = true
        }
        ts.forEachChild(m, scan)
    }
    scan(body)
    return { hasAssert, hasExecute }
}

// The `expect(...)` call a matcher property hangs off (direct receiver, so a
// `.not` chain is excluded), or null.
function isExpectReceiver(receiver: ts.Expression): boolean {
    return ts.isCallExpression(receiver) && ts.isIdentifier(receiver.expression) && receiver.expression.text === 'expect'
}

// A deliberate `throw` anywhere in this subtree (incl. nested transaction
// callbacks) — the carve-out anchor for an empty catch.
function containsThrow(node: ts.Node): boolean {
    let found = false
    const scan = (m: ts.Node): void => {
        if (found) return
        if (ts.isThrowStatement(m)) { found = true; return }
        ts.forEachChild(m, scan)
    }
    scan(node)
    return found
}

export function checkNoValidation(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        // no-assertion-runtime — a runtime test (calls execute*) with no assertion
        if (ts.isCallExpression(n)) {
            const body = testCallbackBody(n)
            if (body) {
                const { hasAssert, hasExecute } = scanBody(body)
                if (hasExecute && !hasAssert) {
                    out.push({
                        rule: 'no-assertion-runtime',
                        file,
                        line: lineOf(sf, n),
                        message: 'this test runs a query (an `execute*` call) but contains no assertion (`expect` / `assertType` / `toThrow`) — it executes and validates nothing, so it is always green. Assert the SQL, params, result type and value',
                    })
                }
            }
            // weak-boolean — expect(x).toBeTruthy() / toBeFalsy()
            if (ts.isPropertyAccessExpression(n.expression) && WEAK_BOOL.has(n.expression.name.text)
                && isExpectReceiver(n.expression.expression)) {
                out.push({
                    rule: 'weak-boolean',
                    file,
                    line: lineOf(sf, n),
                    message: `\`expect(...).${n.expression.name.text}()\` pins only truthiness, not the value — a truthy/falsy check passes for many different results. Assert the exact value (\`toBe(true)\` / the real result)`,
                })
            }
        }
        // empty-catch — an empty `catch { }`, unless its try block contains a
        // deliberate throw (the catch is swallowing the test's own throw).
        if (ts.isCatchClause(n) && n.block.statements.length === 0) {
            const tryStmt = n.parent
            const tryBlock = ts.isTryStatement(tryStmt) ? tryStmt.tryBlock : undefined
            if (!tryBlock || !containsThrow(tryBlock)) {
                out.push({
                    rule: 'empty-catch',
                    file,
                    line: lineOf(sf, n),
                    message: 'an empty `catch { }` swallows the error unconditionally — if the guarded code fails (e.g. on the real DB) the test still passes. Swallowing an `execute*` failure to assert only the interceptor-captured SQL is a mock-only pattern: validate the case so it runs in both modes, or assert the caught error. A deliberate `throw` in the try (to drive the scenario, e.g. force a rollback) is exempt',
                })
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
