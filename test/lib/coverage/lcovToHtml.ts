#!/usr/bin/env bun
// Render an lcov.info file as a browsable HTML coverage report.
// Used by the bun branch of `tests --coverage --coverage-format=html`
// because bun has no built-in HTML coverage reporter (only text and
// lcov).
//
// Pipeline:
//   1. `lcov-parse`             reads bun's lcov.info → typed LcovFile[]
//   2. `istanbul-lib-coverage`  builds the istanbul coverage map
//   3. `istanbul-lib-report`    sets up the report context
//   4. `istanbul-reports`       renders the HTML tree
//
// The three istanbul libs are pulled in transitively via
// `@vitest/coverage-v8` (same foundational stack vitest, nyc and c8
// use), so the only direct devDep this tool adds is `lcov-parse`.
//
// The file lives under test/ rather than scripts/ so the TypeScript
// compiler can validate its assumptions about LCOV and istanbul
// shapes via `bun run validate:tests`.
//
// CLI:
//   bun test/lib/coverage/lcovToHtml.ts <lcov.info> <outDir>

import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import parseLcov from 'lcov-parse'
import { createCoverageMap } from 'istanbul-lib-coverage'
import type {
    BranchMapping,
    FileCoverageData,
    Range as IstanbulRange,
} from 'istanbul-lib-coverage'
import { createContext } from 'istanbul-lib-report'
import { create as createReport } from 'istanbul-reports'

const lcovPath = process.argv[2]
const outDir = process.argv[3]
if (!lcovPath || !outDir) {
    console.error('Usage: lcovToHtml <lcov.info> <outDir>')
    process.exit(2)
}
if (!existsSync(lcovPath)) {
    console.error(`lcovToHtml: ${lcovPath} not found.`)
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
    console.error(`lcovToHtml: ${lcovPath} contains no records — emitting an empty report at ${outDir}/index.html.`)
}

const map = createCoverageMap({})
const cwd = process.cwd()

function pointRange(line: number): IstanbulRange {
    return { start: { line, column: 0 }, end: { line, column: 0 } }
}

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

    // Statements: one istanbul statement per LCOV DA line, anchored
    // at (line, column 0). LCOV has no column info, so istanbul's
    // HTML report ends up highlighting whole lines — same fidelity
    // as bun's own data.
    for (const [i, da] of rec.lines.details.entries()) {
        const id = String(i)
        file.statementMap[id] = pointRange(da.line)
        file.s[id] = da.hit
    }

    // Functions: one istanbul function per LCOV FN/FNDA pair. LCOV
    // gives us name + hit count + the declaration line, no end
    // location — istanbul only needs the declaration line for the
    // per-file detail page (function navigation), so we point decl
    // and loc at the same single-line range.
    for (const [i, fn] of rec.functions.details.entries()) {
        const id = String(i)
        const range = pointRange(fn.line)
        file.fnMap[id] = {
            name: fn.name,
            decl: range,
            loc: range,
            line: fn.line,
        }
        file.f[id] = fn.hit
    }

    // Branches: LCOV's BRDA encodes (line, block, branch, taken).
    // `block` groups outcomes that belong to the same logical
    // branching point — both arms of an if-then-else share a block
    // index, as do the cases of a switch. Istanbul models a branch
    // as a SINGLE entry with N outcomes: locations.length === N and
    // b[id] = [count0, count1, …]. Grouping BRDA lines by
    // (line, block) reconstructs that shape and preserves istanbul's
    // branch-coverage semantics — a branch is fully covered only
    // when every outcome fired at least once, which the prior
    // one-BRDA-per-istanbul-branch encoding always overstated.
    const branchGroups = new Map<string, LcovBranch[]>()
    for (const br of rec.branches.details) {
        const key = `${br.line}:${br.block}`
        const existing = branchGroups.get(key)
        if (existing) {
            existing.push(br)
        } else {
            branchGroups.set(key, [br])
        }
    }
    let branchId = 0
    for (const group of branchGroups.values()) {
        const head = group[0]
        if (!head) continue
        const id = String(branchId++)
        const range = pointRange(head.line)
        const mapping: BranchMapping = {
            loc: range,
            // LCOV doesn't tag the branch type (if / cond-expr /
            // switch / binary-expr / …), so we use a generic label.
            // Istanbul's HTML report displays the label but doesn't
            // rely on it for coverage math.
            type: 'branch',
            locations: group.map(() => range),
            line: head.line,
        }
        file.branchMap[id] = mapping
        file.b[id] = group.map(br => br.taken)
    }

    map.addFileCoverage(file)
}

const context = createContext({ dir: outDir, coverageMap: map })
createReport('html').execute(context)
console.log(`HTML coverage report written to ${outDir}/index.html`)
