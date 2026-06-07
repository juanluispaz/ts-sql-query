#!/usr/bin/env bun
// Orchestrator + CLI entry for `bun run tests:audit`. Runs the structural
// symmetry check, then the anti-cheat content rules over every cell, applies
// the `tests-audit-disable-*` suppressions, reports, and exits 1 on any error.
// See AUDIT.md.

import { readFileSync } from 'node:fs'
import ts from 'typescript'

import { runSymmetryCheck } from './symmetry.js'
import { cellTestFiles, typesNegativeTestFiles } from './walk.js'
import { scanIgnores, applyIgnores } from './ignores.js'
import { checkMirrorImage } from './checks/mirrorImage.js'
import { checkUuidLiterals } from './checks/uuidLiteral.js'
import { checkAsAny, checkAnyType } from './checks/asAny.js'
import { checkNonPublicApi } from './checks/nonPublicApi.js'
import { checkCommentedTests } from './checks/commentedTest.js'
import { checkFocusedTests } from './checks/focusedTest.js'
import { checkEmptySnapshots } from './checks/emptySnapshot.js'
import { checkSuppressions } from './checks/suppressions.js'
import { checkRegistrationSkip } from './checks/registrationSkip.js'
import { checkTautologies } from './checks/tautology.js'
import { checkNoValidation } from './checks/noValidation.js'
import { checkWeakMatcher } from './checks/weakMatcher.js'
import { checkCloseTo } from './checks/closeTo.js'
import { checkNoOpExpect } from './checks/noOpExpect.js'
import { checkNonDeterministicInput } from './checks/nonDeterministicInput.js'
import { reportFindings } from './report.js'
import { coordMatch, coordMatchAny, cellFromPath } from '../coords.js'
import type { Finding } from './types.js'

interface Args {
    explain: boolean
    strict: boolean
    all: boolean
    only: string | null
    coords: string[]
}

function parseArgs(argv: string[]): Args {
    const a: Args = { explain: false, strict: false, all: false, only: null, coords: [] }
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i]!
        if (t === '--explain') a.explain = true
        else if (t === '--strict') a.strict = true
        else if (t === '--all') a.all = true
        else if (t === '--only') a.only = argv[++i] ?? null
        else if (t.startsWith('--only=')) a.only = t.slice('--only='.length)
        else if (!t.startsWith('-')) a.coords.push(t)
    }
    return a
}

// Scope the cell files (and the databases for the symmetry check) to the
// positional coords, mirroring the `tests` CLI. Unmatched coords are an error.
function scopeByCoords(allFiles: string[], coords: string[]): { files: string[], dbs: Set<string>, unmatched: string[] } {
    const cells = allFiles.map(f => ({ f, cell: cellFromPath(f) }))
    const files: string[] = []
    const dbs = new Set<string>()
    for (const { f, cell } of cells) {
        if (cell && coordMatchAny(cell, coords)) { files.push(f); dbs.add(cell.db) }
    }
    const unmatched = coords.filter(c => !cells.some(({ cell }) => cell !== null && coordMatch(cell, c)))
    return { files, dbs, unmatched }
}

// Run a file through a raw-finding producer, then apply the `--only` filter and
// the `tests-audit-disable-*` suppressions (emitting `unused-ignore` for stale
// directives). Shared by the walked-cell pass and the negative-type ts-ignore
// pass below.
function auditFile(file: string, only: string | null, produce: (sf: ts.SourceFile) => Finding[]): Finding[] {
    const content = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, /*setParentNodes*/ true)

    let raw = produce(sf)
    if (only) raw = raw.filter(f => f.rule === only)

    const { directives, meta } = scanIgnores(content, file)
    const kept = applyIgnores(raw, directives)

    for (const d of directives) {
        const ran = !only || only === d.rule
        if (ran && !d.used) {
            meta.push({
                rule: 'unused-ignore', file, line: d.line,
                message: `stale tests-audit-disable for ${d.rule}: matches no ${d.rule} finding on the target line`,
            })
        }
    }
    return [...kept, ...meta]
}

function runContentChecks(only: string | null, files: string[], tsIgnoreOnlyFiles: string[]): Finding[] {
    const findings: Finding[] = []

    // checkMirrorImage emits `mock-only` / `mirror-image` / `one-sided-guard`;
    // checkUuidLiterals emits `uuid-literal`; checkAsAny emits `as-any`;
    // checkAnyType emits `any-type`; checkNonPublicApi emits `non-public-api`;
    // checkCommentedTests emits `commented-test-reason`; checkFocusedTests emits
    // `focused-test`; checkEmptySnapshots emits `empty-snapshot`;
    // checkSuppressions emits `ts-ignore` / `ts-expect-error` /
    // `eslint-disable-type` / `eslint-disable-other`; checkRegistrationSkip emits
    // `skipped-test-reason` / `skip-real-db`; checkTautologies emits `tautology`;
    // checkNoValidation emits `no-assertion-runtime` / `empty-catch` /
    // `weak-boolean`; checkWeakMatcher emits `weak-matcher`; checkCloseTo emits
    // `close-to`; checkNoOpExpect emits `no-op-expect`; checkNonDeterministicInput
    // emits `non-deterministic-input`.
    for (const file of files) {
        findings.push(...auditFile(file, only, (sf) => [
            ...checkMirrorImage(sf, file), ...checkUuidLiterals(sf, file), ...checkAsAny(sf, file),
            ...checkAnyType(sf, file), ...checkNonPublicApi(sf, file), ...checkCommentedTests(sf, file),
            ...checkFocusedTests(sf, file), ...checkEmptySnapshots(sf, file), ...checkSuppressions(sf, file),
            ...checkRegistrationSkip(sf, file), ...checkTautologies(sf, file), ...checkNoValidation(sf, file),
            ...checkWeakMatcher(sf, file), ...checkCloseTo(sf, file), ...checkNoOpExpect(sf, file),
            ...checkNonDeterministicInput(sf, file),
        ]))
    }

    // The negative-type cells run ONLY the `ts-ignore` rule (a `@ts-ignore` is
    // forbidden there too); every other rule would false-positive on tests that
    // deliberately fail to compile. See walk.ts § typesNegativeTestFiles.
    for (const file of tsIgnoreOnlyFiles) {
        findings.push(...auditFile(file, only, (sf) => checkSuppressions(sf, file, /*tsIgnoreOnly*/ true)))
    }

    return findings
}

function main(): number {
    const args = parseArgs(process.argv.slice(2))

    let files = cellTestFiles()
    let dbFilter: Set<string> | undefined
    if (args.coords.length > 0) {
        const scoped = scopeByCoords(files, args.coords)
        if (scoped.unmatched.length > 0) {
            console.error(`tests:audit: no cell files match coord(s): ${scoped.unmatched.join(', ')}`)
            return 2
        }
        files = scoped.files
        dbFilter = scoped.dbs
        console.log(`Scope: ${args.coords.join(' ')} — ${files.length} file(s) across ${dbFilter.size} database(s)`)
        console.log('')
    }

    // The negative-type cells the `ts-ignore` rule additionally scans, scoped to
    // the same databases when coords are given (their db is the path segment
    // after `test/db/`; they have no connector cell, so coordMatch doesn't apply).
    let negFiles = typesNegativeTestFiles()
    if (dbFilter) negFiles = negFiles.filter(f => dbFilter.has(f.split('/')[2] ?? ''))

    const symmetry = runSymmetryCheck(dbFilter)

    console.log('')
    console.log('Content audit (anti-cheat)')
    const findings = runContentChecks(args.only, files, negFiles)
    const { errors } = reportFindings(findings, args)

    const ok = symmetry.passed && errors === 0
    console.log('')
    console.log(ok ? 'Audit passed.' : 'Audit FAILED.')
    return ok ? 0 : 1
}

process.exit(main())
