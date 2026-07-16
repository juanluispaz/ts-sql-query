#!/usr/bin/env bun
// Build the code index: parse src/ + simplifiedQueryDefinition + test/ + docs/ and
// write a queryable SQLite database (default test/lib/codeIndexer/generated/code-index.sqlite).
//
// The index is a disposable derived artifact — it's rebuilt from scratch each
// run. It lives in the tool's own generated/ folder (gitignored) rather than
// .test-report/, which the test harness wipes even when the index is still valid.
// Other tooling (the where-is searcher) queries it instead of re-parsing the tree.
//
// Usage:  npm run tests:index [-- --out <path>] [-- --no-resolve]
//         (or run the file directly: tsx/bun test/lib/codeIndexer/build.ts). --no-resolve = name-based, low-memory/fast build
//         (~3.6 GB / ~15 s vs ~12 GB / ~2 min): resolved_*_id FKs stay NULL, everything else same.
//         This build is memory-bound (one TS program over src/ + the whole matrix, ~70% of the peak).
//         `npm run tests:index` raises node's heap for it; see scripts/tests-index.sh --help.

import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { openIndexDb, BatchedRows } from './db.js'
import { SCHEMA, SCHEMA_VERSION } from './schema.js'
import { Ids, INSERTS } from './model.js'
import { buildProgram, setResolveEnabled } from './resolve.js'
import { extractSrc } from './extractSrc.js'
import { extractExtras, extractTodoMarkers, extractEmittedSql } from './extractExtras.js'
import { reconcileSimplified } from './reconcileSimplified.js'
import { extractTests } from './extractTests.js'
import { extractDocTests } from './extractDocTests.js'
import { extractExamples } from './extractExamples.js'
import { extractNegTypeTests } from './extractNegTypeTests.js'

const DEFAULT_OUT = 'test/lib/codeIndexer/generated/code-index.sqlite'

const BATCH_SIZE = 250_000

/**
 * `--sink true|false` — stream each dimension out in batches as it is detected (true), or
 * buffer it in full and write it in one transaction (false). An infinite batch IS the
 * buffered mode: nothing ever trips the flush threshold, so the single final flush writes
 * the lot — one knob, two behaviours, no second code path.
 *
 * The default is per runtime because the two engines fail differently, not because one mode
 * is better:
 *   - node (V8): stream. V8 dies at a FIXED ceiling (--max-old-space-size), so a lower peak
 *     is what keeps the build alive at all; ~12 GB streamed vs ~13-15 GB buffered, for ~20%
 *     wall. Measured, and consistent across runs.
 *   - bun (JSC): buffer. No ceiling to hit, so peak is not existential, and bun:sqlite is
 *     very syscall-heavy (sys time dwarfs user), which favours fewer, larger transactions.
 *     NOTE: this default is REASONED, not measured — bun's numbers on a 24 GB box are not
 *     reproducible at this peak (two identical runs came out 219 s and 402 s, sys 417 s and
 *     716 s: it is paging, and the variance swamps the effect). Re-measure on a box with
 *     real headroom before trusting it, and flip it with `--sink true` if it looks wrong.
 */
function parseArgs(argv: string[]): { out: string, resolve: boolean, batch: number } {
    const i = argv.indexOf('--out')
    const s = argv.indexOf('--sink')
    let sink: boolean
    if (s >= 0) {
        const v = argv[s + 1]
        if (v !== 'true' && v !== 'false') throw new Error(`--sink takes 'true' or 'false', got: ${v ?? '(nothing)'}`)
        sink = v === 'true'
    } else {
        sink = typeof (globalThis as { Bun?: unknown }).Bun === 'undefined'
    }
    return {
        out: i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_OUT,
        resolve: !argv.includes('--no-resolve'),
        batch: sink ? BATCH_SIZE : Infinity,
    }
}

type Resolvable = { resolved_symbol_id: number | null }
const resolvedPct = (rows: Resolvable[]): string =>
    rows.length ? `${(100 * rows.filter(r => r.resolved_symbol_id !== null).length / rows.length).toFixed(0)}% resolved` : '—'
// Same figure for a streamed dimension: its rows are already written and freed, so the
// counts come from the sink instead of a final `filter` over an array that no longer exists.
const batchedPct = (b: { total: number, resolved: number }): string =>
    b.total ? `${(100 * b.resolved / b.total).toFixed(0)}% resolved` : '—'

// Git HEAD + dirty flag for the meta table (staleness detection). Null when not a git repo.
function gitInfo(): { rev: string | null, dirty: boolean } {
    try {
        const rev = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
        const dirty = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0
        return { rev, dirty }
    } catch { return { rev: null, dirty: false } }
}

async function main(): Promise<void> {
    const { out, resolve, batch } = parseArgs(process.argv.slice(2))
    setResolveEnabled(resolve)   // --no-resolve → name-based, low-memory build (resolved_*_id NULL)
    const pct = (rows: Resolvable[]): string => resolve ? resolvedPct(rows) : 'name-based'
    const t0 = performance.now()
    const ids = new Ids()

    // ONE unified TypeScript build over src/ + test/ (test/tsconfig.json includes both).
    // Every extractor reads its complete, COMPILED source files from this Program and
    // resolves references through its checker — nothing is parsed in isolation.
    const { program, checker } = buildProgram()
    const tProgram = performance.now()

    mkdirSync(dirname(out), { recursive: true })
    for (const f of [out, `${out}-wal`, `${out}-shm`]) if (existsSync(f)) rmSync(f)
    const db = await openIndexDb(out)
    db.exec(SCHEMA)

    // Build metadata (key/value) — lets a consumer detect a stale or incompatible index.
    const git = gitInfo()
    const meta: [string, string | null][] = [
        ['schema_version', String(SCHEMA_VERSION)],
        ['built_at', new Date().toISOString()],
        ['git_rev', git.rev],
        ['git_dirty', git.dirty ? '1' : '0'],
        ['resolve', resolve ? 'resolved' : 'name-based'],
        ['rows', Number.isFinite(batch) ? `streamed/${batch}` : 'buffered'],
        ['tool', 'code-indexer'],
    ]
    db.insertMany(INSERTS.meta.sql, meta, ([key, value]) => INSERTS.meta.row({ key, value }))

    // Insert each dimension AS SOON AS it's extracted and let it go out of scope before the
    // next runs, so the big per-occurrence ref arrays (test ~700k, example ~190k) never all
    // live at once — only one dimension's rows + the persistent Program/declMap are resident.
    const lines: string[] = []

    // src + reconcile: inserted together (reconcile needs the full src rows). Only the declMap
    // is returned — the src/recon row arrays become unreachable here and can be reclaimed.
    const declMap = (() => {
        const src = extractSrc(program, checker, ids)
        // Reconcile the simplified query definitions with the real implementing classes:
        // synthesised heritage edges (so they're discoverable) + the member-coverage diff.
        const recon = reconcileSimplified(src, program)
        src.heritage.push(...recon.heritage)
        db.insertMany(INSERTS.module.sql, src.modules, INSERTS.module.row)
        db.insertMany(INSERTS.symbol.sql, src.symbols, INSERTS.symbol.row)
        db.insertMany(INSERTS.member.sql, src.members, INSERTS.member.row)
        db.insertMany(INSERTS.heritage.sql, src.heritage, INSERTS.heritage.row)
        db.insertMany(INSERTS.reconcile.sql, recon.reconcile, INSERTS.reconcile.row)
        db.insertMany(INSERTS.reconcileGap.sql, recon.gaps, INSERTS.reconcileGap.row)
        db.insertMany(INSERTS.invocation.sql, src.invocations, INSERTS.invocation.row)
        // schema-v4 extras: version gates + emitted-SQL literals + producer edges + bug markers.
        const extras = extractExtras(program, checker, src.declMap, src.modules, ids)
        const todos = extractTodoMarkers(program, ids)
        const emittedSql = extractEmittedSql(program, ids)
        db.insertMany(INSERTS.versionGate.sql, extras.versionGates, INSERTS.versionGate.row)
        db.insertMany(INSERTS.sqlEmit.sql, extras.sqlEmits, INSERTS.sqlEmit.row)
        db.insertMany(INSERTS.producer.sql, extras.producers, INSERTS.producer.row)
        db.insertMany(INSERTS.reference.sql, extras.references, INSERTS.reference.row)
        db.insertMany(INSERTS.todoMarker.sql, todos, INSERTS.todoMarker.row)
        db.insertMany(INSERTS.emittedSql.sql, emittedSql, INSERTS.emittedSql.row)
        lines.push(
            `  modules:     ${src.modules.length}`,
            `  symbols:     ${src.symbols.length}  (public: ${src.symbols.filter(s => s.is_public).length})`,
            `  members:     ${src.members.length}`,
            `  heritage:    ${src.heritage.length}  (simplified edges: ${recon.heritage.length})`,
            `  reconcile:   ${recon.reconcile.length}  (gap members: ${recon.gaps.length})`,
            `  invocations: ${src.invocations.length}  (${pct(src.invocations)})`,
            `  version gates:${extras.versionGates.length}  ·  sql emits: ${extras.sqlEmits.length}  ·  producers: ${extras.producers.length}  ·  todo markers: ${todos.length} (BUG: ${todos.filter(t => t.tag === 'BUG').length})  ·  emitted sql: ${emittedSql.length}`,
            `  references:  ${extras.references.length}  (${['type-arg', 'param', 'field', 'new', 'property', 'brand'].map(role => `${role}: ${extras.references.filter(r => r.role === role).length}`).join('  ·  ')})`,
        )
        return src.declMap
    })()

    {
        // Test refs are the biggest dimension by ~18x (>3.5M rows) and grow with the matrix,
        // so both dimensions stream to the DB as they are detected rather than piling up.
        // The refs sink flushes blocks first: test_ref has a FOREIGN KEY into test_block,
        // and node:sqlite enforces it (bun:sqlite / better-sqlite3 do not).
        const testBlocks = new BatchedRows(db, INSERTS.testBlock.sql, INSERTS.testBlock.row, batch)
        const testRefs = new BatchedRows(db, INSERTS.testRef.sql, INSERTS.testRef.row, batch, () => testBlocks.flush())
        extractTests(program, checker, declMap, ids, testBlocks, testRefs)
        testRefs.flush()
        lines.push(`  test blocks: ${testBlocks.total}`, `  test refs:   ${testRefs.total}  (${resolve ? batchedPct(testRefs) : 'name-based'})`)
    }
    {
        const d = extractDocTests(program, checker, declMap, ids)
        db.insertMany(INSERTS.docTestBlock.sql, d.docTestBlocks, INSERTS.docTestBlock.row)
        db.insertMany(INSERTS.docTestRef.sql, d.docTestRefs, INSERTS.docTestRef.row)
        lines.push(`  doc-test blk:${d.docTestBlocks.length}`, `  doc-test ref:${d.docTestRefs.length}  (${pct(d.docTestRefs)})`)
    }
    {
        const e = extractExamples(program, checker, declMap, ids)
        db.insertMany(INSERTS.exampleBlock.sql, e.exampleBlocks, INSERTS.exampleBlock.row)
        db.insertMany(INSERTS.exampleRef.sql, e.exampleRefs, INSERTS.exampleRef.row)
        lines.push(`  example blk: ${e.exampleBlocks.length}`, `  example ref: ${e.exampleRefs.length}  (${pct(e.exampleRefs)})`)
    }
    {
        const n = extractNegTypeTests(program, checker, declMap, ids)
        db.insertMany(INSERTS.negType.sql, n.negTypes, INSERTS.negType.row)
        db.insertMany(INSERTS.negTypeRef.sql, n.negTypeRefs, INSERTS.negTypeRef.row)
        lines.push(`  neg-type:    ${n.negTypes.length}  (refs: ${n.negTypeRefs.length}, ${pct(n.negTypeRefs)})`)
    }

    const backend = db.backend
    db.close()
    const tWrite = performance.now()

    console.log(`code index → ${out}  [${backend}]`)
    console.log(`  build:       ${git.rev ? git.rev.slice(0, 8) : '(no git)'}${git.dirty ? '-dirty' : ''} · ${resolve ? 'resolved' : 'name-based'} · schema v${SCHEMA_VERSION}`)
    for (const l of lines) console.log(l)
    console.log(`  program: ${(tProgram - t0).toFixed(0)} ms · extract+write: ${(tWrite - tProgram).toFixed(0)} ms · total: ${(tWrite - t0).toFixed(0)} ms`)
}

await main()
