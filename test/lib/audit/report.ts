// eslint/oxlint-style reporting for the content findings (AUDIT.md § Output).
// Findings grouped by file (path header, then aligned `line  severity  message
// rule` rows), an `✖ N problems` summary, and a per-rule tally. Errors listed in
// full; a large warning backlog (the migration phase) is capped unless `--all`.

import type { Finding, Severity } from './types.js'
import { RULE_SEVERITY, RULE_HINT } from './rules.js'

export interface ReportOpts {
    strict: boolean
    explain: boolean
    all: boolean
}

export function resolveSeverity(rule: string, strict: boolean): Severity {
    if (strict) return 'error'
    return RULE_SEVERITY[rule] ?? 'error'
}

// Cap the listing when a large warning backlog would otherwise flood the output.
const WARN_LIST_LIMIT = 50

const useColor = Boolean(process.stdout.isTTY) && !process.env['NO_COLOR']
const paint = (code: string, s: string): string => useColor ? `\x1b[${code}m${s}\x1b[0m` : s
const dim = (s: string): string => paint('2', s)
const red = (s: string): string => paint('31', s)
const yellow = (s: string): string => paint('33', s)
const boldRed = (s: string): string => paint('1;31', s)
const underline = (s: string): string => paint('4', s)

export function reportFindings(findings: Finding[], opts: ReportOpts): { errors: number, warnings: number } {
    const withSev = findings.map(f => ({ f, sev: resolveSeverity(f.rule, opts.strict) }))
    const errors = withSev.filter(x => x.sev === 'error')
    const warns = withSev.filter(x => x.sev !== 'error')

    // Errors always in full; warnings capped unless --all or under the limit.
    const shownWarns = (opts.all || warns.length <= WARN_LIST_LIMIT) ? warns : warns.slice(0, WARN_LIST_LIMIT)
    const shown = [...errors, ...shownWarns]

    if (shown.length) {
        console.log('')
        for (const [file, group] of groupByFile(shown)) {
            console.log(underline(file))
            const lineWidth = Math.max(...group.map(g => String(g.f.line).length))
            for (const { f, sev } of group) {
                const loc = String(f.line).padStart(lineWidth)
                const sevWord = (sev === 'error' ? red('error  ') : yellow('warning'))
                console.log(`  ${dim(loc)}  ${sevWord}  ${f.message}  ${dim(f.rule)}`)
                if (opts.explain) {
                    const hint = RULE_HINT[f.rule]
                    if (hint) console.log(`  ${' '.repeat(lineWidth)}  ${dim('└─ ' + hint)}`)
                }
            }
            console.log('')
        }
    }

    const hiddenWarns = warns.length - shownWarns.length
    if (hiddenWarns > 0) {
        console.log(dim(`… and ${hiddenWarns} more warning(s) — run with --all to list, or scope with a coord / --only <rule>`))
        console.log('')
    }

    // Per-rule tally — the backlog shape at a glance.
    const tally = new Map<string, number>()
    for (const { f } of withSev) tally.set(f.rule, (tally.get(f.rule) ?? 0) + 1)
    if (tally.size) {
        const sorted = [...tally].sort((a, b) => b[1] - a[1])
        console.log(dim('rules: ' + sorted.map(([r, n]) => `${r} ${n}`).join('  ')))
    }

    const total = errors.length + warns.length
    const summary = `✖ ${total} problem${total === 1 ? '' : 's'} (${errors.length} error${errors.length === 1 ? '' : 's'}, ${warns.length} warning${warns.length === 1 ? '' : 's'})`
    console.log(errors.length ? boldRed(summary) : (warns.length ? yellow(summary) : summary))

    return { errors: errors.length, warnings: warns.length }
}

function groupByFile(findings: { f: Finding, sev: Severity }[]): Map<string, { f: Finding, sev: Severity }[]> {
    const sorted = [...findings].sort((a, b) => a.f.file === b.f.file ? a.f.line - b.f.line : a.f.file.localeCompare(b.f.file))
    const map = new Map<string, { f: Finding, sev: Severity }[]>()
    for (const x of sorted) {
        const list = map.get(x.f.file) ?? []
        list.push(x)
        map.set(x.f.file, list)
    }
    return map
}
