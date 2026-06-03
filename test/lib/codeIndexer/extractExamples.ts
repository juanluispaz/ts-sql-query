// Extract the LEGACY example suite (src/examples/) as its own dimension.
//
// An example_block is one example case; example_ref links the API names it
// references — the analogue of test_block/test_ref, answering "which example
// shows how to use <symbol>?". The segmentation differs by sub-suite because
// the two are structured differently:
//
//   - documentation/ (is_doc = 1): rich cases, each opened by a
//     `/* *** Preparation *** */` banner. A single case may contain SEVERAL
//     assertEquals (type checks + multiple queries), so the Preparation banner
//     is the correct case boundary — assertEquals would over-fragment it.
//     Block i = [banner_i, banner_{i+1}); refs are assigned to the last banner
//     at or before their position.
//
//   - everything else (is_doc = 0): flat cases with no banners; each closes
//     with one assertEquals (never two consecutive — verified empirically), so
//     the assertEquals call is the boundary. Block i = (assert_{i-1}, assert_i];
//     refs are assigned to the first assertEquals at or after their position.
//
// src/examples/prisma/ (generated client) is excluded, matching extractSrc.

import ts from 'typescript'
import { resolve } from 'node:path'
import { walkFiles } from './walk.js'
import { resolveToken } from './resolve.js'
import type { DeclMap } from './resolve.js'
import type { ExampleBlockRow, ExampleRefRow, Ids } from './model.js'

export interface ExampleExtract {
    exampleBlocks: ExampleBlockRow[]
    exampleRefs: ExampleRefRow[]
}

// A half-open [start, end) character interval = one example case.
interface Interval { start: number, end: number }

const PREPARATION = /\/\*\s*\*\*\*\s*Preparation\b/g

function isAssertEqualsCall(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'assertEquals'
}

// documentation/: boundaries = start offsets of each Preparation banner.
// Each block spans from its banner to the next banner (last → EOF).
function docIntervals(text: string): Interval[] {
    const starts: number[] = []
    PREPARATION.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = PREPARATION.exec(text)) !== null) starts.push(m.index)
    if (starts.length === 0) return []
    return starts.map((s, i) => ({ start: s, end: i + 1 < starts.length ? starts[i + 1]! : text.length }))
}

// non-documentation: boundaries = end offset of each assertEquals call.
// Each block spans from just after the previous boundary to this one.
function assertIntervals(sf: ts.SourceFile): Interval[] {
    const ends: number[] = []
    const collect = (n: ts.Node): void => {
        if (isAssertEqualsCall(n)) ends.push(n.getEnd())
        ts.forEachChild(n, collect)
    }
    collect(sf)
    ends.sort((a, b) => a - b)
    let prev = 0
    return ends.map(e => { const iv = { start: prev, end: e }; prev = e; return iv })
}

function processFile(relPath: string, ids: Ids, blocks: ExampleBlockRow[], refs: ExampleRefRow[], program: ts.Program, checker: ts.TypeChecker, declMap: DeclMap): void {
    const sf = program.getSourceFile(resolve(relPath))
    if (!sf) return
    const text = sf.text
    const isDoc = relPath.includes('/examples/documentation/') ? 1 : 0

    const intervals = isDoc ? docIntervals(text) : assertIntervals(sf)
    if (intervals.length === 0) return

    const lineOf = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line + 1

    // Create a block row per interval; keep ids parallel to intervals[].
    const blockIds = intervals.map((iv, i) => {
        const id = ids.next()
        blocks.push({
            id, file: relPath, is_doc: isDoc, ordinal: i + 1,
            start_line: lineOf(iv.start), end_line: lineOf(Math.max(iv.start, iv.end - 1)),
        })
        return id
    })

    // Assign a position to its interval (intervals are sorted, non-overlapping):
    // first interval whose end > pos and start <= pos.
    const intervalOf = (pos: number): number => {
        let lo = 0, hi = intervals.length - 1, ans = -1
        while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (intervals[mid]!.end > pos) { ans = mid; hi = mid - 1 } else lo = mid + 1
        }
        if (ans >= 0 && intervals[ans]!.start <= pos) return ans
        return -1   // outside any case (file scaffolding) → ignore
    }

    // One row per OCCURRENCE, with its 1-based line/col, assigned to the example
    // case (interval) it falls in. Count = COUNT(*) at query time.
    const pushRef = (token: ts.Node, name: string): void => {
        const idx = intervalOf(token.getStart(sf))
        if (idx < 0) return   // file scaffolding outside any case
        const lc = sf.getLineAndCharacterOfPosition(token.getStart(sf))
        const res = resolveToken(checker, declMap, token)
        refs.push({ example_block_id: blockIds[idx]!, symbol_name: name, line: lc.line + 1, col: lc.character + 1, resolved_symbol_id: res?.symbol_id ?? null, resolved_member_id: res?.member_id ?? null })
    }
    const visit = (n: ts.Node): void => {
        if (ts.isPropertyAccessExpression(n)) { pushRef(n.name, n.name.text); visit(n.expression); return }
        if (ts.isIdentifier(n)) pushRef(n, n.text)
        ts.forEachChild(n, visit)
    }
    visit(sf)
}

export function extractExamples(program: ts.Program, checker: ts.TypeChecker, declMap: DeclMap, ids: Ids): ExampleExtract {
    const files = walkFiles('src/examples', '.ts').filter(f => !f.startsWith('src/examples/prisma/'))
    const exampleBlocks: ExampleBlockRow[] = []
    const exampleRefs: ExampleRefRow[] = []
    for (const f of files.sort()) processFile(f, ids, exampleBlocks, exampleRefs, program, checker, declMap)
    return { exampleBlocks, exampleRefs }
}
