// Rule `commented-test-reason` — a commented-out test with no stated reason.
//
// A test can be temporarily disabled by commenting it out; the symmetry check
// still counts its name (so it cannot be silently dropped — it must stay
// commented in every cell). But a bare commented-out test reads as "someone
// gave up here" with no trace of why. The project rule: every commented-out
// test carries a `// TODO[LIMITATION]: <reason>` or `// TODO[BUG]: <reason>`
// explaining why it is off (and what would re-enable it). The reason is
// mandatory.
//
// Detection is comment-scoped (TS scanner, so strings/code that merely contain
// `test(` are not mistaken for a comment): a comment whose text holds a
// `test(…)` / `it(…)` call is a commented-out test; it is satisfied when that
// comment — or a TODO comment within 3 lines above it (the usual
// `// TODO[LIMITATION]: …` line sitting above a `/* … */` block) — carries a
// `TODO[LIMITATION]:` / `TODO[BUG]:` marker followed by a reason.

import ts from 'typescript'
import type { Finding } from '../types.js'

const TEST_CALL = /\b(?:test|it)\s*(?:\.\s*(?:only|skip|todo|fails|skipIf|runIf|each|concurrent|sequential))?\s*\(\s*['"`]/
const TODO_REASON = /TODO\[(?:LIMITATION|BUG)\]\s*:\s*\S/

interface Cmt { startLine: number, endLine: number, text: string }

export function checkCommentedTests(sf: ts.SourceFile, file: string): Finding[] {
    const comments = scanComments(sf)
    const todos = comments.filter((c) => TODO_REASON.test(c.text))
    const out: Finding[] = []
    for (const c of comments) {
        if (!TEST_CALL.test(c.text)) continue
        const hasReason = TODO_REASON.test(c.text)
            || todos.some((t) => t.startLine >= c.startLine - 3 && t.startLine <= c.endLine)
        if (!hasReason) {
            out.push({
                rule: 'commented-test-reason',
                file,
                line: c.startLine,
                message: 'a commented-out test must carry a `// TODO[LIMITATION]: <reason>` or `// TODO[BUG]: <reason>` saying why it is disabled — it still counts for symmetry, so it cannot be silently dropped, and the reason must be stated',
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
