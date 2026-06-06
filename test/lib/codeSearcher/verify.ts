#!/usr/bin/env bun
// Standalone unit checks for the code SEARCHER — kept OUT of the test/ matrix on purpose (it is
// not a *.test.ts, so the runner never collects it; run it via `tests:where-is:check`). Two phases:
//   1. PURE logic (no index, no DB): the `--coord` matrix matching and the door/section/level/preset
//      arg model — fast, deterministic, always runs.
//   2. OUTPUT REGRESSION (against the built index): a small golden set asserting that the query +
//      render layers still produce the expected reports, so a broken query/render is caught. It is
//      SKIPPED (not failed) when the index isn't built. Volatile inputs (line numbers) are DERIVED
//      from the index, never hard-coded, so unrelated edits don't spuriously break it.
//
// Mirrors the indexer's verify.ts: a `check()` helper, a failure count, a non-zero exit on failure.

import { existsSync } from 'node:fs'
import {
    coordMatch, coordMatchAny, coordDbMatchAny, coordDbMatches, cellFromPath,
    DEFAULT_SECTIONS, DEFAULT_FILTERS, render,
} from './render.js'
import { parseArgs, buildOptions } from './search.js'
import { openIndexDbReadonly } from '../codeIndexer/db.js'
import { readMeta } from './meta.js'
import * as Q from './queries.js'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : ` — ${detail}`}`)
    if (!ok) failures++
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

// A representative matrix cell + a cell carrying a test-file path (for the 4th coord level).
const cell = { db: 'postgres', version: 'newest', connector: 'pg' }
const cellFile = { ...cell, file: 'test/db/postgres/newest/pg/select.basic.test.ts' }

console.log('code-searcher verify (pure logic — no index)\n')

console.log('── --coord matching (segments, glob, brace, file basename, general) ──')
check('db-only coord matches the db',            coordMatch(cell, 'postgres'))
check('db-only coord rejects another db',        !coordMatch(cell, 'mysql'))
check('cell coord matches db/version',           coordMatch(cell, 'postgres/newest'))
check('cell coord rejects wrong version',        !coordMatch(cell, 'postgres/oldest'))
check('glob * matches any connector',            coordMatch(cell, 'postgres/*/pg'))
check('brace {a,b} matches a member',            coordMatch(cell, 'postgres/*/{pg,postgres}'))
check('brace {a,b} rejects a non-member',        !coordMatch(cell, 'postgres/*/{mysql2,pglite}'))
check('connector is exact, not substring',       !coordMatch({ ...cell, connector: 'pg' }, 'postgres/newest/pglite'))
check('4th level matches the file basename',     coordMatch(cellFile, 'postgres/newest/pg/select.basic.test.ts'))
check('4th level glob matches by basename',      coordMatch(cellFile, 'postgres/newest/pg/select.*'))
check('4th level glob rejects a different file', !coordMatch(cellFile, 'postgres/newest/pg/select.order-by*'))
check('a cell with no file fails a file coord',  !coordMatch(cell, 'postgres/newest/pg/select.basic.test.ts'))
check('empty patterns match everything',         coordMatchAny(cell, []))
check('coordMatchAny is a union (OR)',           coordMatchAny(cell, ['mysql', 'postgres']))
check('coordMatchAny rejects when none match',   !coordMatchAny(cell, ['mysql', 'oracle']))

console.log('\n── --coord db-segment matching (db-only dimensions; general is db-agnostic) ──')
check('general always matches a db focus',       coordDbMatchAny('general', ['postgres']))
check('db-only matches its db',                  coordDbMatchAny('postgres', ['postgres']))
check('db-only drops other dbs',                 !coordDbMatchAny('mysql', ['postgres']))
check('no coords → everything matches',          coordDbMatchAny('mysql', []))
check('coordDbMatches reads the db segment',     coordDbMatches('postgres', 'postgres/newest/pg'))
check('coordDbMatches rejects a wrong db',        !coordDbMatches('mysql', 'postgres/newest'))

console.log('\n── the door/section/level/preset arg model (parseArgs + buildOptions) ──')
// defaults: an un-flagged search reproduces the classic report
const base = buildOptions(parseArgs(['--search', 'orderBy']))
check('no overrides → DEFAULT_SECTIONS',         eq(base.sections, DEFAULT_SECTIONS))
check('no overrides → DEFAULT_FILTERS',          eq(base.filters, DEFAULT_FILTERS))
check('--search sets the exact door',            parseArgs(['--search', 'orderBy']).exact === 'orderBy')

// section levels
check('--tests detail is accepted',              parseArgs(['--search', 'x', '--tests', 'detail']).sectionOverrides.tests === 'detail')
check('--limitation full is accepted',           parseArgs(['--search', 'x', '--limitation', 'full']).sectionOverrides.limitation === 'full')
check('--signature public-interface accepted',   parseArgs(['--search', 'x', '--signature', 'public-interface']).sectionOverrides.signature === 'public-interface')
check('invalid --chain level → error',           parseArgs(['--search', 'x', '--chain', 'bogus']).error !== null)
check('invalid --tests level → error',           parseArgs(['--search', 'x', '--tests', 'partial']).error !== null)

// presets
const cov = buildOptions(parseArgs(['--search', 'x', '--for', 'coverage-gap']))
check('preset coverage-gap sets chain full',     cov.sections.chain === 'full')
check('preset coverage-gap sets tests gaps',     cov.sections.tests === 'gaps')
const emi = buildOptions(parseArgs(['--search', 'x', '--for', 'emission-bug']))
check('preset emission-bug sets chain none',     emi.sections.chain === 'none')
check('preset emission-bug raises emitted-sql',  emi.sections.emittedSql === 'full')
// `bare` turns every section off; an explicit flag still turns one back on (no `--none` spam needed)
const bare = buildOptions(parseArgs(['--search', 'x', '--for', 'bare']))
check('preset bare turns every section off', Object.values(bare.sections).every(v => v === 'none'))
const bareSurface = buildOptions(parseArgs(['--search', 'x', '--for', 'bare', '--surface', 'own']))
check('bare + explicit flag shows only that', bareSurface.sections.surface === 'own' && bareSurface.sections.classification === 'none' && bareSurface.sections.chain === 'none')
check('bare keeps cell-caveats off even with --coord', buildOptions(parseArgs(['--search', 'x', '--for', 'bare', '--coord', 'postgres'])).sections.cellCaveats === 'none')
const tyb = buildOptions(parseArgs(['--search', 'x', '--for', 'type-bug']))
check('preset type-bug sets declared full',      tyb.sections.declared === 'full')
check('preset type-bug sets signature full',     tyb.sections.signature === 'full')
check('preset type-bug raises ref-type-arg full', tyb.sections.refTypeArg === 'full')
check('preset type-bug raises neg-types full',   tyb.sections.negTypes === 'full')
check('preset type-bug drops chain',             tyb.sections.chain === 'none')
check('preset type-bug leaves emitted-sql off',  tyb.sections.emittedSql === 'none')
const override = buildOptions(parseArgs(['--search', 'x', '--for', 'coverage-gap', '--chain', 'none']))
check('explicit flag overrides the preset',      override.sections.chain === 'none')
check('explicit flag overrides type-bug',        buildOptions(parseArgs(['--search', 'x', '--for', 'type-bug', '--ref-type-arg', 'none'])).sections.refTypeArg === 'none')
check('unknown --for intent → error',            parseArgs(['--search', 'x', '--for', 'nope']).error !== null)

// caveat surfacing — P1a (name-scoped in feature-centric presets) + the coord-scoped --cell-caveats
check('coverage-gap cell-caveats=summary (no coord)', cov.sections.cellCaveats === 'summary')
// preset cell-caveats is coord-aware: summary (map) browsing → full (markers) once scoped; explicit wins.
check('preset cell-caveats → full with --coord',  buildOptions(parseArgs(['--search', 'x', '--for', 'coverage-gap', '--coord', 'postgres'])).sections.cellCaveats === 'full')
check('explicit --cell-caveats overrides the bump', buildOptions(parseArgs(['--search', 'x', '--for', 'coverage-gap', '--coord', 'postgres', '--cell-caveats', 'summary'])).sections.cellCaveats === 'summary')
check('version-work adds bugs+limitation',       buildOptions(parseArgs(['--search', 'x', '--for', 'version-work'])).sections.bugs === 'summary' && buildOptions(parseArgs(['--search', 'x', '--for', 'version-work'])).sections.limitation === 'summary')
const prop = buildOptions(parseArgs(['--search', 'x', '--for', 'propagation']))
check('propagation preset exists + composes',    prop.sections.tests === 'gaps' && prop.sections.cellCaveats === 'summary' && prop.sections.chain === 'none')
check('--cell-caveats full is accepted',         parseArgs(['--search', 'x', '--cell-caveats', 'full']).sectionOverrides.cellCaveats === 'full')
// --cell-caveats is coord-scoped but NEVER errors on a missing --coord — it renders an explanatory
// note instead (one consistent behaviour, explicit or preset), so the reader is never surprised.
check('--cell-caveats w/o --coord does not error',  parseArgs(['--search', 'x', '--cell-caveats', 'full']).error === null)
check('cellFromPath parses a cell',              eq(cellFromPath('test/db/mariadb/newest/mariadb/update.returning.test.ts'), { db: 'mariadb', version: 'newest', connector: 'mariadb', file: 'update.returning.test.ts' }))
check('cellFromPath rejects a non-cell path',    cellFromPath('test/lib/codeSearcher/render.ts') === null)

// coords + filters + removed flags
check('--coord is repeatable (accumulates)',     eq(parseArgs(['--search', 'x', '--coord', 'a', '--coord', 'b']).filterOverrides.coord, ['a', 'b']))
check('--test-name-pattern parses a regex',      parseArgs(['--search', 'x', '--test-name-pattern', 'insens']).filterOverrides.testNamePattern instanceof RegExp)
check('--search-mode was removed → error',       parseArgs(['--search', 'x', '--search-mode', 'name']).error !== null)
check('unexpected argument → error',             parseArgs(['--search', 'x', '--bogus']).error !== null)
check('--index sets the index path, not --db',   parseArgs(['--search', 'x', '--index', '/tmp/i.sqlite']).index === '/tmp/i.sqlite')

console.log('\n── the --ref-* family (references by role) + --refs shortcut + --location-target produces ──')
// the rename: --producers/--implemented-by → --ref-return/--ref-implements
check('--ref-return full is accepted',           parseArgs(['--search', 'x', '--ref-return', 'full']).sectionOverrides.refReturn === 'full')
check('--ref-implements summary is accepted',    parseArgs(['--search', 'x', '--ref-implements', 'summary']).sectionOverrides.refImplements === 'summary')
check('--ref-type-arg full is accepted',         parseArgs(['--search', 'x', '--ref-type-arg', 'full']).sectionOverrides.refTypeArg === 'full')
check('--ref-param full is accepted',            parseArgs(['--search', 'x', '--ref-param', 'full']).sectionOverrides.refParam === 'full')
check('--ref-field full is accepted',            parseArgs(['--search', 'x', '--ref-field', 'full']).sectionOverrides.refField === 'full')
check('--ref-new full is accepted',              parseArgs(['--search', 'x', '--ref-new', 'full']).sectionOverrides.refNew === 'full')
check('--ref-property summary is accepted',      parseArgs(['--search', 'x', '--ref-property', 'summary']).sectionOverrides.refProperty === 'summary')
check('--ref-brand full is accepted',            parseArgs(['--search', 'x', '--ref-brand', 'full']).sectionOverrides.refBrand === 'full')
check('--surface all is accepted',               parseArgs(['--search', 'x', '--surface', 'all']).sectionOverrides.surface === 'all')
check('--surface own is accepted',               parseArgs(['--search', 'x', '--surface', 'own']).sectionOverrides.surface === 'own')
check('--surface summary → error (old level)',   parseArgs(['--search', 'x', '--surface', 'summary']).error !== null)
check('old --producers flag → error',            parseArgs(['--search', 'x', '--producers', 'full']).error !== null)
check('old --implemented-by flag → error',       parseArgs(['--search', 'x', '--implemented-by', 'full']).error !== null)
check('preset coverage-gap sets ref-return',     buildOptions(parseArgs(['--search', 'x', '--for', 'coverage-gap'])).sections.refReturn === 'summary')
check('preset emission-bug sets ref-implements', buildOptions(parseArgs(['--search', 'x', '--for', 'emission-bug'])).sections.refImplements === 'full')
// --refs shortcut: sets the whole family; explicit per-role flag still wins; bad level errors
check('--refs full sets the whole ref family',   (() => { const s = buildOptions(parseArgs(['--search', 'x', '--refs', 'full'])).sections; return s.refReturn === 'full' && s.refImplements === 'full' && s.refTypeArg === 'full' && s.refParam === 'full' && s.refField === 'full' && s.refNew === 'full' && s.refProperty === 'full' && s.refBrand === 'full' })())
check('explicit --ref-return overrides --refs',  buildOptions(parseArgs(['--search', 'x', '--refs', 'full', '--ref-return', 'none'])).sections.refReturn === 'none')
check('--refs beats a preset, is beaten by flag', buildOptions(parseArgs(['--search', 'x', '--for', 'emission-bug', '--refs', 'none'])).sections.refImplements === 'none')
check('invalid --refs level → error',            parseArgs(['--search', 'x', '--refs', 'bogus']).error !== null)
// --location-target gains `produces` (forward: the type the enclosing fn returns)
check('--location-target produces parses',       parseArgs(['--search-location', 'src/x.ts:1', '--location-target', 'produces']).locationTarget === 'produces')
check('--location-target enclosing-all parses',  parseArgs(['--search-location', 'src/x.ts:1', '--location-target', 'enclosing-all']).locationTarget === 'enclosing-all')
check('--location-target enclosing still default', parseArgs(['--search-location', 'src/x.ts:1']).locationTarget === 'enclosing')
// --location-target gains `types` / `types-all` (forward: the indexed types referenced on the line /
// across the whole function) — terminal navigation reports, the dual of --ref-type-arg
check('--location-target types parses',          parseArgs(['--search-location', 'src/x.ts:1', '--location-target', 'types']).locationTarget === 'types')
check('--location-target types-all parses',      parseArgs(['--search-location', 'src/x.ts:1', '--location-target', 'types-all']).locationTarget === 'types-all')
// --location-target gains `brand` (forward: the marker symbol a `[sym]: T` line keys on) — dual of --ref-brand
check('--location-target brand parses',          parseArgs(['--search-location', 'src/x.ts:1', '--location-target', 'brand']).locationTarget === 'brand')
check('invalid --location-target → error',       parseArgs(['--search-location', 'src/x.ts:1', '--location-target', 'bogus']).error !== null)

// ── 2. output regression against the built index (skipped if it isn't there) ──
const INDEX = 'test/lib/codeIndexer/generated/code-index.sqlite'
if (!existsSync(INDEX)) {
    console.log('\n── output regression: SKIPPED (no index — run `tests:index` to enable) ──')
} else {
    console.log('\n── output regression (built index; rebuild with `tests:index` if these lag the tree) ──')
    const db = await openIndexDbReadonly(INDEX)
    const meta = readMeta(db)
    // render a NAME search the way the CLI does (door → opts → render); returns the markdown report.
    const report = (flags: string[]): string => { const a = parseArgs(flags); return render(db, a.exact!, buildOptions(a), meta) }
    // derive volatile line numbers from the index so unrelated edits don't break the asserts
    const vcff = Q.members(db, 'virtualColumnFromFragment').find(m => m.owner === 'TableOf' && m.path === 'src/Table.ts')
    const hsSrc = Q.members(db, '[source]').find(m => m.owner === 'HasSource')
    try {
        // query layer — precise regression of the dimensions added this session
        check('brand reverse: `source` brands HasSource',
            Q.referencesByRole(db, 'source', 'brand').some(r => r.enclosing_owner === 'HasSource'))
        check('brand forward: the HasSource[source] line keys on `source`',
            !!hsSrc && Q.brandKeysAt(db, hsSrc.path, hsSrc.start_line).some(b => b.ref_name === 'source'), hsSrc ? '' : 'no [source] member')
        check('types forward: a vcff overload names the alias + carries a def span',
            !!vcff && Q.typesReferencedAt(db, vcff.path, vcff.start_line).some(r => r.ref_name === 'NSourceAllowingNoTableOrViewRequired' && r.def_end !== null), vcff ? '' : 'no vcff member')
        check('surface own: HasSource declares `[source]`',
            Q.surfaceOf(db, 'HasSource', 'own').some(m => m.name === '[source]'))
        check('surface full: AbstractSelect shows own + inherited members',
            (() => { const s = Q.surfaceOf(db, 'AbstractSelect', 'full'); return s.some(m => m.is_own === 1) && s.some(m => m.is_own === 0) })())
        check('surface rows carry a span (end_line)',
            Q.surfaceOf(db, 'HasSource', 'own').every(m => typeof m.end_line === 'number'))
        check('chain: __addOrderBy is reached by the public orderBy',
            Q.callChain(db, '__addOrderBy', false, meta.resolved).hops.some(h => h.caller === 'orderBy'))
        // render layer — section composition, the span standard, the bare preset, not-found
        check('render: orderBy classifies as public-surface',
            /public-surface/.test(report(['--search', 'orderBy', '--classification', 'summary'])))
        check('render: surface lines render a span',
            /spans lines/.test(report(['--search', 'SelectExpression', '--for', 'bare', '--surface', 'own'])))
        check('render: `--for bare --surface own` shows ONLY the surface',
            (() => { const r = report(['--search', 'SelectExpression', '--for', 'bare', '--surface', 'own']); return /## (Surface|Sibling API)/.test(r) && !/## Classification/.test(r) })())
        check('render: a missing symbol reads "not found"',
            /not found/i.test(report(['--search', 'ZzNotARealSymbol_xyz', '--classification', 'summary'])))
    } finally {
        db.close()
    }
}

console.log(`\n${failures === 0 ? 'OK — all searcher checks pass' : `FAILED — ${failures} check(s) broken`}`)
process.exit(failures === 0 ? 0 : 1)
