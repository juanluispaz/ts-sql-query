// Registration-level skip rules — a test disabled (or gated) at the `test(...)`
// registration site rather than inside its body. Two distinct mechanisms, split
// into two rules (project decision: separate rules tune severity independently):
//
//   - `skipped-test-reason`  `test.skip` / `it.skip` / `describe.skip` /
//                            `test.todo` / `it.todo`, plus the identifier forms
//                            `xit` / `xtest` / `xdescribe` — a disabled test. It
//                            carries the SAME obligation as a commented-out test
//                            (the `commented-test-reason` twin): one of the three
//                            first-class markers — `TODO[BUG]:` /
//                            `TODO[LIMITATION]:` / `NOT-APPLICABLE:` (see
//                            `../reasons.ts`) — saying why it is off. The skip is
//                            live code (AST), the reason lives in a comment within
//                            3 lines above (or on the call's own line).
//   - `skip-real-db`         `test.skipIf(ctx.realDbEnabled)` /
//                            `test.runIf(!ctx.realDbEnabled)` — a `mock-only`
//                            evasion at the REGISTRATION level that the
//                            body-scoped `mock-only` rule (`if (ctx.realDbEnabled)
//                            return` inside the body) cannot see. The test never
//                            runs on the real engine, so a real failure can't
//                            surface. Scoped to conditions referencing
//                            `realDbEnabled`; other `skipIf`/`runIf` gates are a
//                            different concern and not flagged here.
//
// Engine: AST for the `.skip`/`.todo`/`.skipIf`/`.runIf` access (so a string or
// comment mentioning them is never matched) + the TS scanner to find the
// reason-marker comments. No type checker. Anchor: 0 for both — clean preventive
// gates.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'
import { DISABLED_TEST_REASON } from '../reasons.js'

const RUNNERS = new Set(['test', 'it', 'describe'])
const DISABLED = new Set(['skip', 'todo'])
const CONDITIONAL = new Set(['skipIf', 'runIf'])
// The identifier forms of a disabled test (jest/vitest x-prefix) — same
// obligation as `.skip`/`.todo`, but the callee is a bare identifier.
const DISABLED_IDENTIFIERS = new Set(['xit', 'xtest', 'xdescribe'])

// The leftmost identifier of a property-access / call chain (`test.skip` → `test`).
function rootIdentifier(node: ts.Expression): string | null {
    let cur: ts.Expression = node
    while (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur)) {
        cur = cur.expression
    }
    return ts.isIdentifier(cur) ? cur.text : null
}

// Lines (1-based) carrying a reason marker comment (TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE).
function reasonLinesOf(sf: ts.SourceFile): Set<number> {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, sf.text)
    const lines = new Set<number>()
    let tok = scanner.scan()
    while (tok !== ts.SyntaxKind.EndOfFileToken) {
        if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
            if (DISABLED_TEST_REASON.test(scanner.getTokenText())) {
                lines.add(sf.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1)
            }
        }
        tok = scanner.scan()
    }
    return lines
}

export function checkRegistrationSkip(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const reasonLines = reasonLinesOf(sf)
    const hasReasonNear = (line: number): boolean => {
        for (let l = line - 3; l <= line; l++) if (reasonLines.has(l)) return true
        return false
    }

    const visit = (n: ts.Node): void => {
        // Identifier forms: `xit(...)` / `xtest(...)` / `xdescribe(...)`.
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && DISABLED_IDENTIFIERS.has(n.expression.text)) {
            const line = lineOf(sf, n.expression)
            if (!hasReasonNear(line)) {
                out.push({
                    rule: 'skipped-test-reason',
                    file,
                    line,
                    message: `\`${n.expression.text}\` disables this test — like a commented-out test it must state why with a \`// TODO[BUG]: <reason>\`, \`// TODO[LIMITATION]: <reason>\`, or \`// NOT-APPLICABLE: <reason>\` (within 3 lines above). A disabled test with no stated reason reads as "someone gave up here"`,
                })
            }
        }
        if (ts.isPropertyAccessExpression(n)) {
            const member = n.name.text
            const root = rootIdentifier(n.expression)
            if (root !== null && RUNNERS.has(root)) {
                if (DISABLED.has(member)) {
                    const line = lineOf(sf, n)
                    if (!hasReasonNear(line)) {
                        out.push({
                            rule: 'skipped-test-reason',
                            file,
                            line,
                            message: `\`${root}.${member}\` disables this test — like a commented-out test it must state why with a \`// TODO[BUG]: <reason>\`, \`// TODO[LIMITATION]: <reason>\`, or \`// NOT-APPLICABLE: <reason>\` (within 3 lines above). A disabled test with no stated reason reads as "someone gave up here"`,
                        })
                    }
                } else if (CONDITIONAL.has(member)) {
                    // Flag only when the gate references realDbEnabled (mock-only evasion).
                    const call = n.parent
                    const args = ts.isCallExpression(call) && call.expression === n ? call.arguments : undefined
                    const refsRealDb = args?.some(a => a.getText(sf).includes('realDbEnabled')) ?? false
                    if (refsRealDb) {
                        out.push({
                            rule: 'skip-real-db',
                            file,
                            line: lineOf(sf, n),
                            message: `\`${root}.${member}(…realDbEnabled…)\` gates the WHOLE test on the real-DB flag — a mock-only evasion at the registration level: the test never executes against the real engine, so a real failure cannot surface. The value must be validated in both modes; assert it unconditionally instead of skipping a mode`,
                        })
                    }
                }
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
