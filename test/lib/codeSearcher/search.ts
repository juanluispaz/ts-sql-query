#!/usr/bin/env bun
// The CODE SEARCHER — the consumer half of the code index. Given a target (an exact
// name, a regex over names, or a source/test location), it prints a markdown report:
// does it exist? public or internal? how is it reached, explained, exemplified, tested?
//
// CLI model (MODEL.md): pick ONE door (WHAT to search),
// then control each report section with its own levelled flag (`none` hides it) and narrow
// the test/doc dimensions with the result filters. `--for <intent>` presets a section set.
//
// It is a SEPARATE tool from the indexer: it never writes the index, only reads it.
//
// Usage:  bun test/lib/codeSearcher/search.ts <door> [<section> <level>]… [<filter>]… [--db <path>]
//         (or via `bun run tests:where-is …`).

import { existsSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openIndexDbReadonly, type QueryDb } from '../codeIndexer/db.js'
import { readMeta } from './meta.js'
import { nameIndex, enclosingAt, calleesAt, enclosingTestBlock, testBlockApi, sqlEmitsMatching, knownDbs, knownBreakpoints, distinctCells } from './queries.js'
import {
    render, DEFAULT_SECTIONS, DEFAULT_FILTERS, coordMatch, coordDbMatches,
    type SearchOptions, type Sections, type Filters,
} from './render.js'

const DEFAULT_DB = 'test/lib/codeIndexer/generated/code-index.sqlite'
const MATCH_CAP = 40    // rows in a --search-pattern-summary list
const FULL_CAP = 25     // full reports a --search-pattern expands to before truncating

// Section flags → the Sections key they set + the level vocabulary each accepts.
const SECTION_SPECS = {
    '--classification': { key: 'classification', levels: ['none', 'summary', 'full'] },
    '--declared': { key: 'declared', levels: ['none', 'summary', 'full'] },
    '--signature': { key: 'signature', levels: ['none', 'summary', 'public-interface', 'public-impl', 'internal', 'full'] },
    '--chain': { key: 'chain', levels: ['none', 'strict', 'broad', 'full'] },
    '--producers': { key: 'producers', levels: ['none', 'summary', 'full'] },
    '--implemented-by': { key: 'implementedBy', levels: ['none', 'summary', 'full'] },
    '--version-gates': { key: 'versionGates', levels: ['none', 'summary', 'full'] },
    '--docs': { key: 'docs', levels: ['none', 'summary', 'by-page', 'full'] },
    '--simplified': { key: 'simplified', levels: ['none', 'summary', 'full'] },
    '--emitted-sql': { key: 'emittedSql', levels: ['none', 'summary', 'full'] },
    '--tests': { key: 'tests', levels: ['none', 'summary', 'detail', 'gaps'] },
    '--examples': { key: 'examples', levels: ['none', 'summary', 'full'] },
    '--neg-types': { key: 'negTypes', levels: ['none', 'summary', 'full'] },
    '--bugs': { key: 'bugs', levels: ['none', 'summary', 'full'] },
    '--limitation': { key: 'limitation', levels: ['none', 'summary', 'full'] },
    '--cell-caveats': { key: 'cellCaveats', levels: ['none', 'summary', 'full'] },
    '--name-search': { key: 'nameSearch', levels: ['none', 'full'] },
} as const satisfies Record<string, { key: keyof Sections, levels: readonly string[] }>

// Intent presets — expand to a section set; explicit flags still override.
// --bugs/--limitation are NAME-scoped (markers mentioning the symbol) — useful on the feature-centric
// intents (version-work, emission-bug, post-fix-sync), where the agent searches the named feature.
// --cell-caveats is COORD-scoped (markers in the cells the --coord touches), for coverage-gap /
// propagation, where the blocker is a caveat on the target CELL, not on the symbol (case G).
const PRESETS: Record<string, Partial<Sections>> = {
    'coverage-gap': { classification: 'full', chain: 'full', producers: 'summary', tests: 'gaps', examples: 'full', cellCaveats: 'summary' },
    'emission-bug': { chain: 'none', emittedSql: 'full', implementedBy: 'full', versionGates: 'summary', bugs: 'full', limitation: 'summary' },
    'version-work': { versionGates: 'full', tests: 'summary', chain: 'none', bugs: 'summary', limitation: 'summary' },
    'post-fix-sync': { chain: 'none', emittedSql: 'full', docs: 'full', examples: 'full', tests: 'detail', bugs: 'summary' },
    'propagation': { classification: 'summary', tests: 'gaps', examples: 'summary', cellCaveats: 'summary', chain: 'none' },
}

interface Args {
    exact: string | null
    pattern: string | null
    patternSummary: string | null
    location: string | null
    emitsKeyword: string | null
    locationTarget: 'enclosing' | 'callees'
    sectionOverrides: Partial<Sections>
    filterOverrides: Partial<Filters>
    preset: string | null
    index: string
    help: boolean
    error: string | null
}

function compileRe(pattern: string | null): RegExp | string {
    if (pattern === null) return 'missing regex'
    try { return new RegExp(pattern) } catch (e) { return `invalid regex: ${(e as Error).message}` }
}

export function parseArgs(argv: string[]): Args {
    const a: Args = {
        exact: null, pattern: null, patternSummary: null, location: null, emitsKeyword: null, locationTarget: 'enclosing',
        sectionOverrides: {}, filterOverrides: {}, preset: null, index: DEFAULT_DB, help: false, error: null,
    }
    const need = (i: number): string | null => argv[i] ?? null
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i]!
        const val = (): string | null => need(++i)
        if (t === '-h' || t === '--help') { a.help = true; continue }
        // doors
        if (t === '--search') { a.exact = val(); continue }
        if (t === '--search-pattern') { a.pattern = val(); continue }
        if (t === '--search-pattern-summary') { a.patternSummary = val(); continue }
        if (t === '--search-location') { a.location = val(); continue }
        if (t === '--emits-keyword') { a.emitsKeyword = val(); continue }
        if (t === '--location-target') {
            const v = val()
            if (v === 'enclosing' || v === 'callees') a.locationTarget = v
            else a.error = `invalid --location-target '${v ?? '(missing)'}' — use enclosing | callees.`
            continue
        }
        // sections
        const spec = (SECTION_SPECS as Record<string, { key: keyof Sections, levels: readonly string[] }>)[t]
        if (spec) {
            const v = val()
            if (v && spec.levels.includes(v)) (a.sectionOverrides as Record<string, string>)[spec.key] = v
            else a.error = `invalid level '${v ?? '(missing)'}' for ${t} — use one of: ${spec.levels.join(', ')}.`
            continue
        }
        // the single global focus filter — matrix coordinates (repeatable)
        if (t === '--coord') { const v = val(); if (v) (a.filterOverrides.coord ??= []).push(v); continue }
        if (t === '--test-name-pattern') { const r = compileRe(val()); if (typeof r === 'string') a.error = `--test-name-pattern: ${r}`; else a.filterOverrides.testNamePattern = r; continue }
        if (t === '--file-name-pattern') { const r = compileRe(val()); if (typeof r === 'string') a.error = `--file-name-pattern: ${r}`; else a.filterOverrides.fileNamePattern = r; continue }
        if (t === '--owner-kind') {
            const v = val()
            if (v === 'interface' || v === 'class' || v === 'type') a.filterOverrides.ownerKind = v
            else a.error = `invalid --owner-kind '${v ?? '(missing)'}' — use interface | class | type.`
            continue
        }
        if (t === '--owner') { a.filterOverrides.owner = val(); continue }
        if (t === '--breakpoint') { a.filterOverrides.breakpoint = val(); continue }
        // preset / infra
        if (t === '--for') {
            const v = val()
            if (v && PRESETS[v]) a.preset = v
            else a.error = `unknown --for intent '${v ?? '(missing)'}' — available: ${Object.keys(PRESETS).join(', ')}.`
            continue
        }
        if (t === '--index') { a.index = val() ?? a.index; continue }
        if (t === '--search-mode') { val(); a.error = '--search-mode was removed — use --chain <none|strict|broad|full> and --name-search <none|full> instead.'; continue }
        a.error = `unexpected argument '${t}'. See --help.`
    }
    return a
}

const HELP = `tests:where-is  <WHAT door>  [<section> <level>]…  [<filter>]…  [--for <intent>]  [--db <path>]

Pick exactly ONE door (what to search for); the report shows a default set of sections —
raise, lower or silence each with its own flag ("none" hides it) — and narrow the test/doc
dimensions with the filters. Section levels are single-valued; no comma-lists (repeat a
set-valued filter to add more). Combining sections beats many round-trips.

WHAT to search for — exactly one:
  --search <name>                  an exact symbol/member name (orderBy, __addOrderBy)
  --search-pattern <regex>         a JS regex over names → a FULL report per match
  --search-pattern-summary <regex> same regex → a compact pick-list of matches
  --search-location <path:line>    a SOURCE line → the element it resolves to (see
                                   --location-target); a TEST line → the test_block it
                                   encloses (inverse: public API exercised by that test)
  --location-target <enclosing|callees>
                                   for a source --search-location: the function ENCLOSING
                                   the line (default), or the function(s) INVOKED on it
  --emits-keyword <sql-fragment>   a SQL token ('returning old.', 'collate') → the
                                   SqlBuilder code that emits it (the build-side bridge)

SECTIONS — one level each; default in (parens); "none" hides the section:
  --classification <none|summary|full>                       (summary)
  --declared <none|summary|full>                             (summary)
  --signature <none|summary|public-interface|public-impl|internal|full>  (summary)
  --chain <none|strict|broad|full>                           (strict)  full = whole internal stack
  --producers <none|summary|full>                            (none)    what call returns a receiver
  --implemented-by <none|summary|full>                       (summary) incl. non-overriders
  --version-gates <none|summary|full>                        (none)    compatibility-version branches
  --docs <none|summary|by-page|full>                         (summary)
  --simplified <none|summary|full>                           (summary)
  --emitted-sql <none|summary|full>                          (none)    asserted SQL snapshots (tests+docs)
  --tests <none|summary|detail|gaps>                         (summary) detail=per-test, gaps=who's-missing
  --examples <none|summary|full>                             (summary)
  --neg-types <none|summary|full>                            (summary) full=each rule + snippet + line
  --bugs <none|summary|full>                                 (none)    // TODO[BUG] markers naming the symbol
  --limitation <none|summary|full>                           (none)    // TODO[LIMITATION] markers naming the symbol
  --cell-caveats <none|summary|full>                         (none)    BUG/LIMITATION on cells (coord-scoped): summary=per-cell map, full=markers; --coord filters cells
  --name-search <none|full>                                  (none)

GLOBAL FOCUS — matrix COORDINATES, the one focus filter (db[/version[/connector[/file]]]):
  --coord <coord>                  focus EVERY db/cell-aware section on a coordinate — glob '*'
                                   and brace '{a,b}', REPEATABLE (union). Best-effort per section:
                                   tests + emitted-sql + legacy examples match the full
                                   db/version/connector(/file) cell (examples derive theirs from
                                   the filename); the db-only sections (docs incl. TS snippets,
                                   shown-in-simplified-def, negative-type) match the db segment.
                                   Keeps db-agnostic 'general' docs. The optional 4th (file) segment
                                   is a glob/brace on the test-file basename and coexists with
                                   --file-name-pattern (a regex over the full path + doc pages); both
                                   AND. A coord matching no indexed cell/file is an error (nullglob).
                                   Examples:
                                     --coord postgres                 (everything postgres)
                                     --coord 'postgres/*/{pg,postgres}'  (those test connectors)
                                     --coord '*/newest' --coord mysql    (newest everywhere + all mysql)

NARROW WITHIN SECTIONS:
  --test-name-pattern <regex>      tests by name
  --file-name-pattern <regex>      file dimensions (test files, doc pages)
  --owner-kind <interface|class|type>   declared/signature by owner kind
  --owner <name>                   …by a specific owner
  --breakpoint <n>                 version-gates to one breakpoint (e.g. 18_000_000)

  --for <intent>                   preset the sections for a task (available: ${Object.keys(PRESETS).join(', ')})
  --index <path>                   index file to read (default: ${DEFAULT_DB})

Requires the index (build it with \`tests:index\`). Reads it read-only and warns if stale.
Under \`npm run\` the flags need a \`--\` separator. Reference: test/lib/codeSearcher/CODE_SEARCHER.md.`

// ── door resolution ──────────────────────────────────────────────────────────
function normPath(rawPath: string): string {
    return isAbsolute(rawPath) ? relative(process.cwd(), rawPath) : relative('.', resolve(rawPath))
}

type LocationResult =
    | { kind: 'symbol', name: string, banner: string }
    | { kind: 'pick', names: string[], banner: string }
    | { kind: 'test', banner: string }
    | { kind: 'error', message: string }

// Resolve `--search-location path:line`. A TEST file → inverse search (the enclosing
// test_block + the public API it exercises). A source file → the callees on the line
// (--location-target callees) or the enclosing function/member (default).
function resolveLocation(db: QueryDb, spec: string, target: 'enclosing' | 'callees'): LocationResult {
    const m = spec.match(/^(.*):(\d+)$/)
    if (!m) return { kind: 'error', message: `invalid --search-location '${spec}' — expected <path>:<line> (e.g. src/foo.ts:84).` }
    const path = normPath(m[1]!), line = Number(m[2])

    if (path.startsWith('test/') && path.endsWith('.test.ts')) {
        const tb = enclosingTestBlock(db, path, line)
        if (!tb) return { kind: 'error', message: `no test() encloses ${path}:${line}.` }
        const api = testBlockApi(db, tb.id)
        const lines = [
            `# inverse search: test \`${tb.name}\``,
            '',
            `> resolved ${path}:${line} → test (lines ${tb.start_line}–${tb.end_line}), cell ${tb.db}/${tb.version}/${tb.connector}${tb.is_active ? '' : ' [skip/todo]'}`,
            '',
            '## Public API this test exercises',
            ...(api.length
                ? api.map(a => `- \`${a.symbol_name}\`${a.uses > 1 ? ` ×${a.uses}` : ''} (first at L${a.line})`)
                : ['- (no resolved API references)']),
            '',
        ]
        return { kind: 'test', banner: lines.join('\n') }
    }

    if (target === 'callees') {
        const callees = calleesAt(db, path, line)
        if (!callees.length) return { kind: 'error', message: `no calls recorded on ${path}:${line} (try --location-target enclosing).` }
        const names = [...new Set(callees.map(c => c.callee_name))]
        if (names.length === 1) {
            return { kind: 'symbol', name: names[0]!, banner: `> resolved ${path}:${line} → callee \`${names[0]}\` (the function invoked on that line) — searching it.\n` }
        }
        return { kind: 'pick', names, banner: `> ${path}:${line} invokes ${names.length} functions: ${names.map(n => `\`${n}\``).join(', ')} — a report for each.\n\n` }
    }

    const enc = enclosingAt(db, path, line)
    if (!enc) return { kind: 'error', message: `no indexed function/symbol contains ${path}:${line} (is it a src/ file the index covers?).` }
    const owner = enc.owner ? `${enc.owner}.` : ''
    return { kind: 'symbol', name: enc.name, banner: `> resolved ${path}:${line} → ${enc.kind} \`${owner}${enc.name}\` (lines ${enc.start_line}–${enc.end_line}) — searching that.\n` }
}

// ── pattern modes ────────────────────────────────────────────────────────────
function runCmd(): string {
    const rt = (process.env['npm_config_user_agent'] ?? '').split('/')[0]
    return rt === 'npm' ? 'npm run tests:where-is -- ' : 'bun run tests:where-is '
}
function sampleRank(r: { decl_kind: string, abstract: number }): number {
    if (r.decl_kind === 'class') return r.abstract ? 0 : 1
    if (r.decl_kind === 'interface') return 3
    return 2
}
interface NameSummary { name: string, kinds: string, vis: Map<string, number>, count: number, sample: string }
function matchNames(db: QueryDb, re: RegExp): NameSummary[] {
    const byName = new Map<string, { kinds: Set<string>, vis: Map<string, number>, count: number, sample: string, sampleRank: number }>()
    for (const r of nameIndex(db)) {
        if (!re.test(r.name)) continue
        const e = byName.get(r.name) ?? { kinds: new Set(), vis: new Map(), count: 0, sample: '', sampleRank: Infinity }
        e.kinds.add(r.kind)
        e.vis.set(r.vis, (e.vis.get(r.vis) ?? 0) + 1)
        e.count++
        const rank = sampleRank(r)
        if (rank < e.sampleRank) { e.sampleRank = rank; e.sample = `${r.path}:${r.line}` }
        byName.set(r.name, e)
    }
    return [...byName.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, e]) => ({ name, kinds: [...e.kinds].join('/'), vis: e.vis, count: e.count, sample: e.sample }))
}
const VIS_ORDER = ['public', 'public_impl', 'public-surface', 'internal']
function visCounts(vis: Map<string, number>): string {
    const keys = [...VIS_ORDER.filter(k => vis.has(k)), ...[...vis.keys()].filter(k => !VIS_ORDER.includes(k))]
    return keys.map(k => `${k} ${vis.get(k)}`).join(', ')
}
function renderSummary(pattern: string, matches: NameSummary[]): string {
    const lines = [`# matches for /${pattern}/ — ${matches.length} name(s)`, '']
    for (const m of matches.slice(0, MATCH_CAP)) {
        lines.push(`- \`${m.name}\` — ${m.kinds} · ${visCounts(m.vis)} · ${m.count} decl(s) · e.g. ${m.sample}`)
    }
    if (matches.length > MATCH_CAP) lines.push(`- …and ${matches.length - MATCH_CAP} more`)
    const cmd = runCmd()
    lines.push('', `Run \`${cmd}--search <name>\` for the full report on one, or \`${cmd}--search-pattern '${pattern}'\` for all.`)
    return lines.join('\n') + '\n'
}

// ── --emits-keyword: SQL fragment → the SqlBuilder code that emits it ────────
// A self-contained report (the door is a SQL token, not a symbol): the emission sites
// grouped by file, plus the distinct enclosing methods as candidates to search next.
function renderEmitsKeyword(db: QueryDb, fragment: string): string {
    const hits = sqlEmitsMatching(db, fragment)
    if (!hits.length) return `# emits-keyword: \`${fragment}\`\n\nNo SqlBuilder string literal contains that fragment.\n`
    const out: string[] = [`# emits-keyword: \`${fragment}\` — ${hits.length} emission site(s)`, '']
    const byFile = new Map<string, typeof hits>()
    for (const h of hits) { const l = byFile.get(h.path) ?? []; if (!l.length) byFile.set(h.path, l); l.push(h) }
    for (const [path, list] of byFile) {
        out.push(`## ${path}`)
        for (const h of list) {
            const sc = h.scope_name ? `\`${h.scope_name}\` ` : ''
            out.push(`- ${sc}emits \`${h.literal.replace(/\s+/g, ' ').trim().slice(0, 80)}\` — ${path}:${h.line}${h.scope_start_line !== null ? ` (scope lines ${h.scope_start_line}–${h.scope_end_line})` : ''}`)
        }
        out.push('')
    }
    const scopes = [...new Set(hits.map(h => h.scope_name).filter((s): s is string => s !== null))]
    if (scopes.length) {
        out.push(`Methods to search next (the overriders are the usual divergence suspects): ${scopes.map(s => `\`${s}\``).join(', ')}`)
    }
    return out.join('\n') + '\n'
}

// ── build the section/filter options from defaults + preset + explicit flags ─
export function buildOptions(a: Args): SearchOptions {
    const presetSections = a.preset ? PRESETS[a.preset]! : {}
    const sections: Sections = { ...DEFAULT_SECTIONS, ...presetSections, ...a.sectionOverrides }
    const filters: Filters = { ...DEFAULT_FILTERS, ...a.filterOverrides }
    // Preset cell-caveats is coord-aware: `summary` (the per-cell map) when browsing, auto-raised to
    // `full` (the markers) once you scope with a --coord. The level MEANING is fixed (summary=map,
    // full=markers); the preset just picks the useful one. An explicit --cell-caveats still wins.
    if (presetSections.cellCaveats && a.sectionOverrides.cellCaveats === undefined && a.filterOverrides.coord?.length) {
        sections.cellCaveats = 'full'
    }
    return { sections, filters }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    const selectors = [args.exact, args.pattern, args.patternSummary, args.location, args.emitsKeyword].filter(s => s !== null)
    if (args.help || (selectors.length === 0 && args.error === null)) {
        console.log(HELP)
        process.exit(args.help ? 0 : 1)
    }
    if (args.error !== null) { console.error(args.error); process.exit(2) }
    if (selectors.length > 1) {
        console.error('give exactly one of --search / --search-pattern / --search-pattern-summary / --search-location.')
        process.exit(2)
    }
    if (!existsSync(args.index)) {
        console.error(`code index not found at ${args.index} — build it first with \`tests:index\`.`)
        process.exit(2)
    }

    const db = await openIndexDbReadonly(args.index)
    try {
        const meta = readMeta(db)
        if (meta.fatal) { console.error(`incompatible index: ${meta.fatal}`); process.exit(3) }
        const opts = buildOptions(args)
        // Validate each --coord against the index up front (nullglob): its db segment must name a
        // known database (incl. the db-agnostic 'general'); if it carries version/connector/file
        // segments, they only mean anything for the matrix cells, so it must match a real cell.
        if (opts.filters.coord.length) {
            const dbs = knownDbs(db), cells = distinctCells(db)
            for (const pat of opts.filters.coord) {
                if (pat.split('/').length > 4) {
                    console.error(`--coord '${pat}': too many levels — a coord is db/version/connector/file (4 max).`)
                    process.exit(2)
                }
                if (!dbs.some(d => coordDbMatches(d, pat))) {
                    console.error(`--coord '${pat}': no database matches '${pat.split('/')[0]}' — known: ${dbs.join(', ')}.`)
                    process.exit(2)
                }
                if (pat.includes('/') && !cells.some(c => coordMatch(c, pat))) {
                    console.error(`--coord '${pat}': no matrix cell/file matches (the version/connector/file segments apply to the test/example cells).`)
                    process.exit(2)
                }
            }
        }
        // --breakpoint must name a real SqlBuilder compatibility-version breakpoint (else the
        // version-gates section would silently empty), mirroring --coord's nullglob validation.
        if (opts.filters.breakpoint) {
            const bps = knownBreakpoints(db)
            if (!bps.includes(opts.filters.breakpoint)) {
                console.error(`unknown --breakpoint '${opts.filters.breakpoint}' — known: ${bps.join(', ')}.`)
                process.exit(2)
            }
        }
        const report = (name: string, banner = ''): string => banner + render(db, name, opts, meta)

        if (args.exact !== null) {
            process.stdout.write(report(args.exact))
        } else if (args.emitsKeyword !== null) {
            process.stdout.write(renderEmitsKeyword(db, args.emitsKeyword))
        } else if (args.location !== null) {
            const r = resolveLocation(db, args.location, args.locationTarget)
            if (r.kind === 'error') { console.error(r.message); process.exit(2) }
            else if (r.kind === 'symbol') process.stdout.write(report(r.name, r.banner))
            else if (r.kind === 'test') process.stdout.write(r.banner)   // inverse: the banner IS the report
            else process.stdout.write(r.banner + r.names.map(n => render(db, n, opts, meta)).join('\n---\n\n'))
        } else if (args.patternSummary !== null) {
            const re = compileRe(args.patternSummary)
            if (typeof re === 'string') { console.error(`--search-pattern-summary: ${re}`); process.exit(2) }
            const matches = matchNames(db, re)
            if (matches.length === 0) { console.error(`no names match /${args.patternSummary}/.`); process.exit(2) }
            process.stdout.write(renderSummary(args.patternSummary, matches))
        } else {
            const re = compileRe(args.pattern!)
            if (typeof re === 'string') { console.error(`--search-pattern: ${re}`); process.exit(2) }
            const matches = matchNames(db, re)
            if (matches.length === 0) { console.error(`no names match /${args.pattern}/.`); process.exit(2) }
            if (matches.length === 1) {
                process.stdout.write(report(matches[0]!.name))
            } else {
                const shown = matches.slice(0, FULL_CAP)
                let out = `# ${matches.length} matches for /${args.pattern}/ — full reports\n\n`
                out += shown.map(m => render(db, m.name, opts, meta)).join('\n---\n\n')
                if (matches.length > FULL_CAP) {
                    out += `\n---\n\n_(showing ${FULL_CAP} of ${matches.length} — narrow the pattern, or use \`${runCmd()}--search-pattern-summary '${args.pattern}'\` for the full list.)_\n`
                }
                process.stdout.write(out)
            }
        }
    } finally {
        db.close()
    }
}

// Run the CLI only when this file is the entry point — so importing parseArgs/buildOptions from a
// standalone check (test/lib/codeSearcher/verify.ts) doesn't trigger a search. Works under bun and tsx.
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
    await main()
}
