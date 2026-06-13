// Rule `grouped-commented-tests` — several commented-out tests crammed into a
// single comment block, sharing one reason marker.
//
// A commented-out test still counts for symmetry, so it stays in every cell; it
// must carry its OWN first-class reason marker (`// TODO[BUG]:` /
// `// TODO[LIMITATION]:` / `// NOT-APPLICABLE:`) explaining why THAT test is off.
// When several `test(...)` / `it(...)` calls are lumped into one `/* … */` block,
// a single marker above the block "covers" all of them: the individual reasons
// are lost and a reader cannot tell which reason applies to which test. Split the
// block — one commented-out test per comment, each with its own marker — and
// `commented-test-reason` then enforces a marker on every one.
//
// Detection (TS scanner, comment-scoped — so a string or live code that merely
// contains `test(` is never matched): a SINGLE comment node whose text holds TWO
// OR MORE test calls. Per-node by design, so a normal `//`-per-line commented-out
// test (one `test(` on one of its lines) is never flagged; only a multi-test
// `/* … */` block (or two calls crammed on one comment line) is.

import ts from 'typescript'
import type { Finding } from '../types.js'

// Same shape as commentedTest.ts `TEST_CALL` / markerPlacement.ts
// `COMMENT_TEST_CALL` (matched closing quote + a trailing `,`/`)` so prose like
// `it (\`x\`)` is not mistaken for a call), with the global flag to COUNT every
// occurrence in a comment's text. `String.match` with `g` returns the full
// matches (capture groups ignored), so its length is the call count.
const TEST_CALL_G = /\b(?:test|it)\s*(?:\.\s*(?:only|skip|todo|fails|skipIf|runIf|each|concurrent|sequential))?\s*\(\s*(['"`])(?:\\.|(?!\1).)*\1\s*[,)]/g

interface Cmt { startLine: number, text: string }

export function checkGroupedCommentedTests(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    for (const c of scanComments(sf)) {
        const count = (c.text.match(TEST_CALL_G) ?? []).length
        if (count >= 2) {
            out.push({
                rule: 'grouped-commented-tests',
                file,
                line: c.startLine,
                message: `this comment block groups ${count} commented-out tests under one reason — split it so each commented-out test is its own block with its own \`// TODO[BUG]: <reason>\` / \`// TODO[LIMITATION]: <reason>\` / \`// NOT-APPLICABLE: <reason>\` marker`,
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
            out.push({
                startLine: sf.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1,
                text: scanner.getTokenText(),
            })
        }
        tok = scanner.scan()
    }
    return out
}
