// Extract the NEGATIVE-TYPE dimension: the `test/db/<db>/types.negative/` cells, which assert
// with `// @ts-expect-error` that a misuse of the API must NOT compile. These files are
// compile-only (the wrapping function is never invoked at runtime), so the generic test
// dimension only sees a coarse block per file. Here we record ONE row per directive:
//   - the RULE (the comment text after @ts-expect-error),
//   - the asserted-to-fail code line (the next code line — the directive may sit on a
//     statement OR on a property inside an object literal; either way target_line is next),
//   - the enclosing scope to read,
// and neg_type_ref links the API names in the STATEMENT that contains the target line,
// resolved through the checker — answering "WHICH API + line does this negative test guard?".
//
// Reads the COMPILED source file from the unified Program (no isolated parse).

import ts from 'typescript'
import { resolve } from 'node:path'
import { walkFiles } from './walk.js'
import { cellOf, collectRefPositions } from './extractTests.js'
import { resolveToken } from './resolve.js'
import type { DeclMap } from './resolve.js'
import type { Ids, NegTypeRow, NegTypeRefRow } from './model.js'

export interface NegTypeExtract {
    negTypes: NegTypeRow[]
    negTypeRefs: NegTypeRefRow[]
}

const DIRECTIVE_RE = /^\s*\/\/\s*@ts-expect-error\b\s*(.*)$/

interface Span { start: number, end: number, node: ts.Node }
interface NamedSpan { start: number, end: number, name: string }

function processFile(relPath: string, ids: Ids, negTypes: NegTypeRow[], refs: NegTypeRefRow[], program: ts.Program, checker: ts.TypeChecker, declMap: DeclMap): void {
    const cell = cellOf(relPath)
    if (!cell || cell.version !== 'types.negative') return
    const sf = program.getSourceFile(resolve(relPath))
    if (!sf) return
    const fileLines = sf.text.split('\n')
    const lineOf = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line + 1

    // Statement-level nodes (to find the one CONTAINING a target line) + named function
    // scopes (for the `scope` context field).
    const statements: Span[] = []
    const scopes: NamedSpan[] = []
    const collect = (n: ts.Node): void => {
        if (ts.isExpressionStatement(n) || ts.isVariableStatement(n) || ts.isReturnStatement(n)) {
            statements.push({ start: lineOf(n.getStart(sf)), end: lineOf(n.getEnd()), node: n })
        }
        if (ts.isFunctionDeclaration(n) && n.name) scopes.push({ start: lineOf(n.getStart(sf)), end: lineOf(n.getEnd()), name: n.name.text })
        ts.forEachChild(n, collect)
    }
    collect(sf)

    // Smallest statement / scope whose span contains a 1-based line.
    const smallestContaining = (spans: Span[], line: number): Span | null => {
        let best: Span | null = null
        for (const s of spans) if (s.start <= line && line <= s.end && (!best || (s.end - s.start) < (best.end - best.start))) best = s
        return best
    }
    const scopeOf = (line: number): string | null => {
        let best: NamedSpan | null = null
        for (const s of scopes) if (s.start <= line && line <= s.end && (!best || (s.end - s.start) < (best.end - best.start))) best = s
        return best ? best.name : null
    }

    for (let i = 0; i < fileLines.length; i++) {
        const m = DIRECTIVE_RE.exec(fileLines[i]!)
        if (!m) continue
        const markerLine = i + 1
        // The asserted-to-fail line: next line that is neither blank nor a `//` comment.
        let targetLine = -1
        for (let j = i + 1; j < fileLines.length; j++) {
            const t = fileLines[j]!.trim()
            if (t === '' || t.startsWith('//')) continue
            targetLine = j + 1; break
        }
        if (targetLine < 0) continue   // dangling directive (shouldn't happen)

        const negId = ids.next()
        negTypes.push({
            id: negId, file: relPath, db: cell.db, marker_line: markerLine, target_line: targetLine,
            description: m[1]!.trim() || null,
            snippet: fileLines[targetLine - 1]!.trim().slice(0, 400) || null,
            scope: scopeOf(markerLine),
        })

        // Refs from the STATEMENT containing the target line (the API context), resolved.
        const stmt = smallestContaining(statements, targetLine)
        if (stmt) {
            for (const r of collectRefPositions(stmt.node, sf)) {
                const res = resolveToken(checker, declMap, r.node)
                refs.push({ neg_type_id: negId, symbol_name: r.name, line: r.line, col: r.col, resolved_symbol_id: res?.symbol_id ?? null, resolved_member_id: res?.member_id ?? null })
            }
        }
    }
}

export function extractNegTypeTests(program: ts.Program, checker: ts.TypeChecker, declMap: DeclMap, ids: Ids): NegTypeExtract {
    const files = walkFiles('test/db', '.test.ts').filter(f => f.includes('/types.negative/'))
    const negTypes: NegTypeRow[] = []
    const negTypeRefs: NegTypeRefRow[] = []
    for (const f of files.sort()) processFile(f, ids, negTypes, negTypeRefs, program, checker, declMap)
    return { negTypes, negTypeRefs }
}
