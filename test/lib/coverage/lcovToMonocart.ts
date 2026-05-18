#!/usr/bin/env bun
// Render an lcov.info file as monocart-coverage-reports' html-spa.
// Used by the bun branch of `tests --coverage --coverage-format=monocart`.
//
// Why html-spa and not the v8 SPA: MCR's `v8` report (the same
// one vitest-monocart-coverage produces under vitest) is byte-
// range based — it needs raw V8 coverage data with offsets into
// the JS that V8 actually executed, plus a sourcemap back to the
// original TS so the SPA can highlight tokens correctly. Bun's
// coverage facility today emits only LCOV with per-line hit
// counts — there is no byte-range and no sourcemap. Fabricating
// V8 ranges from those line hits doesn't recover the missing
// information; it just confuses MCR's range-merger (which
// expects nested function/block ranges) and yields either
// inflated or zeroed percentages depending on which shape we
// pick.
//
// The honest mapping under bun is the istanbul one: each LCOV DA
// line becomes a single-line statement, MCR ingests the istanbul
// coverage map and renders `html-spa`. The percentages match
// what LCOV reports natively. The visualization is structurally
// different from the vitest path (per-file *.ts.html drill-down
// pages alongside the SPA bundle.js, instead of a single
// coverage-data.js feeding the v8 SPA), but the data quality
// underneath is the limiting factor — there is nothing richer to
// show than what bun gave us.
//
// Bun-vs-MCR compatibility: monocart-coverage-reports calls
// `v8.setFlagsFromString('--expose_gc')` at import time, which
// bun has not implemented. We shim `globalThis.gc` to a no-op
// BEFORE importing MCR. A dynamic import keeps the shim in scope
// before MCR loads (a static `import` would be hoisted past it).
//
// CLI:
//   bun test/lib/coverage/lcovToMonocart.ts <lcov.info> <outDir>

import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import parseLcov from 'lcov-parse'
import { createCoverageMap } from 'istanbul-lib-coverage'
import type {
    BranchMapping,
    CoverageMapData,
    FileCoverageData,
    Range as IstanbulRange,
} from 'istanbul-lib-coverage'

const lcovPath = process.argv[2]
const outDir = process.argv[3]
if (!lcovPath || !outDir) {
    console.error('Usage: lcovToMonocart <lcov.info> <outDir>')
    process.exit(2)
}
if (!existsSync(lcovPath)) {
    console.error(`lcovToMonocart: ${lcovPath} not found.`)
    process.exit(1)
}

type LcovFile = NonNullable<Parameters<Parameters<typeof parseLcov>[1]>[1]>[number]
type LcovBranch = LcovFile['branches']['details'][number]

const records = await new Promise<LcovFile[]>((res, rej) => {
    parseLcov(lcovPath, (err, data) => {
        if (err) {
            rej(new Error(err))
            return
        }
        if (!data) {
            rej(new Error('lcov-parse returned no data'))
            return
        }
        res(data)
    })
})

if (records.length === 0) {
    console.error(`lcovToMonocart: ${lcovPath} contains no records — emitting an empty report at ${outDir}/index.html.`)
}

const map = createCoverageMap({})
const cwd = process.cwd()

function pointRange(line: number): IstanbulRange {
    return { start: { line, column: 0 }, end: { line, column: 0 } }
}

// Same lcov→istanbul conversion as test/lib/coverage/lcovToHtml.ts.
// Kept in-file rather than extracted to a shared helper because the
// two scripts diverge after this point (istanbul-reports vs MCR) and
// the conversion is short enough that one indirection level isn't
// worth the import-path overhead.
for (const rec of records) {
    const absPath = isAbsolute(rec.file) ? rec.file : resolve(cwd, rec.file)
    const file: FileCoverageData = {
        path: absPath,
        statementMap: {},
        fnMap: {},
        branchMap: {},
        s: {},
        f: {},
        b: {},
    }

    for (const [i, da] of rec.lines.details.entries()) {
        const id = String(i)
        file.statementMap[id] = pointRange(da.line)
        file.s[id] = da.hit
    }

    for (const [i, fn] of rec.functions.details.entries()) {
        const id = String(i)
        const range = pointRange(fn.line)
        file.fnMap[id] = { name: fn.name, decl: range, loc: range, line: fn.line }
        file.f[id] = fn.hit
    }

    const branchGroups = new Map<string, LcovBranch[]>()
    for (const br of rec.branches.details) {
        const key = `${br.line}:${br.block}`
        const existing = branchGroups.get(key)
        if (existing) existing.push(br)
        else branchGroups.set(key, [br])
    }
    let branchId = 0
    for (const group of branchGroups.values()) {
        const head = group[0]
        if (!head) continue
        const id = String(branchId++)
        const range = pointRange(head.line)
        const mapping: BranchMapping = {
            loc: range,
            type: 'branch',
            locations: group.map(() => range),
            line: head.line,
        }
        file.branchMap[id] = mapping
        file.b[id] = group.map(br => br.taken)
    }

    map.addFileCoverage(file)
}

// Shim global.gc BEFORE the dynamic import — MCR's lib/utils/gc.js
// skips `v8.setFlagsFromString('--expose_gc')` when `global.gc` is
// already a function. Without this, importing MCR under bun panics.
if (typeof (globalThis as { gc?: () => void }).gc !== 'function') {
    ;(globalThis as { gc?: () => void }).gc = () => {}
}

// Dynamic import so MCR doesn't load before the shim runs.
const mcrModule = await import('monocart-coverage-reports')
const { CoverageReport } = mcrModule

const mcr = new CoverageReport({
    name: 'ts-sql-query coverage (bun)',
    outputDir: outDir,
    // html-spa is MCR's istanbul-compatible SPA. We don't ask
    // for `v8` here because it requires V8 raw data — see the
    // file-level comment above. console-summary mirrors the
    // terminal table the vitest path prints. lcov:true keeps an
    // updated lcov.info next to the SPA for CI consumers.
    reports: ['html-spa', 'console-summary'],
    lcov: true,
    // Don't wipe outputDir — bun has already written its own
    // lcov.info there, and other --coverage-format steps may
    // have written next to it. Idempotent sharing of the
    // directory is the design.
    clean: false,
})

const mapData: CoverageMapData = map.data
await mcr.add(mapData)
await mcr.generate()
console.log(`Monocart coverage report written to ${outDir}/index.html`)
