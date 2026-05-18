#!/usr/bin/env bun
// Render coverage/lcov.info as a browsable HTML report under
// coverage/. Used by the bun branch of `tests --coverage` because bun
// has no built-in HTML reporter (only text/lcov).
//
// The glue is small because every step delegates to a real package:
//
//   1. `lcov-parse`             parses bun's lcov.info → JSON
//   2. `istanbul-lib-coverage`  builds the istanbul coverage map
//   3. `istanbul-lib-report`    sets up the report context
//   4. `istanbul-reports`       renders the HTML
//
// The three `istanbul-*` libs ship transitively via
// `@vitest/coverage-v8` (the same foundational ecosystem that vitest,
// nyc and c8 all build on), so the only direct devDep this script
// adds is `lcov-parse`.
//
// Run under bun so the bun path stays bun-only (no node spawning):
//   bun scripts/lcov-to-html.mjs <lcov.info> <outDir>

import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import parseLcov from 'lcov-parse'
import libCoverage from 'istanbul-lib-coverage'
import libReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'

const lcovPath = process.argv[2]
const outDir = process.argv[3]
if (!lcovPath || !outDir) {
    console.error('Usage: lcov-to-html.mjs <lcov.info> <outDir>')
    process.exit(2)
}
if (!existsSync(lcovPath)) {
    console.error(`lcov-to-html: ${lcovPath} not found.`)
    process.exit(1)
}

const records = await new Promise((res, rej) => {
    parseLcov(lcovPath, (err, data) => err ? rej(err) : res(data))
})

// LCOV stores line-level coverage; we collapse each `DA:` line to a
// single "statement" at column 0 — enough for istanbul's HTML
// reporter to render meaningful percentages and a line hit map.
// Promote relative SF: paths to absolute so istanbul can locate the
// sources on disk for its per-file detail pages.
const map = libCoverage.createCoverageMap({})
const cwd = process.cwd()

for (const rec of records) {
    const absPath = isAbsolute(rec.file) ? rec.file : resolve(cwd, rec.file)
    const file = {
        path: absPath,
        statementMap: {},
        fnMap: {},
        branchMap: {},
        s: {},
        f: {},
        b: {},
    }
    for (const [i, da] of (rec.lines?.details ?? []).entries()) {
        const id = String(i)
        file.statementMap[id] = {
            start: { line: da.line, column: 0 },
            end:   { line: da.line, column: 0 },
        }
        file.s[id] = da.hit
    }
    for (const [i, fn] of (rec.functions?.details ?? []).entries()) {
        const id = String(i)
        file.fnMap[id] = {
            name: fn.name,
            decl: { start: { line: fn.line, column: 0 }, end: { line: fn.line, column: 0 } },
            loc:  { start: { line: fn.line, column: 0 }, end: { line: fn.line, column: 0 } },
        }
        file.f[id] = fn.hit
    }
    for (const [i, br] of (rec.branches?.details ?? []).entries()) {
        const id = String(i)
        file.branchMap[id] = {
            loc:  { start: { line: br.line, column: 0 }, end: { line: br.line, column: 0 } },
            type: 'branch',
            locations: [{ start: { line: br.line, column: 0 }, end: { line: br.line, column: 0 } }],
            line: br.line,
        }
        file.b[id] = [br.taken ?? 0]
    }
    map.addFileCoverage(file)
}

const context = libReport.createContext({ dir: outDir, coverageMap: map })
reports.create('html').execute(context)
console.log(`HTML coverage report written to ${outDir}/index.html`)
