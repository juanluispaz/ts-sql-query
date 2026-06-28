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
//
// This file also hosts the non-`any` twins: `as-unknown-as` (the `x as unknown
// as T` laundering — its own rule, the clearest cheat), `meaningless-cast`
// (`as unknown` / `as null` / `as never` / `as void`, incl. arrays of those),
// `meaningless-type` (those same four as a type annotation), and `type-cast`
// (the catch-all for any OTHER `x as T` / `<T>x` not claimed by the rules above —
// it may force the type or want `satisfies`; `as const` exempt). All six rules —
// `as-any`, `any-type`, `as-unknown-as`, `meaningless-cast`, `meaningless-type`,
// `type-cast` — are exempt inside a `// TODO[BUG]:`-marked test, so a bug repro can
// use whatever bypass it needs to compile while the bug is open. The cast rules
// (`as-any` / `as-unknown-as` / `meaningless-cast` / `type-cast`) also share the
// `castSanctioned` carve-outs; each cast node is owned by exactly one of them.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf, markerLines, isNodeInMarkedTest } from '../ast.js'
import { TODO_BUG_REASON } from '../reasons.js'
import { collectThrowHelpers, validatesOnlyExceptions, functionSurfacesError, collectErrorVars } from './mirrorImage.js'

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
    const bugLines = markerLines(sf, TODO_BUG_REASON)
    const visit = (n: ts.Node): void => {
        if (isAsAny(n) && !castSanctioned(n, sf, file, throwHelpers, bugLines)) {
            out.push({
                rule: 'as-any',
                file,
                line: lineOf(sf, n),
                message: 'cast to `any` silences the type checker — usually the sign of a query that could not be built through the public typed API. Build it through the public surface; the only sanctioned `as any` feeds an invalid value to a runtime guard in a test that asserts the resulting exception (or a `// TODO[BUG]:`-marked bug repro)',
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

// Rule `as-unknown-as` — the `x as unknown as T` double assertion. This is the
// single clearest type-checker cheat: casting THROUGH `unknown` strips the
// value's type to the top type, then the second `as T` re-asserts it to whatever
// you want — exactly what `as any` does, just spelled so it slips past an
// `as any` ban. There is no honest reason a test needs it; it always means the
// value was not built with type `T` the supported way. It is its OWN rule (not
// folded into `meaningless-cast`) because the message to the agent is so
// specific. Same sanctioned carve-outs as `as-any` (an exception test feeding a
// guard, or a `// TODO[BUG]:`-marked repro).
export function checkAsUnknownAs(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const throwHelpers = collectThrowHelpers(sf)
    const bugLines = markerLines(sf, TODO_BUG_REASON)
    const visit = (n: ts.Node): void => {
        if (isAsUnknownAs(n) && !castSanctioned(n, sf, file, throwHelpers, bugLines)) {
            out.push({
                rule: 'as-unknown-as',
                file,
                line: lineOf(sf, n),
                message: '`as unknown as T` double-asserts through `unknown` to force an arbitrary type — it bypasses the type checker exactly like `as any`, just spelled to evade an `as any` ban. It always means the value was not produced with type `T` the supported way. Build it through the public typed API so it genuinely has type `T`; if you are reproducing a known type bug, mark the test `// TODO[BUG]: <reason>`',
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}

// `(<expr> as unknown) as T` — an outer cast whose operand is a cast to `unknown`.
function isAsUnknownAs(n: ts.Node): boolean {
    if (!ts.isAsExpression(n) && !ts.isTypeAssertionExpression(n)) return false
    let inner: ts.Expression = n.expression
    while (ts.isParenthesizedExpression(inner)) inner = inner.expression
    return (ts.isAsExpression(inner) || ts.isTypeAssertionExpression(inner))
        && inner.type.kind === ts.SyntaxKind.UnknownKeyword
}

// The inner `… as unknown` of an `as unknown as T` laundering — owned by
// `as-unknown-as`, so `meaningless-cast` must not also flag it.
function isLaunderingInnerUnknown(n: ts.Node): boolean {
    if (!((ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) && n.type.kind === ts.SyntaxKind.UnknownKeyword)) return false
    let p: ts.Node | undefined = n.parent
    while (p && ts.isParenthesizedExpression(p)) p = p.parent
    return !!p && (ts.isAsExpression(p) || ts.isTypeAssertionExpression(p))
}

// Rule `meaningless-cast` — a cast to a type that conveys nothing in a test:
// `as unknown`, `as null`, `as never`, `as void`, or a union of only those
// (`as unknown | null`). The `as unknown as T` laundering is the separate, more
// pointed `as-unknown-as` rule, so its inner `as unknown` is excluded here. Same
// threat and same sanctioned carve-outs as `as-any` (exception machinery,
// allow-when, the file-scoped helper, and a `// TODO[BUG]:`-marked repro).
export function checkMeaninglessCast(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const throwHelpers = collectThrowHelpers(sf)
    const bugLines = markerLines(sf, TODO_BUG_REASON)
    const visit = (n: ts.Node): void => {
        if (isMeaninglessCast(n) && !isLaunderingInnerUnknown(n) && !castSanctioned(n, sf, file, throwHelpers, bugLines)) {
            out.push({
                rule: 'meaningless-cast',
                file,
                line: lineOf(sf, n),
                message: 'cast to `unknown` / `null` / `never` / `void` is a meaningless type-checker bypass — there is no reason a test needs it. Build the value through the public typed API; the only sanctioned bypass feeds an invalid value to a runtime guard in an exception test (or a `// TODO[BUG]:`-marked bug repro)',
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}

function isMeaninglessCast(n: ts.Node): boolean {
    if (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) return isMeaninglessCastType(n.type)
    return false
}

// A cast target conveying nothing: one of the four keywords / `null`; a union
// whose members are ALL meaningless (`unknown | null`); or an ARRAY of one of
// those (`as unknown[]` — every array is already assignable to `unknown[]`, so
// the cast is redundant). A union with a real member (`string | null`) is a
// genuine widening and is not flagged.
function isMeaninglessCastType(t: ts.TypeNode): boolean {
    if (ts.isUnionTypeNode(t)) return t.types.length > 0 && t.types.every(isMeaninglessCastType)
    if (ts.isArrayTypeNode(t)) return isMeaninglessCastType(t.elementType)
    return t.kind === ts.SyntaxKind.UnknownKeyword
        || t.kind === ts.SyntaxKind.NeverKeyword
        || t.kind === ts.SyntaxKind.VoidKeyword
        || (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)
}

// The cast carve-outs shared by `as-any` and `meaningless-cast`.
function castSanctioned(n: ts.Node, sf: ts.SourceFile, file: string, throwHelpers: Set<string>, bugLines: Set<number>): boolean {
    return inExceptionTest(n, throwHelpers) || inThrowHelper(n) || inAllowWhenTest(n)
        || isFileScopedAsAny(n, file) || isNodeInMarkedTest(n, sf, bugLines)
}

// Rule `type-cast` — ANY remaining type assertion (`x as T` / `<T>x`) that the
// more specific cast rules (`as-any`, `as-unknown-as`, `meaningless-cast`) did NOT
// already catch. A type assertion forces the checker to accept a shape it did not
// infer: it is often hiding a typing problem, or marks a spot where the value
// should be BUILT so it genuinely has type `T` — or checked with `satisfies T`
// (which validates instead of overriding). Exempt: `as const` (a const assertion,
// not a type override) and a BRANDED-type construction (a literal cast to a
// nominal type — `19.99 as Money`, `42 as IssueId` — which can only be made with a
// cast, see `isBrandedCast`); otherwise the same sanctioned contexts as
// `meaningless-cast` apply. A `warn` review backlog.
export function checkTypeCast(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const throwHelpers = collectThrowHelpers(sf)
    const bugLines = markerLines(sf, TODO_BUG_REASON)
    const visit = (n: ts.Node): void => {
        if ((ts.isAsExpression(n) || ts.isTypeAssertionExpression(n))
            && !isAsAny(n) && !isAsUnknownAs(n) && !isLaunderingInnerUnknown(n)
            && !isMeaninglessCast(n) && !isAsConst(n) && !isBrandedCast(n) && !isErrorNarrowingCast(n)
            && !castSanctioned(n, sf, file, throwHelpers, bugLines)) {
            out.push({
                rule: 'type-cast',
                file,
                line: lineOf(sf, n),
                message: 'a type assertion (`x as T` / `<T>x`) forces the checker to accept a type it did not infer — it may be hiding a typing problem, or a place where the value should be BUILT so it genuinely has type `T`, or checked with `satisfies T` (which validates the shape instead of overriding it). Review whether the cast is necessary. (`as any`, `as unknown as`, and `as unknown`/`null`/… are the more specific cast rules; `as const` and a branded-type construction like `19.99 as Money` are exempt.)',
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}

// `x as const` — a const assertion (literal narrowing), not a type override.
function isAsConst(n: ts.Node): boolean {
    if (!ts.isAsExpression(n) && !ts.isTypeAssertionExpression(n)) return false
    const t = n.type
    return ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && t.typeName.text === 'const'
}

// A branded-type construction: a PRIMITIVE literal (or a `new …()`, e.g.
// `new Date(...)`) cast to a bare type-reference identifier — `19.99 as Money`,
// `42 as IssueId`, `'open' as OrderState`, `new Date(...) as SettlementDate`. A
// nominal/branded type can ONLY be produced with such a cast, so it is permitted.
// The literal operand is the signal: it distinguishes branding a scalar from a
// structural assertion (`rows as Project[]`, `{ … } as Foo`), which stays flagged.
function isBrandedCast(n: ts.Node): boolean {
    if (!ts.isAsExpression(n) && !ts.isTypeAssertionExpression(n)) return false
    const t = n.type
    if (!ts.isTypeReferenceNode(t) || !ts.isIdentifier(t.typeName) || t.typeArguments) return false
    let op: ts.Expression = n.expression
    while (ts.isParenthesizedExpression(op)) op = op.expression
    return isPrimitiveLiteralValue(op) || ts.isNewExpression(op)
}

function isPrimitiveLiteralValue(e: ts.Expression): boolean {
    return ts.isNumericLiteral(e) || ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)
        || ts.isBigIntLiteral(e)
        || e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword
        || (ts.isPrefixUnaryExpression(e) && ts.isNumericLiteral(e.operand)) // -1, +1
}

// An error type: a type reference whose name ends in `Error` (`Error`,
// `TsSqlError`, …), or an intersection that includes one (`Error & { … }`).
function isErrorTypeRef(t: ts.TypeNode): boolean {
    return ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && /Error$/.test(t.typeName.text)
}
function isErrorShapeType(t: ts.TypeNode): boolean {
    return isErrorTypeRef(t) || (ts.isIntersectionTypeNode(t) && t.types.some(isErrorTypeRef))
}

// A cast to an error type — narrowing a caught error to read its properties
// (`(thrownError as Error).message`, `thrown as Error & { … }`). Error handling,
// not a forced type. Used by `type-cast`.
function isErrorNarrowingCast(n: ts.Node): boolean {
    return (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) && isErrorShapeType(n.type)
}

// The node sits inside the shape part of an `Error & { … }` type — e.g. the
// `unknown` extra-property types of an error-inspection alias
// (`type DisallowError = Error & { disallowedProperty?: unknown }`). Error
// handling, not a meaningless annotation. Used by `meaningless-type`.
function isInErrorShapeType(n: ts.Node): boolean {
    let p: ts.Node | undefined = n.parent
    while (p) {
        if (ts.isIntersectionTypeNode(p) && p.types.some(isErrorTypeRef)) return true
        p = p.parent
    }
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
    const bugLines = markerLines(sf, TODO_BUG_REASON)
    const visit = (n: ts.Node): void => {
        if (n.kind === ts.SyntaxKind.AnyKeyword) {
            const p = n.parent
            const isCast = ts.isAsExpression(p) || ts.isTypeAssertionExpression(p)
            if (!isCast && !isNodeInMarkedTest(n, sf, bugLines)) {
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

// Rule `meaningless-type` — the type-annotation twin of `meaningless-cast`: an
// `unknown` / `null` / `never` / `void` TYPE used as an annotation, flagged ONLY
// where it conveys nothing. A node whose direct parent is a cast is excluded
// (anything inside a cast's TYPE is `meaningless-cast` / `as-unknown-as`'s
// domain — `isWithinCastType`). `unknown` / `null` are permitted in the SAME
// contexts as `as any` (project decision), and the idiomatic / API-mandated uses
// are NOT meaningless (see `isExemptMeaninglessType`):
//   - the `as any` contexts (`castSanctioned`): an exception test, a throw-helper,
//     allow-when, the file-scoped `fromDbValue`, a `// TODO[BUG]:` repro;
//   - a CAUGHT-ERROR variable (`catch (e: unknown)` / `let caught: unknown`) — via
//     the exception carve-outs' `collectErrorVars`;
//   - inside a type-test type argument (`assertType<Exact<…, never>>()`);
//   - what a PUBLIC API requires: a `TypeAdapter` override (`transformValueToDB` /
//     `transformValueFromDB`) or a public-API result (`getQueryExecutionMetadata`);
//   - `null` in a union with a real member (`string | null`);
//   - `void` as a function return (`() => void`, `(): void`, `Promise<void>`).
// What stays flagged: a standalone meaningless annotation, and `unknown` plumbing
// that only makes a test less readable/realistic (a generic `capture(...)` helper,
// `Set<unknown>`, …) — none of which is an API requirement or an error context.
export function checkMeaninglessType(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const throwHelpers = collectThrowHelpers(sf)
    const bugLines = markerLines(sf, TODO_BUG_REASON)
    const errorVars = collectErrorVars([sf], throwHelpers)
    const visit = (n: ts.Node): void => {
        if (isMeaninglessTypeNode(n) && !isWithinCastType(n)
            && !isExemptMeaninglessType(n, sf, file, throwHelpers, bugLines, errorVars)) {
            out.push({
                rule: 'meaningless-type',
                file,
                line: lineOf(sf, n),
                message: 'this `unknown` / `null` / `never` / `void` type annotation conveys nothing here — it hides the real shape under test, or only makes the test less readable. Use the precise type. (Allowed: the same contexts as `as any` — an exception test / throw-helper / `fromDbValue` / `TODO[BUG]` repro; a caught-error variable; a type-test arg `assertType<…>`; what a public API requires — a `TypeAdapter` override or a `getQueryExecution*` result; `null` unioned with a real type like `string | null`; `void` as a function return.)',
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}

// A type NODE of `unknown` / `never` / `void`, or a `null` type (the literal-type
// `null`, NOT a `null` value expression — those have no LiteralTypeNode parent).
function isMeaninglessTypeNode(n: ts.Node): boolean {
    return n.kind === ts.SyntaxKind.UnknownKeyword
        || n.kind === ts.SyntaxKind.NeverKeyword
        || n.kind === ts.SyntaxKind.VoidKeyword
        || (ts.isLiteralTypeNode(n) && n.literal.kind === ts.SyntaxKind.NullKeyword)
}

// `n` lives inside the TYPE of a cast (`as Error & { x: unknown }`, `as unknown[]`)
// — owned by `meaningless-cast` / `as-unknown-as`, never the type rule.
function isWithinCastType(n: ts.Node): boolean {
    let cur: ts.Node = n
    while (cur.parent) {
        const p = cur.parent
        if ((ts.isAsExpression(p) || ts.isTypeAssertionExpression(p)) && p.type === cur) return true
        cur = p
    }
    return false
}

// The TypeAdapter interface methods whose `unknown` signature the library itself
// mandates — a custom adapter overriding them is allowed to use `unknown`.
// `transformPlaceholder`'s `valueSentToDB: unknown` parameter is mandated the
// same way (a class adapter override must annotate it `unknown`).
const TYPE_ADAPTER_METHODS = new Set(['transformValueToDB', 'transformValueFromDB', 'transformPlaceholder'])
// Public-API functions whose result is typed `unknown` by the library, so a
// `const x: unknown = api(...)` annotation is required, not meaningless. Minimal
// allow-list — keep it tiny, like FILE_SCOPED_AS_ANY.
const PUBLIC_API_UNKNOWN_RESULT = new Set(['getQueryExecutionMetadata'])
// An error-ish parameter name: an `unknown`-typed param with one of these names
// is a caught error the helper receives (`reasonOf(e: unknown)`), not a chosen
// meaningless annotation.
const ERROR_PARAM_NAME = /^(e\d*|err|error|reason|cause|thrown|caught\d*|ex)$/i

// The idiomatic, non-meaningless uses of these types. `unknown`/`null` are
// permitted in the SAME contexts as `as any` (per project decision), plus the
// structural cases and the public-API surfaces the library itself requires.
function isExemptMeaninglessType(n: ts.Node, sf: ts.SourceFile, file: string, throwHelpers: Set<string>, bugLines: Set<number>, errorVars: Set<string>): boolean {
    // Same contexts as `as any`: exception test / throw-helper / allow-when /
    // file-scoped `fromDbValue` / `// TODO[BUG]:` repro.
    if (castSanctioned(n, sf, file, throwHelpers, bugLines)) return true
    // A caught-error variable annotation (`catch (e: unknown)` / `let caught: unknown`).
    if (ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)
        && errorVars.has(n.parent.name.text)) return true
    // A caught-error PARAMETER typed `unknown` — an error helper that receives the
    // error (`reasonOf(e: unknown)`), recognised by the error-ish param name (the
    // same diagnostic-context idea `weak-matcher` uses).
    if (n.kind === ts.SyntaxKind.UnknownKeyword && ts.isParameter(n.parent) && n.parent.type === n
        && ts.isIdentifier(n.parent.name) && ERROR_PARAM_NAME.test(n.parent.name.text)) return true
    // Inside a `assertType<…>` / `expectTypeOf<…>` type argument (a type-level assertion).
    if (isInTypeTestTypeArgs(n)) return true
    // Inside an `Error & { … }` shape — the extra-property types of an
    // error-inspection alias (`type DisallowError = Error & { x?: unknown }`).
    if (isInErrorShapeType(n)) return true
    // What a public API requires: a TypeAdapter override, or a public-API result type.
    if (inTypeAdapterMethod(n) || fromPublicApiResult(n)) return true
    // `void` as a function return type, or `Promise<void>`.
    if (n.kind === ts.SyntaxKind.VoidKeyword && isVoidReturnPosition(n)) return true
    // `null` in a union that also has a real member — a nullable type (`string | null`).
    if (ts.isLiteralTypeNode(n) && n.literal.kind === ts.SyntaxKind.NullKeyword
        && ts.isUnionTypeNode(n.parent) && unionHasRealMember(n.parent)) return true
    return false
}

// `n` is inside a `transformValueToDB` / `transformValueFromDB` override (the
// TypeAdapter methods) — the `unknown` there matches the interface the lib requires.
function inTypeAdapterMethod(n: ts.Node): boolean {
    let p: ts.Node | undefined = n.parent
    while (p) {
        if (ts.isMethodDeclaration(p) || ts.isMethodSignature(p) || ts.isPropertyAssignment(p) || ts.isFunctionDeclaration(p)) {
            const name = p.name && ts.isIdentifier(p.name) ? p.name.text : undefined
            if (name && TYPE_ADAPTER_METHODS.has(name)) return true
        }
        p = p.parent
    }
    return false
}

// `const x: unknown = getQueryExecutionMetadata(...)` — the var's `unknown` is the
// public API's result type, not a chosen meaningless annotation.
function fromPublicApiResult(n: ts.Node): boolean {
    const p = n.parent
    if (!ts.isVariableDeclaration(p) || p.type !== n || !p.initializer) return false
    let init: ts.Expression = p.initializer
    while (ts.isAwaitExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression
    return ts.isCallExpression(init) && ts.isIdentifier(init.expression)
        && PUBLIC_API_UNKNOWN_RESULT.has(init.expression.text)
}

// `n` sits inside a type argument of an `assertType<…>` / `expectTypeOf<…>` call
// — the type-test utilities. The nearest enclosing call is the type-test call
// (type arguments hold no value calls), so a different nearest call means no.
function isInTypeTestTypeArgs(n: ts.Node): boolean {
    let p: ts.Node | undefined = n.parent
    while (p) {
        if (ts.isCallExpression(p)) {
            const callee = p.expression
            const name = ts.isIdentifier(callee) ? callee.text
                : ts.isPropertyAccessExpression(callee) ? callee.name.text : ''
            if (name === 'assertType' || name === 'expectTypeOf') {
                return (p.typeArguments ?? []).some(ta => isAncestorOf(ta, n))
            }
            return false
        }
        p = p.parent
    }
    return false
}

function isAncestorOf(ancestor: ts.Node, node: ts.Node): boolean {
    let x: ts.Node | undefined = node
    while (x) { if (x === ancestor) return true; x = x.parent }
    return false
}

// A union member that is neither meaningless (unknown/null/never/void) nor
// `undefined` — i.e. a real type that makes a `… | null` union meaningful.
function unionHasRealMember(union: ts.UnionTypeNode): boolean {
    return union.types.some(t => !isMeaninglessTypeNode(t) && t.kind !== ts.SyntaxKind.UndefinedKeyword)
}

// `void` is a return type: `() => void`, `(): void`, `function f(): void`, a
// method/accessor return, or the argument of `Promise<…>` (an async return).
function isVoidReturnPosition(n: ts.Node): boolean {
    const p = n.parent
    if (!p) return false
    if ((ts.isFunctionTypeNode(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)
        || ts.isArrowFunction(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p)
        || ts.isCallSignatureDeclaration(p) || ts.isGetAccessorDeclaration(p)) && p.type === n) return true
    if (ts.isTypeReferenceNode(p) && ts.isIdentifier(p.typeName) && p.typeName.text === 'Promise'
        && (p.typeArguments?.some(t => t === n) ?? false)) return true
    return false
}

// The cast is sanctioned when its enclosing `test(...)`/`it(...)` body validates
// ONLY exceptions — the cast is feeding a guard that should throw.
function inExceptionTest(node: ts.Node, throwHelpers: Set<string>): boolean {
    const body = enclosingTestBody(node)
    if (!body) return false
    const stmts = ts.isBlock(body) ? [...body.statements] : [body]
    return validatesOnlyExceptions(stmts, throwHelpers)
}

// Carve-out 1 (helper form): the node sits inside an ERROR-HANDLING function —
// either one whose `catch` surfaces the error (`toDbReason` / `fromDbReason`),
// or one that RECEIVES the error as a parameter and inspects it (`reasonOf(e:
// unknown)`, `reasonsInChain(e: unknown)` walking the cause chain). Both are error
// machinery, so the casts / `unknown` plumbing inside them are tolerated.
function inThrowHelper(node: ts.Node): boolean {
    let p: ts.Node | undefined = node.parent
    while (p) {
        if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)) {
            if ((p.body && functionSurfacesError(p.body)) || hasErrorParam(p)) return true
        }
        p = p.parent
    }
    return false
}

// A function that receives a caught error: a parameter typed `unknown` named like
// an error (`e` / `err` / `error` / …). Marks `reasonOf` / `reasonsInChain` etc.
// as error-handling helpers even though they have no internal `catch`.
function hasErrorParam(fn: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction): boolean {
    return fn.parameters.some(param =>
        param.type?.kind === ts.SyntaxKind.UnknownKeyword
        && ts.isIdentifier(param.name) && ERROR_PARAM_NAME.test(param.name.text))
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
