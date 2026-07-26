// Rule `mock-only` (request form) — an unjustified `ctx.mockOnlyConnection()`.
//
// `ctx.mockOnlyConnection()` points the test's connection at the
// `MockQueryRunner` even on a cell whose real backend is enabled. It is the
// SANCTIONED shape for the extreme cases DESIGN §"Mock-only smell" allows, and
// a strict improvement on the `if (ctx.realDbEnabled) return` skip it replaced:
// the body still EXECUTES and asserts in every mode, so the SQL snapshot, the
// params and the result type are validated on real cells too. What it gives up
// is narrower but real — the INPUT no longer comes from the engine, so nothing
// proves the engine can produce it.
//
// That is why it still needs a reason. Without one the call is a silent opt-out
// of real-DB validation that no reviewer can distinguish from a genuine
// construction, and the cheapest way to make a failing `--docker` test green is
// to add one line. So every call site must be licensed by a marker in the test
// that makes the call:
//
//   - `// MOCK-ONLY: <reason>`   — the marker for exactly this: the mock is the
//     test's INPUT DEVICE. Conventionally the comment block directly above the
//     call. Name what the real engine cannot supply ("a real INSERT always
//     produces the generated id"), not merely that the test is mock-only.
//   - `// NOT-APPLICABLE: <reason>` / `// TODO[BUG]: <reason>` — the two markers
//     that already license a live mock-only test (a permanent dialect boundary;
//     a bug repro that stays mock-only until fixed). Accepted unchanged, so
//     tests already carrying one need no second marker.
//
// `TODO[LIMITATION]` is deliberately NOT a license — same rule as the
// `skip-real-db` carve-out.
//
// Scope note: only LIVE calls are checked. A `ctx.mockOnlyConnection()` inside a
// commented-out test is trivia, not a call — `commented-test-reason` governs
// that block instead.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf, markerLines, isNodeInMarkedTest } from '../ast.js'
import { MOCK_ONLY_LICENSE } from '../reasons.js'

export function checkMockOnlyConnection(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const licensed = markerLines(sf, MOCK_ONLY_LICENSE)
    const visit = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
            && n.expression.name.text === 'mockOnlyConnection'
            && !isNodeInMarkedTest(n, sf, licensed)) {
            out.push({
                rule: 'mock-only',
                file,
                line: lineOf(sf, n),
                message: '`ctx.mockOnlyConnection()` opts this test out of real-DB INPUT (the body still runs and asserts in every mode, but the value under test comes from the mock, so nothing proves the engine can produce it). It needs a reason: put `// MOCK-ONLY: <reason>` in the comment block directly above the call, naming what the real engine cannot supply (e.g. "a real INSERT always produces the generated id, so a null id can only be forced through the mock"). If the engine CAN produce the case, drop the call and let the test run for real — synthesise an off-shape input with `fragmentWithType` / `rawFragment` if it takes one. A permanent dialect boundary (`// NOT-APPLICABLE: <reason>`) or a bug repro (`// TODO[BUG]: <reason>`) also licenses the call',
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
