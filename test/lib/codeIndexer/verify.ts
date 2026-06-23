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
import { extractExtras, extractTodoMarkers, extractEmittedSql } from './extractExtras.js'
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
    const extras = extractExtras(program, checker, src.declMap, src.modules, ids)
    const todos = extractTodoMarkers(program, ids)
    const emittedSql = extractEmittedSql(program, ids)
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

    // ── composite type aliases feed the heritage closure (extractSrc.emitAliasComposition) ──
    // `type AB = A & B` (and a simple alias `type X = Y`) decomposes into synthetic `extends` edges so an
    // `interface Foo extends AB` / `class C implements AB` reaches A's and B's members through the
    // surface/heritage closure instead of dead-ending on the member-less alias node. The `Connection`
    // alias (= AbstractConnection<DB>) guarantees at least one such edge.
    const typeAliasIds = new Set(src.symbols.filter(s => s.kind === 'type').map(s => s.id))
    check('composite type aliases emit heritage edges', src.heritage.some(h => typeAliasIds.has(h.symbol_id)),
        `${src.heritage.filter(h => typeAliasIds.has(h.symbol_id)).length}`)
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

    // ── publics-marking phase: flags derived and within their vocabulary ──
    check('member.visibility ⊆ {public,public_impl,internal}', src.members.every(m => m.visibility === 'public' || m.visibility === 'public_impl' || m.visibility === 'internal'))
    check('is_public ⇒ is_public_surface', src.symbols.every(s => s.is_public !== 1 || s.is_public_surface === 1))
    check('some public members exist', src.members.some(m => m.visibility === 'public'), `${src.members.filter(m => m.visibility === 'public').length}`)
    check('some public_impl members exist', src.members.some(m => m.visibility === 'public_impl'), `${src.members.filter(m => m.visibility === 'public_impl').length}`)
    check('is_implementation ⊆ {0,1}', src.members.every(m => m.is_implementation === 0 || m.is_implementation === 1))
    check('some implementation members exist', src.members.some(m => m.is_implementation === 1), `${src.members.filter(m => m.is_implementation === 1).length}`)
    check('overloaded methods have ≥1 signature + the impl', (() => { const k = (m: typeof src.members[number]): string => `${m.symbol_id}:${m.name}`; const byKey = new Map<string, typeof src.members>(); for (const m of src.members) { const l = byKey.get(k(m)) ?? []; if (!l.length) byKey.set(k(m), l); l.push(m) } for (const g of byKey.values()) if (g.length > 1 && g.some(m => m.is_implementation === 1)) return g.filter(m => m.is_implementation === 0).length >= 1; return true })())
    check('is_abstract ⇒ class', src.symbols.every(s => s.is_abstract !== 1 || s.kind === 'class'))
    check('some abstract classes exist', src.symbols.some(s => s.is_abstract === 1), `${src.symbols.filter(s => s.is_abstract === 1).length}`)

    // ── negative-type sanity ──
    check('neg_type: marker_line < target_line', negTypes.negTypes.every(n => n.marker_line < n.target_line))

    // ── schema-v4 extras (version gates / sql emits / producers / bug markers) ──
    check('version gates ≥ 1', extras.versionGates.length >= 1, `${extras.versionGates.length}`)
    check('version gates carry a numeric breakpoint', extras.versionGates.every(g => /\d/.test(g.breakpoint)))
    check('sql emits ≥ 100', extras.sqlEmits.length >= 100, `${extras.sqlEmits.length}`)
    check('sql emits lowercased', extras.sqlEmits.every(e => e.literal_lc === e.literal.toLowerCase()))
    check('producers ≥ 1', extras.producers.length >= 1, `${extras.producers.length}`)
    allIn('producer.member_id → member', extras.producers.map(p => p.member_id), new Set(src.members.map(m => m.id)))
    allIn('producer.produces_symbol_id → symbol', extras.producers.map(p => p.produces_symbol_id), symbolIds)
    // schema-v5 reference dimension. It is RESOLUTION-based (resolveToken honours the --no-resolve
    // guard), and this verify re-extracts in --no-resolve mode, so the table is EMPTY here by design
    // (like the resolved_* FKs going NULL). The integrity/role-shape checks below hold vacuously when
    // empty and meaningfully when populated; the real-build count is asserted by the searcher smoke.
    const REF_ROLES = new Set(['type-arg', 'param', 'field', 'new', 'property', 'brand'])
    check('references roles ⊆ {type-arg,param,field,new,property,brand}', extras.references.every(r => REF_ROLES.has(r.role)))
    check('references empty under --no-resolve (resolution-gated)', extras.references.length === 0, `${extras.references.length}`)
    check('type roles carry a symbol FK, no member FK', extras.references.filter(r => r.role !== 'property').every(r => r.resolved_symbol_id !== null && r.resolved_member_id === null))
    allIn('reference.enclosing_member_id → member', extras.references.map(r => r.enclosing_member_id).filter((x): x is number => x !== null), new Set(src.members.map(m => m.id)))
    allIn('reference.enclosing_symbol_id → symbol', extras.references.map(r => r.enclosing_symbol_id).filter((x): x is number => x !== null), symbolIds)
    check('property refs carry a member FK, no symbol FK', extras.references.filter(r => r.role === 'property').every(r => r.resolved_member_id !== null && r.resolved_symbol_id === null))
    allIn('reference.resolved_symbol_id → symbol', extras.references.map(r => r.resolved_symbol_id).filter((x): x is number => x !== null), symbolIds)
    allIn('reference.resolved_member_id → member', extras.references.map(r => r.resolved_member_id).filter((x): x is number => x !== null), new Set(src.members.map(m => m.id)))
    allIn('reference.module_id → module', extras.references.map(r => r.module_id), new Set(src.modules.map(m => m.id)))
    check('todo markers under test/', todos.every(b => b.file.startsWith('test/')))
    check('todo markers ≥ 1', todos.length >= 1, `${todos.length}`)
    check('some TODO[BUG] markers tagged', todos.some(t => t.tag === 'BUG'), `BUG: ${todos.filter(t => t.tag === 'BUG').length}`)
    check('emitted sql ≥ 1000', emittedSql.length >= 1000, `${emittedSql.length}`)
    check('emitted sql sources ⊆ {test,doc}', emittedSql.every(e => e.source === 'test' || e.source === 'doc'))
    check('emitted sql looks like SQL', emittedSql.every(e => /^(select|insert|update|delete|with|create|drop|alter|truncate|begin|commit|rollback|savepoint|merge|set )/i.test(e.sql)))
    const KNOWN_DBS = new Set(['mariadb', 'mysql', 'oracle', 'postgres', 'sqlite', 'sqlserver'])
    check('example.db ⊆ known dbs ∪ null', examples.exampleBlocks.every(b => b.db === null || KNOWN_DBS.has(b.db)))
    check('most example blocks have a db', examples.exampleBlocks.filter(b => b.db !== null).length > examples.exampleBlocks.length * 0.8, `${examples.exampleBlocks.filter(b => b.db !== null).length}/${examples.exampleBlocks.length}`)
    check('example.version ⊆ {newest,oldest}', examples.exampleBlocks.every(b => b.version === 'newest' || b.version === 'oldest'))
    check('some oldest (-compatibility) examples', examples.exampleBlocks.some(b => b.version === 'oldest'))
    check('most non-doc example blocks have a connector', examples.exampleBlocks.filter(b => b.is_doc === 0 && b.connector).length > examples.exampleBlocks.filter(b => b.is_doc === 0).length * 0.8)

    console.log(`\n${failures === 0 ? 'OK — all invariants hold' : `FAILED — ${failures} invariant(s) broken`}`)
    process.exit(failures === 0 ? 0 : 1)
}

await main()
