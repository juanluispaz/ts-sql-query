// Rule `misplaced-marker` — one of the three first-class reason markers
// (`// TODO[BUG]:`, `// TODO[LIMITATION]:`, `// NOT-APPLICABLE:`) appearing
// somewhere OTHER than at a test.
//
// These markers mean something specific ABOUT A TEST: why it is commented out /
// skipped, or why a live test is allowed to stay mock-only. They are consumed by
// `commented-test-reason` / `skipped-test-reason` (the disabled-test reason) and
// by the `mock-only` / `skip-real-db` / `as-*` carve-outs (the live-test marker),
// and the indexer surfaces them as cell caveats. A marker at file scope, inside a
// helper, or floating far from any test belongs to none of those — it is noise
// that reads as if a test were marked when none is.
//
// "At a test" is, precisely:
//   - inside (or in the leading comments of) a live `test(...)` / `it(...)` —
//     leading comments are taken from the TS trivia, so a tall multi-line
//     `// TODO[BUG]: …` block directly above the test counts in full;
//   - in the leading comments of (or on the header line of) a `describe(...)` —
//     a group-level marker; NOT anywhere in the describe body (a per-test marker
//     belongs at its own test, and a file-wrapping describe must not swallow all);
//   - inside the contiguous comment run that holds a COMMENTED-OUT test (the test
//     it explains may itself be commented out) — detected the same way
//     `commented-test-reason` detects such a test.
// Anything else (file scope, a helper, floating prose) is flagged.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { ANY_MARKER } from '../reasons.js'

const RUNNERS = new Set(['test', 'it', 'describe'])
const TEST_IT = new Set(['test', 'it'])
// A commented-out test call (same shape as symmetry/commented-test detection:
// matched closing quote + a trailing `,`/`)` so prose like `it (\`x\`)` is not one).
const COMMENT_TEST_CALL = /\b(?:test|it)\s*(?:\.\s*(?:only|skip|todo|fails|skipIf|runIf|each|concurrent|sequential))?\s*\(\s*(['"`])(?:\\.|(?!\1).)*\1\s*[,)]/

interface Cmt { startLine: number, endLine: number, text: string }

function lineAt(sf: ts.SourceFile, pos: number): number {
    return sf.getLineAndCharacterOfPosition(pos).line + 1
}

// Leftmost identifier of a call's callee chain (`test.skipIf` → `test`).
function rootName(call: ts.CallExpression): string | null {
    let cur: ts.Expression = call.expression
    while (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur)) cur = cur.expression
    return ts.isIdentifier(cur) ? cur.text : null
}

// Only the OUTERMOST call of a `test.skipIf(cond)(name, fn)` double-call counts,
// so the body span is included, not just the `skipIf(cond)` slice.
function isOutermostRunnerCall(call: ts.CallExpression): boolean {
    const p = call.parent
    if (p && ts.isCallExpression(p) && p.expression === call) {
        const r = rootName(p)
        if (r !== null && RUNNERS.has(r)) return false
    }
    return true
}

function scanComments(sf: ts.SourceFile): Cmt[] {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, sf.text)
    const out: Cmt[] = []
    let tok = scanner.scan()
    while (tok !== ts.SyntaxKind.EndOfFileToken) {
        if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
            out.push({
                startLine: lineAt(sf, scanner.getTokenPos()),
                endLine: lineAt(sf, scanner.getTextPos()),
                text: scanner.getTokenText(),
            })
        }
        tok = scanner.scan()
    }
    return out
}

// The set of 1-based lines where a marker is legitimately "at a test".
function validLines(sf: ts.SourceFile): Set<number> {
    const valid = new Set<number>()
    const text = sf.text
    const addRange = (fromPos: number, toPos: number): void => {
        for (let l = lineAt(sf, fromPos); l <= lineAt(sf, toPos); l++) valid.add(l)
    }

    // Live runner calls: leading comments (multi-line safe via TS trivia), plus
    // the body for test/it (a marker inside, the mock-only carve-out) or the
    // header line for describe.
    const visit = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) {
            const root = rootName(n)
            if (root !== null && RUNNERS.has(root) && isOutermostRunnerCall(n)) {
                for (const r of ts.getLeadingCommentRanges(text, n.getFullStart()) ?? []) addRange(r.pos, r.end)
                if (TEST_IT.has(root)) addRange(n.getStart(sf), n.getEnd())
                else valid.add(lineAt(sf, n.getStart(sf)))
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)

    // Commented-out tests: the whole contiguous comment run (markers + the
    // commented test block) — runs split on a gap of more than one blank line.
    const comments = scanComments(sf)
    let i = 0
    while (i < comments.length) {
        let j = i
        while (j + 1 < comments.length && comments[j + 1]!.startLine - comments[j]!.endLine <= 2) j++
        const run = comments.slice(i, j + 1)
        if (run.some(c => COMMENT_TEST_CALL.test(c.text))) {
            for (const c of run) for (let l = c.startLine; l <= c.endLine; l++) valid.add(l)
        }
        i = j + 1
    }

    return valid
}

export function checkMarkerPlacement(sf: ts.SourceFile, file: string): Finding[] {
    const valid = validLines(sf)
    const out: Finding[] = []
    for (const c of scanComments(sf)) {
        if (!ANY_MARKER.test(c.text)) continue
        if (!valid.has(c.startLine)) {
            out.push({
                rule: 'misplaced-marker',
                file,
                line: c.startLine,
                message: 'a `// TODO[BUG]:` / `// TODO[LIMITATION]:` / `// NOT-APPLICABLE:` marker must sit AT a test — in the comment block directly above a `test(...)` / `it(...)` / `describe(...)` (the test may itself be commented out), or inside a test body. This one is not attached to any test (file scope, a helper, or floating prose). Move it to the test it explains, or remove it',
            })
        }
    }
    return out
}
