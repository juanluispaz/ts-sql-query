#!/usr/bin/env bun
// Standalone unit checks for the code SEARCHER — kept OUT of the test/ matrix on purpose (it is
// not a *.test.ts, so the runner never collects it; run it via `tests:where-is:check`). It guards
// the pure, intricate, frequently-churned logic — the `--coord` matrix matching and the
// door/section/level/preset arg model — with no index and no DB, so it is fast and deterministic.
//
// Mirrors the indexer's verify.ts: a `check()` helper, a failure count, a non-zero exit on failure.

import {
    coordMatch, coordMatchAny, coordDbMatchAny, coordDbMatches,
    DEFAULT_SECTIONS, DEFAULT_FILTERS,
} from './render.js'
import { parseArgs, buildOptions } from './search.js'

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
const override = buildOptions(parseArgs(['--search', 'x', '--for', 'coverage-gap', '--chain', 'none']))
check('explicit flag overrides the preset',      override.sections.chain === 'none')
check('unknown --for intent → error',            parseArgs(['--search', 'x', '--for', 'nope']).error !== null)

// coords + filters + removed flags
check('--coord is repeatable (accumulates)',     eq(parseArgs(['--search', 'x', '--coord', 'a', '--coord', 'b']).filterOverrides.coord, ['a', 'b']))
check('--test-name-pattern parses a regex',      parseArgs(['--search', 'x', '--test-name-pattern', 'insens']).filterOverrides.testNamePattern instanceof RegExp)
check('--search-mode was removed → error',       parseArgs(['--search', 'x', '--search-mode', 'name']).error !== null)
check('unexpected argument → error',             parseArgs(['--search', 'x', '--bogus']).error !== null)
check('--index sets the index path, not --db',   parseArgs(['--search', 'x', '--index', '/tmp/i.sqlite']).index === '/tmp/i.sqlite')

console.log(`\n${failures === 0 ? 'OK — all searcher checks pass' : `FAILED — ${failures} check(s) broken`}`)
process.exit(failures === 0 ? 0 : 1)
