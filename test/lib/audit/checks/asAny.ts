// Rule `as-any` — a cast to `any` (`x as any` / `<any>x`) that silences the
// type checker.
//
// Threat (recurrent in practice): an agent that can't work out how to build the
// query through the PUBLIC, typed API takes a shortcut — casts to `any` to make
// the rejected call compile — and, having only run the mock, ships a test that
// exercises something the public surface forbids. The ban matters because the
// `as any` is the *symptom of not understanding the problem*.
//
// Three project-sanctioned LEGITIMATE patterns are tolerated; everything else
// stays flagged (a cast that hides a typing bug, a workaround that should have
// been written differently, a helper that defeats realistic queries — the rule
// surfaces those for a rewrite, it does not bless them):
//
//  1. Exception machinery — the cast feeds a deliberately-invalid value/shape
//     to a runtime guard whose job is to THROW. Two forms: the enclosing
//     `test(...)` validates ONLY exceptions, OR the cast sits inside a
//     throw-helper function (a `catch` that surfaces the error, e.g. the
//     marshalling `toDbReason`/`fromDbReason` or `reasonOf`). E.g.
//       const reason = reasonOf(() => conn.dynamicConditionFor(f).withValues('x' as any))
//       expect(reason).toBe('DYNAMIC_CONDITION_INVALID_FILTER')
//  2. allow-when gating — tolerated ONLY when the enclosing test asserts
//     `isQueryAllowed(...)` (the allow-when API). The cast hides that the test
//     should arguably be disabled on unsupported DBs, but `isQueryAllowed` pins
//     the gate semantics and a cheat would not be asserting it.
//  3. The marshalling `fromDbValue` helper — a file+helper-scoped exception (the
//     as-any twin of the `fromDbValue` mock-only one). NOT whole-file: the
//     sibling error-extractor helpers are covered by (1), so only `fromDbValue`
//     — which returns a value, not an error — needs the explicit hole.
//
// This cannot tell every cheat from every legitimate use (the distinction is
// ultimately intent — the quality-gate sub-agent's job); it gates the shapes we
// can name and leaves the rest as a `warn` backlog.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'
import { collectThrowHelpers, validatesOnlyExceptions, functionSurfacesError } from './mirrorImage.js'

// The allow-when test API (carve-out 2): its presence in the enclosing test is
// what makes an `as any` there sanctioned.
const ALLOW_WHEN_ASSERTION = 'isQueryAllowed'

// File+helper-scoped `as any` exception (carve-out 3) — keep TINY, like the
// mock-only `FILE_SCOPED_MOCK_ONLY`. Each entry is a deliberate hole, scoped to
// a single helper function so the rest of the file stays covered.
const FILE_SCOPED_AS_ANY: ReadonlyArray<{ file: string, helper: string, reason: string }> = [
    {
        file: 'marshalling.transform-validation.test.ts',
        helper: 'fromDbValue',
        // `fromDbValue` casts a value-source / result row to drive
        // transformValueFromDB with representations the typed API forbids and
        // returns the VALUE (so it is not a throw-helper covered by carve-out 1).
        reason: 'fromDbValue casts an off-type value-source/result to exercise the from-db transform',
    },
]

export function checkAsAny(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const throwHelpers = collectThrowHelpers(sf)
    const visit = (n: ts.Node): void => {
        if (isAsAny(n) && !inExceptionTest(n, throwHelpers) && !inThrowHelper(n) && !inAllowWhenTest(n) && !isFileScopedAsAny(n, file)) {
            out.push({
                rule: 'as-any',
                file,
                line: lineOf(sf, n),
                message: 'cast to `any` silences the type checker — usually the sign of a query that could not be built through the public typed API. Build it through the public surface; the only sanctioned `as any` feeds an invalid value to a runtime guard in a test that asserts the resulting exception',
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}

function isAsAny(n: ts.Node): boolean {
    if (ts.isAsExpression(n) && n.type.kind === ts.SyntaxKind.AnyKeyword) return true
    if (ts.isTypeAssertionExpression(n) && n.type.kind === ts.SyntaxKind.AnyKeyword) return true
    return false
}

// Rule `any-type` — the `any` TYPE annotation (`x: any`, `(v: any) => …`,
// `any[]`, `Array<any>`, `: Promise<any>`, return types). It defeats
// type-checking and usually hides a test that isn't realistic — a caught error
// left `any` instead of `unknown`, a connection widened to `any` to dodge the
// typed surface, an extension whose shape was never spelled out. Separate from
// `as-any` (the cast): an `AnyKeyword` whose parent is the cast's `as`/`<>` is
// owned by `as-any`, so it is excluded here — the two never double-flag.
export function checkAnyType(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        if (n.kind === ts.SyntaxKind.AnyKeyword) {
            const p = n.parent
            const isCast = ts.isAsExpression(p) || ts.isTypeAssertionExpression(p)
            if (!isCast) {
                out.push({
                    rule: 'any-type',
                    file,
                    line: lineOf(sf, n),
                    message: 'the `any` type annotation defeats type-checking — it usually hides a test that is not realistic. Use the precise type, or `unknown` for a caught error / opaque value (the `as any` cast is the separate `as-any` rule)',
                })
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}

// The cast is sanctioned when its enclosing `test(...)`/`it(...)` body validates
// ONLY exceptions — the cast is feeding a guard that should throw.
function inExceptionTest(node: ts.Node, throwHelpers: Set<string>): boolean {
    const body = enclosingTestBody(node)
    if (!body) return false
    const stmts = ts.isBlock(body) ? [...body.statements] : [body]
    return validatesOnlyExceptions(stmts, throwHelpers)
}

// Carve-out 1 (helper form): the cast sits inside a function that surfaces a
// caught error (a throw-helper like `toDbReason` / `fromDbReason` / `reasonOf`)
// — the cast is the invalid input the helper exists to catch.
function inThrowHelper(node: ts.Node): boolean {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p))
            && p.body && functionSurfacesError(p.body)) return true
        p = p.parent
    }
    return false
}

// Carve-out 2: the enclosing test asserts `isQueryAllowed(...)` — an allow-when
// gating test, tolerated by project decision.
function inAllowWhenTest(node: ts.Node): boolean {
    const body = enclosingTestBody(node)
    if (!body) return false
    let found = false
    const visit = (n: ts.Node): void => {
        if (found) return
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === ALLOW_WHEN_ASSERTION) { found = true; return }
        ts.forEachChild(n, visit)
    }
    visit(body)
    return found
}

// Carve-out 3: the cast is inside the file+helper named in FILE_SCOPED_AS_ANY.
function isFileScopedAsAny(node: ts.Node, file: string): boolean {
    const entry = FILE_SCOPED_AS_ANY.find((e) => file.endsWith('/' + e.file) || file === e.file)
    if (!entry) return false
    return enclosingFunctionName(node) === entry.helper
}

// Name of the nearest enclosing function: a `function foo` declaration, or an
// arrow/function expression bound to `const foo = …`.
function enclosingFunctionName(node: ts.Node): string | undefined {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if (ts.isFunctionDeclaration(p)) return p.name?.text
        if (ts.isFunctionExpression(p) || ts.isArrowFunction(p)) {
            const decl = p.parent
            if (decl && ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) return decl.name.text
            return undefined
        }
        p = p.parent
    }
    return undefined
}

// Body of the `test(...)` / `it(...)` callback enclosing `node` — NOT the
// nearest function (which may be an inner thunk like `reasonOf(() => …)`).
function enclosingTestBody(node: ts.Node): ts.ConciseBody | undefined {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && isTestCallback(p)) return p.body
        p = p.parent
    }
    return undefined
}

function isTestCallback(fn: ts.Node): boolean {
    const call = fn.parent
    if (!call || !ts.isCallExpression(call)) return false
    const callee = call.expression
    const name = ts.isIdentifier(callee) ? callee.text
        : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) ? callee.expression.text
        : undefined
    return name === 'test' || name === 'it'
}
