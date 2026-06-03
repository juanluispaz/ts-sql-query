#!/usr/bin/env bun
// Smoke / invariant check for the code indexer. Re-runs extraction in --no-resolve mode
// (fast: ~4 s, ~2 GB — no checker, no DB, no subprocess) and asserts a set of structural
// invariants on the row arrays IN MEMORY, so a refactor that silently breaks an extractor
// is caught. It does NOT exercise type resolution (that path is the slow/heavy one); it
// guards the SHAPE of the index — counts in range, referential integrity of the structural
// FKs, id uniqueness, the reconcile sources, the negative-type rows.
//
// Exits non-zero on the first failing invariant set. Usage: `bun run tests:index:verify`.

import { setResolveEnabled, buildProgram } from './resolve.js'
import { extractSrc } from './extractSrc.js'
import { reconcileSimplified } from './reconcileSimplified.js'
import { extractTests } from './extractTests.js'
import { extractDocTests } from './extractDocTests.js'
import { extractExamples } from './extractExamples.js'
import { extractNegTypeTests } from './extractNegTypeTests.js'
import { Ids } from './model.js'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : ` — ${detail}`}`)
    if (!ok) failures++
}
// every value in `childIds` must be present in `parentIds` (referential integrity)
function allIn(name: string, childIds: Iterable<number>, parentIds: Set<number>): void {
    let orphan: number | null = null, n = 0
    for (const id of childIds) { n++; if (!parentIds.has(id)) { orphan = id; break } }
    check(name, orphan === null, orphan === null ? '' : `orphan id ${orphan} (of ${n})`)
}

async function main(): Promise<void> {
    const t0 = performance.now()
    setResolveEnabled(false)   // structural smoke — keep it cheap
    const ids = new Ids()
    const { program, checker } = buildProgram()
    const src = extractSrc(program, checker, ids)
    const recon = reconcileSimplified(src, program)
    src.heritage.push(...recon.heritage)
    const tests = extractTests(program, checker, src.declMap, ids)
    const docs = extractDocTests(program, checker, src.declMap, ids)
    const examples = extractExamples(program, checker, src.declMap, ids)
    const negTypes = extractNegTypeTests(program, checker, src.declMap, ids)
    console.log(`code-indexer verify (name-based) — extracted in ${((performance.now() - t0) / 1000).toFixed(1)} s\n`)

    // ── counts in a sane range (catch an extractor that silently went empty) ──
    check('modules ≥ 100', src.modules.length >= 100, `${src.modules.length}`)
    check('symbols ≥ 1500', src.symbols.length >= 1500, `${src.symbols.length}`)
    check('public symbols ≥ 50', src.symbols.filter(s => s.is_public).length >= 50, `${src.symbols.filter(s => s.is_public).length}`)
    check('members ≥ 5000', src.members.length >= 5000, `${src.members.length}`)
    check('invocations ≥ 5000', src.invocations.length >= 5000, `${src.invocations.length}`)
    check('keyof operation edges ≥ 1', src.invocations.some(i => i.kind === 'operation'))
    check('test blocks ≥ 10000', tests.testBlocks.length >= 10000, `${tests.testBlocks.length}`)
    check('test refs ≥ 100000', tests.testRefs.length >= 100000, `${tests.testRefs.length}`)
    check('doc-test blocks ≥ 100', docs.docTestBlocks.length >= 100, `${docs.docTestBlocks.length}`)
    check('example blocks ≥ 100', examples.exampleBlocks.length >= 100, `${examples.exampleBlocks.length}`)
    check('neg-type assertions ≥ 100', negTypes.negTypes.length >= 100, `${negTypes.negTypes.length}`)

    // ── referential integrity of the STRUCTURAL FKs (populated regardless of resolve) ──
    const symbolIds = new Set(src.symbols.map(s => s.id))
    allIn('member.symbol_id → symbol', src.members.map(m => m.symbol_id), symbolIds)
    allIn('heritage.symbol_id → symbol', src.heritage.map(h => h.symbol_id), symbolIds)
    allIn('test_ref.test_block_id → test_block', tests.testRefs.map(r => r.test_block_id), new Set(tests.testBlocks.map(b => b.id)))
    allIn('doc_test_ref.doc_test_block_id → doc_test_block', docs.docTestRefs.map(r => r.doc_test_block_id), new Set(docs.docTestBlocks.map(b => b.id)))
    allIn('example_ref.example_block_id → example_block', examples.exampleRefs.map(r => r.example_block_id), new Set(examples.exampleBlocks.map(b => b.id)))
    allIn('neg_type_ref.neg_type_id → neg_type', negTypes.negTypeRefs.map(r => r.neg_type_id), new Set(negTypes.negTypes.map(n => n.id)))

    // ── id uniqueness (the shared Ids counter must hand out unique ids) ──
    check('symbol ids unique', symbolIds.size === src.symbols.length)
    check('member ids unique', new Set(src.members.map(m => m.id)).size === src.members.length)

    // ── reconcile: the three sources present + gap source vocabulary ──
    const sources = new Set(recon.reconcile.map(r => r.source))
    check("reconcile has source='master'", sources.has('master'))
    check("reconcile has source='doc'", sources.has('doc'))
    check('reconcile gap sources ⊆ {master,doc,doc-inquery}', recon.gaps.every(g => g.source === 'master' || g.source === 'doc' || g.source === 'doc-inquery'))
    check('partial rows emit no missing gaps', !recon.gaps.some(g => g.side === 'missing_in_simplified' && recon.reconcile.some(r => r.simplified_name === g.simplified_name && r.source === g.source && r.partial === 1)))

    // ── negative-type sanity ──
    check('neg_type: marker_line < target_line', negTypes.negTypes.every(n => n.marker_line < n.target_line))

    console.log(`\n${failures === 0 ? 'OK — all invariants hold' : `FAILED — ${failures} invariant(s) broken`}`)
    process.exit(failures === 0 ? 0 : 1)
}

await main()
