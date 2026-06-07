// Suppression-comment rules — one rule per suppression MECHANISM, split so each
// can carry its own severity and be promoted independently (the project decision
// is "everything `warn` for now; separate rules let us tune severity later").
//
// The blunt siblings of `as-any` / `any-type`: where those catch a cast / type
// annotation that silences the checker in an EXPRESSION, these catch the same
// move made in a COMMENT directive — even blunter, because a comment suppresses
// whatever sits on the next line wholesale.
//
//   - `ts-ignore`            `@ts-ignore` / `@ts-nocheck` — silences EVERY error
//                            on the next line. Forbidden EVERYWHERE in the tests
//                            (incl. the negative-type cells): the line-scoped,
//                            error-asserting `@ts-expect-error` is the tool for
//                            negative-type tests, never the blanket `@ts-ignore`.
//   - `ts-expect-error`      `@ts-expect-error` OUTSIDE `types.negative/`. Inside
//                            those cells it is the legitimate negative-type
//                            assertion (and they are excluded from the walk, so
//                            naturally exempt); anywhere else it is a type-error
//                            bypass ("…the runtime accepts this SQL"), a smell.
//   - `eslint-disable-type`  an `eslint-disable*` of a TYPE-SOUNDNESS lint
//                            (`no-explicit-any`, `no-unsafe-*`, `ban-ts-comment`)
//                            or a BARE disable (no rule named → disables all):
//                            the lint twin of `as-any` / `any-type`.
//   - `eslint-disable-other` an `eslint-disable*` of any other (non-type) lint
//                            (`no-unused-vars`, …) — tracked separately so the
//                            type-soundness bucket stays clean.
//
// Engine: the TS scanner enumerates comments (so a string or live code that
// merely contains the text is never mistaken for a directive), no type checker.
// `checkSuppressions` runs over the walked cells; `tsIgnoreOnly` restricts it to
// the `ts-ignore` rule for the negative-type cells (the only rule that scans
// there).

import ts from 'typescript'
import type { Finding } from '../types.js'

const TS_IGNORE = /@ts-ignore\b|@ts-nocheck\b/
const TS_EXPECT_ERROR = /@ts-expect-error\b/
const ESLINT_DISABLE = /eslint-disable(?:-next-line|-line)?\b([^*]*)/
// Type-soundness lints — the ones whose suppression hides a type problem (the
// `as-any` / `any-type` twin), as opposed to a stylistic lint like no-unused-vars.
const TYPE_LINT = /\bno-explicit-any\b|\bno-unsafe-[a-z-]+\b|\bban-ts-comment\b/

interface Cmt { line: number, text: string }

function scanComments(sf: ts.SourceFile): Cmt[] {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, sf.text)
    const out: Cmt[] = []
    let tok = scanner.scan()
    while (tok !== ts.SyntaxKind.EndOfFileToken) {
        if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
            out.push({
                line: sf.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1,
                text: scanner.getTokenText(),
            })
        }
        tok = scanner.scan()
    }
    return out
}

// Does an `eslint-disable*` directive target a type-soundness lint (or disable
// everything)? Returns null when the comment carries no eslint-disable directive.
function eslintBucket(text: string): 'type' | 'other' | null {
    const m = ESLINT_DISABLE.exec(text)
    if (!m) return null
    // The rule list after the directive, minus a trailing `-- description`.
    const rest = (m[1] ?? '').replace(/--.*$/s, '').replace(/\*\/\s*$/, '').trim()
    if (rest === '') return 'type' // bare disable — turns off every lint, type rules included
    return TYPE_LINT.test(rest) ? 'type' : 'other'
}

export function checkSuppressions(sf: ts.SourceFile, file: string, tsIgnoreOnly = false): Finding[] {
    const out: Finding[] = []
    for (const c of scanComments(sf)) {
        if (TS_IGNORE.test(c.text)) {
            out.push({
                rule: 'ts-ignore',
                file,
                line: c.line,
                message: '`@ts-ignore` / `@ts-nocheck` silences every type error on the next line — the bluntest checker bypass and the symptom of a test the public API does not actually support. It is forbidden everywhere in the tests; a negative-type assertion uses the line-scoped `@ts-expect-error` inside a `types.negative/` cell instead',
            })
        }
        if (tsIgnoreOnly) continue
        if (TS_EXPECT_ERROR.test(c.text)) {
            out.push({
                rule: 'ts-expect-error',
                file,
                line: c.line,
                message: '`@ts-expect-error` outside a `types.negative/` cell asserts that this line has a type error where it should compile cleanly — usually a type-limitation bypass ("the runtime accepts this SQL"). Build the query through the public typed API; a genuine negative-type assertion belongs in a `types.negative/` cell',
            })
        }
        const bucket = eslintBucket(c.text)
        if (bucket === 'type') {
            out.push({
                rule: 'eslint-disable-type',
                file,
                line: c.line,
                message: 'an `eslint-disable` of a type-soundness lint (`no-explicit-any` / `no-unsafe-*` / `ban-ts-comment`, or a bare disable) is the lint twin of `as-any` / `any-type` — it silences the rule that would flag an unrealistic, type-dodging test. Build through the public typed API instead of disabling the lint',
            })
        } else if (bucket === 'other') {
            out.push({
                rule: 'eslint-disable-other',
                file,
                line: c.line,
                message: 'an `eslint-disable` directive suppresses a lint rule — tracked so suppressions stay visible. If the lint is right, fix the code rather than disabling it (a deliberately-unused binding can often be expressed without a blanket disable)',
            })
        }
    }
    return out
}
