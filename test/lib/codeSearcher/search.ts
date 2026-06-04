#!/usr/bin/env bun
// The CODE SEARCHER — the consumer half of the code index. Given a target (an exact
// name, a regex over names, or a source location), it prints a markdown report:
// does it exist? public or internal? how is it reached from the public API? where is
// it explained, exemplified and tested? Output is meant to be pasted into a wave plan.
//
// It is a SEPARATE tool from the indexer: it never writes the index, only reads it
// (read-only handle). It reuses the indexer's db.ts / schema.ts. See CODE_SEARCHER.md.
//
// Usage:  bun test/lib/codeSearcher/search.ts (--search <name> | --search-pattern <regex>
//             | --search-location <path:line>) [--search-mode <strategy>]… [--db <path>]
//         (or via `bun run tests:where-is …`).

import { existsSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { openIndexDbReadonly, type QueryDb } from '../codeIndexer/db.js'
import { readMeta } from './meta.js'
import { nameIndex, enclosingAt } from './queries.js'
import { render, STRATEGIES, type SearchOptions, type Strategy } from './render.js'

const DEFAULT_DB = 'test/lib/codeIndexer/generated/code-index.sqlite'
const MATCH_CAP = 40    // rows in a --search-pattern-summary list
const FULL_CAP = 25     // full reports a --search-pattern expands to before truncating

interface Args {
    exact: string | null            // --search <name>
    pattern: string | null          // --search-pattern <regex> → full report per match
    patternSummary: string | null   // --search-pattern-summary <regex> → compact pick-list
    location: string | null         // --search-location <path:line>
    modes: Strategy[]               // --search-mode <strategy> (repeatable)
    db: string
    help: boolean
    error: string | null
}

function parseArgs(argv: string[]): Args {
    const args: Args = { exact: null, pattern: null, patternSummary: null, location: null, modes: [], db: DEFAULT_DB, help: false, error: null }
    const need = (i: number): string | null => argv[i] ?? null
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!
        if (a === '-h' || a === '--help') args.help = true
        else if (a === '--search') args.exact = need(++i)
        else if (a === '--search-pattern') args.pattern = need(++i)
        else if (a === '--search-pattern-summary') args.patternSummary = need(++i)
        else if (a === '--search-location') args.location = need(++i)
        else if (a === '--search-mode') {
            const v = need(++i)
            if (v && (STRATEGIES as string[]).includes(v)) {
                if (!args.modes.includes(v as Strategy)) args.modes.push(v as Strategy)
            } else args.error = `invalid --search-mode value '${v ?? '(missing)'}' — use one of: ${STRATEGIES.join(', ')}.`
        }
        else if (a === '--db') args.db = need(++i) ?? args.db
        else args.error = `unexpected argument '${a}' — the target goes behind --search / --search-pattern / --search-pattern-summary / --search-location.`
    }
    if (args.modes.length === 0) args.modes.push('chain-strict')   // default mode
    return args
}

const HELP = `tests:where-is (--search <name> | --search-pattern <regex> | --search-location <path:line>)
              [--search-mode <strategy>]… [--db <path>]

Search the code index and print a markdown report: classification, signature/JSDoc,
where it's implemented/explained/tested, and the search-mode section(s) you ask for.

WHAT to search for (exactly one):
  --search <name>              an exact symbol/member name (e.g. orderBy, __addOrderBy)
  --search-pattern <regex>     a JS regex over names (like vitest's --testNamePattern) →
                               a FULL report for every matching name
  --search-pattern-summary <regex>  same regex, but just a compact LIST of the matches
                               (name · kind · visibility · decls · sample) to pick from
  --search-location <path:line> a source location; resolves to the function/method that
                               ENCLOSES that line and searches it (e.g.
                               src/connections/MariaDBConnection.ts:84)

HOW to search — --search-mode is REPEATABLE; combine freely (default: chain-strict):
  --search-mode chain-strict   CALL-CHAIN: walk the invocation graph upward and stop at
                               the first PUBLIC caller — the precise route public→internal.
  --search-mode chain-broad    CALL-CHAIN, but keep climbing PAST the public callers
                               through the whole graph (wider recall, crosses funnels).
  --search-mode name           NAME-BASED: every place the name appears across all
                               dimensions; ignores the call-chain (high recall, low prec.).

  --db <path>                  index file to read (default: ${DEFAULT_DB})

Requires the index (build it with \`tests:index\`). Reads it read-only and warns if it
looks stale vs the working tree. Reference: test/lib/codeSearcher/CODE_SEARCHER.md.`

// Resolve `--search-location path:line` → the enclosing element's name, with a banner.
function resolveLocation(db: QueryDb, spec: string): { name: string, banner: string } | string {
    const m = spec.match(/^(.*):(\d+)$/)
    if (!m) return `invalid --search-location '${spec}' — expected <path>:<line> (e.g. src/foo.ts:84).`
    const rawPath = m[1]!, line = Number(m[2])
    const path = isAbsolute(rawPath) ? relative(process.cwd(), rawPath) : relative('.', resolve(rawPath))
    const enc = enclosingAt(db, path, line)
    if (!enc) return `no indexed function/symbol contains ${path}:${line} (is it a src/ file the index covers?).`
    const owner = enc.owner ? `${enc.owner}.` : ''
    return { name: enc.name, banner: `> resolved ${path}:${line} → ${enc.kind} \`${owner}${enc.name}\` (lines ${enc.start_line}–${enc.end_line}) — searching that.\n` }
}

function compileRe(pattern: string): RegExp | string {
    try { return new RegExp(pattern) } catch (e) { return `invalid regex: ${(e as Error).message}` }
}

// How the user invoked us, so suggested commands are copy-pasteable as-is. `bun run`
// passes flags straight through; `npm run` needs the `--` separator. Falls back to bun
// (the project default) when run directly (env unset).
function runCmd(): string {
    const rt = (process.env['npm_config_user_agent'] ?? '').split('/')[0]
    return rt === 'npm' ? 'npm run tests:where-is -- ' : 'bun run tests:where-is '
}

// Rank a declaration as a SAMPLE location: prefer an implementation class (best if
// abstract — the shared base) over an interface. Lower is better.
function sampleRank(r: { decl_kind: string, abstract: number }): number {
    if (r.decl_kind === 'class') return r.abstract ? 0 : 1
    if (r.decl_kind === 'interface') return 3
    return 2   // type/function/const/enum sit between class and interface
}

// Distinct names matching the regex, each with a compact summary (shared by both pattern modes).
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
        if (rank < e.sampleRank) { e.sampleRank = rank; e.sample = `${r.path}:${r.line}` }   // prefer impl class, abstract best
        byName.set(r.name, e)
    }
    return [...byName.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, e]) => ({ name, kinds: [...e.kinds].join('/'), vis: e.vis, count: e.count, sample: e.sample }))
}

// Visibility counts, segregated, in a stable order (only the ones present).
const VIS_ORDER = ['public', 'public_impl', 'public-surface', 'internal']
function visCounts(vis: Map<string, number>): string {
    const keys = [...VIS_ORDER.filter(k => vis.has(k)), ...[...vis.keys()].filter(k => !VIS_ORDER.includes(k))]
    return keys.map(k => `${k} ${vis.get(k)}`).join(', ')
}

// `--search-pattern-summary` → the compact pick-list (always a list, regardless of count).
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

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    const selectors = [args.exact, args.pattern, args.patternSummary, args.location].filter(s => s !== null)
    if (args.help || selectors.length === 0) {
        console.log(HELP)
        process.exit(args.help ? 0 : 1)
    }
    if (args.error !== null) { console.error(args.error); process.exit(2) }
    if (selectors.length > 1) {
        console.error('give exactly one of --search / --search-pattern / --search-pattern-summary / --search-location.')
        process.exit(2)
    }
    if (!existsSync(args.db)) {
        console.error(`code index not found at ${args.db} — build it first with \`tests:index\`.`)
        process.exit(2)
    }

    const db = await openIndexDbReadonly(args.db)
    try {
        const meta = readMeta(db)
        if (meta.fatal) {
            console.error(`incompatible index: ${meta.fatal}`)
            process.exit(3)
        }
        const opts: SearchOptions = { searches: args.modes }
        const report = (name: string, banner = ''): string => banner + render(db, name, opts, meta)

        // Resolve WHAT to search → write the output.
        if (args.exact !== null) {
            process.stdout.write(report(args.exact))
        } else if (args.location !== null) {
            const r = resolveLocation(db, args.location)
            if (typeof r === 'string') { console.error(r); process.exit(2) }
            process.stdout.write(report(r.name, r.banner))
        } else if (args.patternSummary !== null) {
            const re = compileRe(args.patternSummary)
            if (typeof re === 'string') { console.error(`--search-pattern-summary: ${re}`); process.exit(2) }
            const matches = matchNames(db, re)
            if (matches.length === 0) { console.error(`no names match /${args.patternSummary}/.`); process.exit(2) }
            process.stdout.write(renderSummary(args.patternSummary, matches))
        } else {
            // --search-pattern → a full report for every match (capped).
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

await main()
