// Rule `uuid-literal` — a string literal that LOOKS like a UUID but is not a
// valid one.
//
// Threat (a real, shipped bug): `transformValueToDB` for `'uuid'` only checks
// `typeof value === 'string'` (AbstractConnection.ts), NOT the format — so a
// malformed UUID literal passes under the mock and is rejected only by a real
// engine's `uuid` cast. An agent that runs the suite mock-only (the full real
// pass takes >10 min) leaves the bad test green. This rule catches it
// statically, with no real DB and no type checker.
//
// Anchor: the SHAPE of the literal itself (per project decision — "find strings
// that look like a UUID and validate them"). No `ts.Program` is needed, so the
// rule stays in the ~1 s syntactic lane. It does NOT try to know whether a
// literal sits in a `uuid` position (that needs the checker) — a UUID-looking
// string is almost always an attempted UUID regardless of position.
//
// `looks like a UUID` is the OR of two narrow patterns, so a hyphenated English
// phrase (`delete-with-or-joined-conditions` — a test name with 5 groups of
// UUID-ish lengths) is NOT mistaken for one:
//   - HEX_LOOSE: hex-and-hyphen only, 5 groups in the 8-4-4-4-12 shape with a
//     ±2 length tolerance — catches a truncated / over-long / wrong-length real
//     UUID. English words contain non-hex letters, so they never match.
//   - SHAPE_EXACT: the exact 8-4-4-4-12 grouping but alphanumeric — catches a
//     single non-hex typo (`…bbcd52g`) in an otherwise perfectly shaped UUID.
//     A phrase whose groups aren't exactly 8-4-4-4-12 never matches.
// `valid` = the strict 8-4-4-4-12 hex form a real engine accepts. Flagged iff it
// looks like a UUID but is not valid. A `'not-a-uuid'` placeholder matches
// neither pattern and is out of scope (distinguishing it needs the type checker).

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

const HEX_LOOSE = /^[0-9a-fA-F]{6,10}-[0-9a-fA-F]{2,6}-[0-9a-fA-F]{2,6}-[0-9a-fA-F]{2,6}-[0-9a-fA-F]{10,14}$/
const SHAPE_EXACT = /^[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$/
const VALID_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function isMalformedUuid(value: string): boolean {
    return (HEX_LOOSE.test(value) || SHAPE_EXACT.test(value)) && !VALID_UUID.test(value)
}

export function checkUuidLiterals(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && isMalformedUuid(n.text)) {
            out.push({
                rule: 'uuid-literal',
                file,
                line: lineOf(sf, n),
                message: `string literal "${n.text}" looks like a UUID but is not a valid one (not 8-4-4-4-12 hex) — the mock accepts any string, but a real engine's uuid cast rejects it, so it passes mock-only and fails under --docker. Fix the literal`,
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
