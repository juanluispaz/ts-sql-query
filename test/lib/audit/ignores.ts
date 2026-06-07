// Parse and apply the suppression comment — the eslint/oxlint syntax
// (AUDIT.md § The suppression comment):
//
//   // tests-audit-disable-next-line <rule> -- <reason>   (suppresses the next code line)
//   someCode() // tests-audit-disable-line <rule> -- <reason>   (suppresses this line)
//
// Mirrors `eslint-disable-next-line <rule> -- <description>`, with one stricter
// rule: the `-- <reason>` is MANDATORY. A missing reason, an unknown rule, or a
// directive that matches nothing are themselves findings (the meta-rules).

import type { Finding } from './types.js'
import { isContentRule, CONTENT_RULES } from './rules.js'

export interface IgnoreDirective {
    rule: string
    line: number        // the comment's own line
    targetLine: number  // the code line it suppresses (-1 if none)
    used: boolean
}

export interface IgnoreScan {
    directives: IgnoreDirective[]
    meta: Finding[]
}

// `tests-audit-disable-next-line` / `tests-audit-disable-line`, anywhere in a
// `//` comment (so a trailing `disable-line` works). Captures the variant + rest.
const DIRECTIVE_RE = /\/\/\s*tests-audit-disable-(next-line|line)\b(.*)$/
// `<rule> -- <reason>` (the eslint `--` description separator).
const RULE_REASON_RE = /^\s*([A-Za-z0-9-]+)\s*(?:--\s*(.*))?$/

export function scanIgnores(content: string, file: string): IgnoreScan {
    const lines = content.split('\n')
    const directives: IgnoreDirective[] = []
    const meta: Finding[] = []

    for (let i = 0; i < lines.length; i++) {
        const m = lines[i]!.match(DIRECTIVE_RE)
        if (!m) continue
        const line = i + 1
        const variant = m[1]! // 'next-line' | 'line'
        const rr = m[2]!.match(RULE_REASON_RE)

        if (!rr) {
            meta.push({
                rule: 'disable-without-reason', file, line,
                message: `tests-audit-disable-${variant} needs "<rule> -- <reason>" (known rules: ${CONTENT_RULES.join(', ')})`,
            })
            continue
        }
        const rule = rr[1]!
        const reason = (rr[2] ?? '').trim()
        if (!isContentRule(rule)) {
            meta.push({
                rule: 'unknown-rule', file, line,
                message: `unknown audit rule "${rule}" (known: ${CONTENT_RULES.join(', ')})`,
            })
            continue
        }
        if (reason === '') {
            meta.push({
                rule: 'disable-without-reason', file, line,
                message: `tests-audit-disable-${variant} ${rule} needs a non-empty reason after "--"`,
            })
            continue
        }
        const targetLine = variant === 'line' ? line : nextCodeLine(lines, i)
        directives.push({ rule, line, targetLine, used: false })
    }

    return { directives, meta }
}

// The first line after `from` that is neither blank nor a `//` comment — so a
// multi-line reason (continuation `//` lines) is skipped to reach the code.
function nextCodeLine(lines: string[], from: number): number {
    for (let j = from + 1; j < lines.length; j++) {
        const t = lines[j]!.trim()
        if (t === '' || t.startsWith('//')) continue
        return j + 1
    }
    return -1
}

// Drop findings covered by a directive (marking it used); return the rest.
export function applyIgnores(findings: Finding[], directives: IgnoreDirective[]): Finding[] {
    const kept: Finding[] = []
    for (const f of findings) {
        const d = directives.find(d => d.rule === f.rule && d.targetLine === f.line)
        if (d) { d.used = true; continue }
        kept.push(f)
    }
    return kept
}
