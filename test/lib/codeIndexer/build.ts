#!/usr/bin/env bun
// Build the code index: parse src/ + simplifiedQueryDefinition + test/ + docs/ and
// write a queryable SQLite database (default test/lib/codeIndexer/generated/code-index.sqlite).
//
// The index is a disposable derived artifact — it's rebuilt from scratch each
// run. It lives in the tool's own generated/ folder (gitignored) rather than
// .test-report/, which the test harness wipes even when the index is still valid.
// Other tooling (the where-is searcher) queries it instead of re-parsing the tree.
//
// Usage:  bun test/lib/codeIndexer/build.ts [--out <path>] [--no-resolve]
//         (or via `bun run tests:index`). --no-resolve = name-based, low-memory/fast build
//         (~1–2 GB / ~3 s vs ~8 GB / ~28 s): resolved_*_id FKs stay NULL, everything else same.

import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { openIndexDb } from './db.js'
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

function parseArgs(argv: string[]): { out: string, resolve: boolean } {
    const i = argv.indexOf('--out')
    return { out: i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_OUT, resolve: !argv.includes('--no-resolve') }
}

type Resolvable = { resolved_symbol_id: number | null }
const resolvedPct = (rows: Resolvable[]): string =>
    rows.length ? `${(100 * rows.filter(r => r.resolved_symbol_id !== null).length / rows.length).toFixed(0)}% resolved` : '—'

// Git HEAD + dirty flag for the meta table (staleness detection). Null when not a git repo.
function gitInfo(): { rev: string | null, dirty: boolean } {
    try {
        const rev = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
        const dirty = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0
        return { rev, dirty }
    } catch { return { rev: null, dirty: false } }
}

async function main(): Promise<void> {
    const { out, resolve } = parseArgs(process.argv.slice(2))
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
        ['tool', 'code-indexer'],
    ]
    db.insertMany(INSERTS.meta.sql, meta.map(([key, value]) => INSERTS.meta.row({ key, value })))

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
        db.insertMany(INSERTS.module.sql, src.modules.map(INSERTS.module.row))
        db.insertMany(INSERTS.symbol.sql, src.symbols.map(INSERTS.symbol.row))
        db.insertMany(INSERTS.member.sql, src.members.map(INSERTS.member.row))
        db.insertMany(INSERTS.heritage.sql, src.heritage.map(INSERTS.heritage.row))
        db.insertMany(INSERTS.reconcile.sql, recon.reconcile.map(INSERTS.reconcile.row))
        db.insertMany(INSERTS.reconcileGap.sql, recon.gaps.map(INSERTS.reconcileGap.row))
        db.insertMany(INSERTS.invocation.sql, src.invocations.map(INSERTS.invocation.row))
        // schema-v4 extras: version gates + emitted-SQL literals + producer edges + bug markers.
        const extras = extractExtras(program, checker, src.declMap, src.modules, ids)
        const todos = extractTodoMarkers(program, ids)
        const emittedSql = extractEmittedSql(program, ids)
        db.insertMany(INSERTS.versionGate.sql, extras.versionGates.map(INSERTS.versionGate.row))
        db.insertMany(INSERTS.sqlEmit.sql, extras.sqlEmits.map(INSERTS.sqlEmit.row))
        db.insertMany(INSERTS.producer.sql, extras.producers.map(INSERTS.producer.row))
        db.insertMany(INSERTS.reference.sql, extras.references.map(INSERTS.reference.row))
        db.insertMany(INSERTS.todoMarker.sql, todos.map(INSERTS.todoMarker.row))
        db.insertMany(INSERTS.emittedSql.sql, emittedSql.map(INSERTS.emittedSql.row))
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
        const t = extractTests(program, checker, declMap, ids)
        db.insertMany(INSERTS.testBlock.sql, t.testBlocks.map(INSERTS.testBlock.row))
        db.insertMany(INSERTS.testRef.sql, t.testRefs.map(INSERTS.testRef.row))
        lines.push(`  test blocks: ${t.testBlocks.length}`, `  test refs:   ${t.testRefs.length}  (${pct(t.testRefs)})`)
    }
    {
        const d = extractDocTests(program, checker, declMap, ids)
        db.insertMany(INSERTS.docTestBlock.sql, d.docTestBlocks.map(INSERTS.docTestBlock.row))
        db.insertMany(INSERTS.docTestRef.sql, d.docTestRefs.map(INSERTS.docTestRef.row))
        lines.push(`  doc-test blk:${d.docTestBlocks.length}`, `  doc-test ref:${d.docTestRefs.length}  (${pct(d.docTestRefs)})`)
    }
    {
        const e = extractExamples(program, checker, declMap, ids)
        db.insertMany(INSERTS.exampleBlock.sql, e.exampleBlocks.map(INSERTS.exampleBlock.row))
        db.insertMany(INSERTS.exampleRef.sql, e.exampleRefs.map(INSERTS.exampleRef.row))
        lines.push(`  example blk: ${e.exampleBlocks.length}`, `  example ref: ${e.exampleRefs.length}  (${pct(e.exampleRefs)})`)
    }
    {
        const n = extractNegTypeTests(program, checker, declMap, ids)
        db.insertMany(INSERTS.negType.sql, n.negTypes.map(INSERTS.negType.row))
        db.insertMany(INSERTS.negTypeRef.sql, n.negTypeRefs.map(INSERTS.negTypeRef.row))
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
