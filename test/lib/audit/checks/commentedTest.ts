// Rule `commented-test-reason` — a commented-out test with no stated reason.
//
// A test can be temporarily disabled by commenting it out; the symmetry check
// still counts its name (so it cannot be silently dropped — it must stay
// commented in every cell). But a bare commented-out test reads as "someone
// gave up here" with no trace of why. The project rule: every commented-out
// test carries one of the three first-class reason markers — `// TODO[BUG]:
// <reason>`, `// TODO[LIMITATION]: <reason>`, or `// NOT-APPLICABLE: <reason>`
// (see `../reasons.ts` for the semantics of each) — explaining why it is off.
// The reason is mandatory.
//
// Detection is comment-scoped (TS scanner, so strings/code that merely contain
// `test(` are not mistaken for a comment): a comment whose text holds a
// `test(…)` / `it(…)` call is a commented-out test; it is satisfied when that
// comment — or a reason comment within 3 lines above it (the usual marker line
// sitting above a `/* … */` block) — carries one of the markers followed by a
// reason.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { DISABLED_TEST_REASON } from '../reasons.js'

// A commented-out test call: `test('name', …)` / `it.skip('name', …)` etc. The
// name string's closing quote is matched to its opener (so an embedded other
// quote does not end it early), and it must be followed by `,` or `)` — a real
// call passes a callback / closes its args. This last guard stops ordinary
// comment PROSE that contains `it (…)` (e.g. a markdown code span like
// "… used to silence it (`isMocked()` skipping …)") from being mistaken for a
// commented-out test (test/BUGS.md documented that false positive).
const TEST_CALL = /\b(?:test|it)\s*(?:\.\s*(?:only|skip|todo|fails|skipIf|runIf|each|concurrent|sequential))?\s*\(\s*(['"`])(?:\\.|(?!\1).)*\1\s*[,)]/

interface Cmt { startLine: number, endLine: number, text: string }

export function checkCommentedTests(sf: ts.SourceFile, file: string): Finding[] {
    const comments = scanComments(sf)
    const reasons = comments.filter((c) => DISABLED_TEST_REASON.test(c.text))
    const out: Finding[] = []
    for (const c of comments) {
        if (!TEST_CALL.test(c.text)) continue
        const hasReason = DISABLED_TEST_REASON.test(c.text)
            || reasons.some((t) => t.startLine >= c.startLine - 3 && t.startLine <= c.endLine)
        if (!hasReason) {
            out.push({
                rule: 'commented-test-reason',
                file,
                line: c.startLine,
                message: 'a commented-out test must carry a `// TODO[BUG]: <reason>`, `// TODO[LIMITATION]: <reason>`, or `// NOT-APPLICABLE: <reason>` saying why it is disabled — it still counts for symmetry, so it cannot be silently dropped, and the reason must be stated',
            })
        }
    }
    return out
}

function scanComments(sf: ts.SourceFile): Cmt[] {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, sf.text)
    const out: Cmt[] = []
    let tok = scanner.scan()
    while (tok !== ts.SyntaxKind.EndOfFileToken) {
        if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
            const start = scanner.getTokenPos()
            const end = scanner.getTextPos()
            out.push({
                startLine: sf.getLineAndCharacterOfPosition(start).line + 1,
                endLine: sf.getLineAndCharacterOfPosition(end).line + 1,
                text: scanner.getTokenText(),
            })
        }
        tok = scanner.scan()
    }
    return out
}
