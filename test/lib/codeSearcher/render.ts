// Renders a `where-is` answer as human-readable markdown — the artifact the
// coverage agent pastes into a wave plan. Orchestrates the query layer
// (queries.ts) and emits only the sections that have content. No JSON in v1.

import type { QueryDb } from '../codeIndexer/db.js'
import type { MetaInfo } from './meta.js'
import * as Q from './queries.js'

// The two search strategies, flattened into named choices. `chain-*` walk the
// invocation graph (the call-chain search); `name` is the name-based discovery search.
// Selected via repeatable `--search`; multiple may be combined.
export type Strategy = 'chain-strict' | 'chain-broad' | 'name'
export const STRATEGIES: Strategy[] = ['chain-strict', 'chain-broad', 'name']

export interface SearchOptions {
    searches: Strategy[]   // which search(es) to run; order preserved, deduped
}

// The enclosing block of a printed line, LABELLED so it's clear what the range is
// (a definition body, a calling function, a doc snippet) — the agent opens exactly
// that section. `label` names the block, e.g. "definition spans" → "(definition spans
// lines 241–249)".
function block(label: string, start: number | null, end: number | null): string {
    if (start === null || end === null) return ''
    return ` (${label} lines ${start}–${end})`
}

function firstLine(text: string | null): string | null {
    if (!text) return null
    for (const raw of text.split('\n')) {
        const line = raw
            .replace(/^\s*\/\*\*?/, '')   // opening /** or /*
            .replace(/\*\/\s*$/, '')      // closing */
            .replace(/^\s*\*\s?/, '')     // leading * of a jsdoc body line
            .trim()
        if (line.length > 0) return line
    }
    return null
}

// Count distinct owners of a member by their kind (interface vs class vs type), so the
// summary can tell the agent WHERE the name lives — the type contract (interface) or the
// implementation (class).
function ownerBreakdown(mems: Q.MemberHit[]): string {
    const byKind = new Map<string, Set<string>>()
    for (const m of mems) {
        if (!byKind.has(m.owner_kind)) byKind.set(m.owner_kind, new Set())
        byKind.get(m.owner_kind)!.add(m.owner)
    }
    const order = ['interface', 'class', 'type']
    const bits: string[] = []
    for (const k of [...order, ...[...byKind.keys()].filter(k => !order.includes(k))]) {
        const set = byKind.get(k)
        if (!set || set.size === 0) continue
        const plural = set.size > 1 ? (k === 'class' ? 'es' : 's') : ''
        bits.push(`${set.size} ${k}${plural}`)
    }
    return bits.join(' + ')
}

function classify(name: string, ex: Q.Existence, syms: Q.SymbolHit[], mems: Q.MemberHit[], pubIfaces: Q.PublicIface[]): string {
    if (ex.any_sym === 0 && ex.any_member === 0) {
        return `**not found** — no symbol or member named \`${name}\` is indexed (likely a typo or hallucination).`
    }
    const parts: string[] = []
    const publicSym = syms.find(s => s.is_public)
    const surfSym = syms.find(s => s.is_public_surface === 1)   // public-surface but not directly importable
    if (publicSym) {
        const sub = publicSym.export_subpath ? ` (\`${publicSym.export_subpath}\`)` : ''
        parts.push(`**public** ${publicSym.kind}${sub}`)   // directly importable: interface | class | type | function | …
    } else if (surfSym) {
        parts.push(`**public-surface** ${surfSym.kind} (used through the fluent API; not directly importable)`)
    } else if (syms[0]) {
        parts.push(`**internal** ${syms[0].kind} (not in the public exports)`)
    }
    // Member case: public ⟺ exposed by a public interface; a class that implements it is public-by-impl.
    if (ex.any_member > 0 && !publicSym && !surfSym) {
        const breakdown = ownerBreakdown(mems)
        if (pubIfaces.length) {
            const names = pubIfaces.slice(0, 4).map(i => `\`${i.owner}\``).join(', ')
            const more = pubIfaces.length > 4 ? `, +${pubIfaces.length - 4} more` : ''
            parts.push(`a **public-surface member**, exposed by ${names}${more} (declared on ${breakdown})`)
        } else {
            parts.push(`an **internal member**, exposed by no public interface (declared on ${breakdown})`)
        }
    }
    return parts.length ? parts.join(', ') + '.' : `${ex.any_member} member declaration(s).`
}

// One row per public ENTRY POINT (caller), keeping the first call site as representative —
// the question here is "which public methods reach it", grouped by area. (Exact per-line
// call sites of the seed itself live in the Direct callers list below.)
function dedupPublicHops(hops: Q.ChainHop[]): Q.ChainHop[] {
    const seen = new Set<string>()
    const out: Q.ChainHop[] = []
    for (const h of hops.filter(h => h.is_public_hop === 1)) {
        const key = `${h.caller}@${h.path}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(h)
    }
    return out
}

export function render(db: QueryDb, name: string, opts: SearchOptions, meta: MetaInfo): string {
    const out: string[] = []
    const push = (s = ''): void => { out.push(s) }

    push(`# where-is: \`${name}\``)
    push()

    // Provenance + staleness (always shown so the answer carries its trust level).
    const builtAt = meta.map['built_at'] ?? '(unknown)'
    const rev = meta.map['git_rev'] ? meta.map['git_rev'].slice(0, 8) : '(no git)'
    push(`> index: built ${builtAt} · ${rev}${meta.map['git_dirty'] === '1' ? '-dirty' : ''} · ${meta.resolved ? 'resolved' : 'name-based'} · schema v${meta.map['schema_version'] ?? '?'}`)
    for (const w of meta.warnings) push(`> ⚠️  ${w}`)
    push()

    // 1. Existence + classification
    const ex = Q.existence(db, name)
    const syms = Q.symbols(db, name)
    const mems = Q.members(db, name)
    const pubIfaces = Q.publicInterfacesDeclaring(db, name)   // public interfaces exposing this name (for the "exposed by" detail)
    push('## Classification')
    push(classify(name, ex, syms, mems, pubIfaces))
    if (ex.any_sym === 0 && ex.any_member === 0) {
        return out.join('\n') + '\n'   // nothing else to say
    }
    push()

    // Where it's declared (symbols + member owners)
    if (syms.length) {
        push('## Declared')
        for (const s of syms.slice(0, 12)) {
            const flags = [s.is_public ? 'public' : 'internal', s.kind].join(' ')
            push(`- ${flags} \`${s.name}\` — ${s.path}:${s.start_line}${block('definition spans', s.start_line, s.end_line)}`)
            const doc = firstLine(s.jsdoc)
            if (doc) push(`  - ${doc}`)
        }
        if (syms.length > 12) push(`- …and ${syms.length - 12} more`)
        push()
    }

    // 2. Signature + JSDoc (members carrying this name; simplified map first).
    // Each line is prefixed with the OWNER KIND (interface vs class/type) so the agent
    // knows whether it's looking at the type contract or the implementation.
    if (mems.length) {
        push('## Signature')
        const shown = new Set<string>()
        for (const m of mems) {
            const key = `${m.owner}.${m.name}`
            if (shown.has(key)) continue
            shown.add(key)
            if (shown.size > 10) { push(`- …and more (${mems.length} total member declarations)`); break }
            const sig = m.signature ? m.signature.replace(/\s+/g, ' ').trim() : m.name
            // visibility is materialised in the index (public | public_impl | internal).
            const mark = m.visibility === 'public_impl' ? 'public impl' : m.visibility
            push(`- [${mark}] ${m.owner_kind} \`${m.owner}.${sig}\`  — ${m.path}:${m.start_line}${block('definition spans', m.start_line, m.end_line)}`)
            const doc = firstLine(m.jsdoc)
            if (doc) push(`  - ${doc}`)
        }
        push()
    }

    // 3. Search — CHAIN strategies (one section per requested chain-* search).
    for (const broad of [false, true]) {
        const strat = broad ? 'chain-broad' : 'chain-strict'
        if (!opts.searches.includes(strat)) continue
        push(`## Search: ${strat} (call-chain)`)
        const chain = Q.callChain(db, name, broad)
        if (!chain.hops.length) {
            push(`No recorded callers reach \`${name}\`.`)
            push()
            continue
        }
        const publicHops = dedupPublicHops(chain.hops)
        if (publicHops.length) {
            push('Public API reached (public callers that reach it, grouped by area):')
            const byArea = new Map<string, Q.ChainHop[]>()
            for (const h of publicHops) {
                const list = byArea.get(h.area) ?? []
                if (list.length === 0) byArea.set(h.area, list)
                list.push(h)
            }
            for (const [area, hs] of [...byArea].sort((a, b) => b[1].length - a[1].length)) {
                push(`- **${area}** (${hs.length}):`)
                for (const h of hs.slice(0, 8)) {
                    push(`  - \`${h.caller}\` invokes \`${h.callee}\` at ${h.path}:${h.call_line}${block('caller body', h.caller_start_line, h.caller_end_line)}`)
                }
                if (hs.length > 8) push(`  - …and ${hs.length - 8} more in ${area}`)
            }
        } else {
            push(`No public caller reached within ${chain.hops.length} edge(s). ${broad ? '' : 'Try `--search chain-broad` to climb the whole chain.'}`)
        }
        // Direct callers (depth 1) give immediate context regardless of layer.
        const direct = chain.hops.filter(h => h.depth === 1)
        if (direct.length) {
            push('')
            push(`Direct callers (invoke \`${name}\`):`)
            const seen = new Set<string>()
            for (const h of direct) {
                const key = `${h.caller}@${h.path}:${h.call_line}`
                if (seen.has(key)) continue
                seen.add(key)
                if (seen.size > 15) { push('- …'); break }
                push(`- \`${h.caller}\` (${h.area}) — invoked at ${h.path}:${h.call_line}${block('caller body', h.caller_start_line, h.caller_end_line)}`)
            }
        }
        if (chain.truncated) push(`\n_(call graph truncated — too many edges; narrow the seed.)_`)
        push()
    }

    // §9.2 interface→class bridge — WITH locations, so the agent reaches the impl directly.
    if (mems.length) {
        const impls = Q.implementedBy(db, name)
        if (impls.length) {
            push('## Implemented by')
            push(`Classes implementing an interface that declares \`${name}\`:`)
            for (const c of impls.slice(0, 20)) {
                if (c.impl_start !== null) {
                    // own implementation → point the line at the IMPLEMENTATION, show both spans.
                    push(`- class \`${c.cls}\` — ${c.path}:${c.impl_start} (implementation spans lines ${c.impl_start}–${c.impl_end}; class spans lines ${c.class_start}–${c.class_end})`)
                } else {
                    // inherited → no concrete \`${name}\` element here; only the class span.
                    push(`- class \`${c.cls}\` — ${c.path} (inherits it; class spans lines ${c.class_start}–${c.class_end})`)
                }
            }
            if (impls.length > 20) push(`- …and ${impls.length - 20} more`)
            const defs = Q.simplifiedDefsDeclaring(db, name)
            if (defs.length) {
                push('')
                push('Realizes simplified def(s):')
                for (const d of defs) push(`- \`${d.name}\` — ${d.path}:${d.start_line}${block('definition spans', d.start_line, d.end_line)}`)
            }
            push()
        }
    }

    // 4. Where explained / reflected in the docs
    const docs = Q.docHits(db, name)
    if (docs.length) {
        push('## Explained in docs')
        for (const d of docs.slice(0, 20)) {
            const head = d.heading ? ` — "${d.heading}"` : ''
            push(`- ${d.page}:${d.md_line}${block('snippet spans', d.block_start, d.block_end)}${head} [${d.kind}, ${d.dbs}]`)
        }
        if (docs.length > 20) push(`- …and ${docs.length - 20} more occurrences`)
        push()
    }

    // R8/R8b: simplified reconcile (when the name is itself a def) + member-in-def
    const recon = Q.reconcileForDef(db, name)
    if (recon.length) {
        push('## Simplified definition')
        for (const r of recon) {
            const drift = r.extra_in_simplified > 0 ? ` · ⚠️ ${r.extra_in_simplified} shown-but-not-real` : ''
            const miss = r.partial ? '' : ` · ${r.missing_in_simplified} real members not shown`
            push(`- \`${r.source}\`${r.partial ? ' (partial)' : ''}: ${r.simplified_members} shown / ${r.real_members} real${miss}${drift}`)
        }
        push()
    }
    const inDef = Q.memberShownInSimplified(db, name)
    if (inDef.length) {
        push('## Shown in simplified-def docs')
        const seen = new Set<string>()
        for (const h of inDef) {
            const key = `${h.simplified_def}@${h.page}:${h.md_line}`
            if (seen.has(key)) continue
            seen.add(key)
            if (seen.size > 15) { push('- …'); break }
            push(`- \`${h.simplified_def}\` — ${h.page}:${h.md_line}${block('snippet spans', h.block_start, h.block_end)}`)
        }
        push()
    }

    // 5. Coverage
    const cov = Q.testCoverage(db, name)
    const exCov = Q.exampleCoverage(db, name)
    const neg = Q.negCoverage(db, name)
    if (cov.length || exCov.occurrences || neg.length) {
        push('## Coverage')
        if (cov.length) {
            const total = cov.reduce((a, r) => a + r.tests, 0)
            const newest = cov.reduce((a, r) => a + r.newest, 0)
            // newest is the telling number (older versions re-emit the same snapshots).
            push(`- matrix tests: ${total} total, ${newest} on newest — by db as newest/total: ${cov.map(r => `${r.db} ${r.newest}/${r.tests}`).join(', ')}`)
        }
        if (exCov.occurrences) push(`- legacy examples: ${exCov.occurrences} occurrence(s) across ${exCov.blocks} block(s)`)
        if (neg.length) {
            const total = neg.reduce((a, r) => a + r.assertions, 0)
            push(`- negative-type assertions: ${total} (${neg.map(r => `${r.db} ${r.assertions}`).join(', ')})`)
        }
        push()
    }

    // 6. Search — NAME strategy (name-based discovery; ignores the call-chain).
    if (opts.searches.includes('name')) {
        const disc = Q.discovery(db, name).filter(r => r.count > 0)
        push('## Search: name (name-based discovery, low precision)')
        if (disc.length) {
            for (const r of disc) push(`- ${r.where_}: ${r.count}`)
        } else {
            push('No occurrences in any dimension.')
        }
        push()
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}
