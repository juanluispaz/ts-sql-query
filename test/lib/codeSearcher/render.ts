// Renders a `where-is` answer as human-readable markdown — the artifact the
// coverage agent pastes into a wave plan. Orchestrates the query layer
// (queries.ts) and emits only the sections asked for, each at its own LEVEL.
//
// v2 model (see test/lib/symbolIndex/REPORT_MODEL_V2.md): one levelled flag per
// section (`none` hides it), plus cross-section result filters. The defaults
// reproduce the v1 report (everything `summary`, chain `strict`, name-search off).

import type { QueryDb } from '../codeIndexer/db.js'
import type { MetaInfo } from './meta.js'
import * as Q from './queries.js'

// ── per-section levels ───────────────────────────────────────────────────────
export type Level = 'none' | 'summary' | 'full'
export type ChainLevel = 'none' | 'strict' | 'broad' | 'full'
export type SignatureLevel = 'none' | 'summary' | 'public-interface' | 'public-impl' | 'internal' | 'full'
export type TestsLevel = 'none' | 'summary' | 'detail' | 'gaps'
export type DocsLevel = 'none' | 'summary' | 'by-page' | 'full'
export type NameSearchLevel = 'none' | 'full'
export type SurfaceLevel = 'none' | 'own' | 'all' | 'full'   // own = direct; all = +inherited/implemented (flat); full = broken down by source

export interface Sections {
    classification: Level
    declared: Level
    signature: SignatureLevel
    chain: ChainLevel
    refReturn: Level        // references to this element AS A RETURN TYPE (the "how to obtain a receiver" view)
    refImplements: Level    // references to this element IN AN implements/extends clause
    refTypeArg: Level       // references to this type AS A TYPE ARGUMENT (Outer<This>)
    refParam: Level         // references to this type AS A PARAMETER TYPE
    refField: Level         // references to this type AS A FIELD/PROPERTY TYPE
    refNew: Level           // references to this class IN A CONSTRUCTION (new X(...))
    refProperty: Level      // references to this member VIA PROPERTY ACCESS (read/write, not a call)
    refBrand: Level         // references to this unique-symbol AS A BRAND KEY ([sym]: T — phantom/branded types)
    surface: SurfaceLevel   // members of the declaring type(s); level = inheritance scope (own/all/full)
    versionGates: Level
    docs: DocsLevel
    simplified: Level
    emittedSql: Level
    tests: TestsLevel
    examples: Level
    negTypes: Level
    bugs: Level             // // TODO[BUG] markers naming the symbol — a src/ defect, re-enabled when fixed
    limitation: Level       // // TODO[LIMITATION] markers naming the symbol — not covered yet / env
    notApplicable: Level    // // NOT-APPLICABLE markers naming the symbol — a permanent dialect boundary
    cellCaveats: Level
    nameSearch: NameSearchLevel
}

export interface Filters {
    // The single GLOBAL focus filter — matrix coordinates db[/version[/connector[/file]]] with
    // glob `*` and brace `{a,b}`, repeatable (union). Applied to EVERY db/cell-aware section,
    // best-effort per dimension: tests + emitted-sql(test rows) match the full cell; the db-only
    // dimensions (examples, docs, shown-in-simplified-def, neg-type, emitted-sql doc rows) match
    // just the db segment. db-agnostic `general` docs are always kept.
    coord: string[]
    // Within-section narrowing (orthogonal to the matrix axes).
    testNamePattern: RegExp | null    // tests by name
    fileNamePattern: RegExp | null    // any file dimension (tests files, doc pages)
    ownerKind: string | null          // interface | class | type — declared/signature/impl
    owner: string | null              // a specific owner name
    breakpoint: string | null         // version-gates to one breakpoint
}

export interface SearchOptions {
    sections: Sections
    filters: Filters
}

export const DEFAULT_SECTIONS: Sections = {
    classification: 'summary', declared: 'summary', signature: 'summary', chain: 'strict',
    refReturn: 'none', refImplements: 'summary', refTypeArg: 'none', refParam: 'none', refField: 'none', refNew: 'none', refProperty: 'none', refBrand: 'none', surface: 'none', versionGates: 'none', docs: 'summary',
    simplified: 'summary', emittedSql: 'none', tests: 'summary', examples: 'summary',
    negTypes: 'summary', bugs: 'none', limitation: 'none', notApplicable: 'none', cellCaveats: 'none', nameSearch: 'none',
}
export const DEFAULT_FILTERS: Filters = {
    coord: [],
    testNamePattern: null, fileNamePattern: null, ownerKind: null, owner: null, breakpoint: null,
}

// ── small helpers ────────────────────────────────────────────────────────────
// The enclosing block of a printed line, LABELLED so it's clear what the range is.
function block(label: string, start: number | null, end: number | null): string {
    if (start === null || end === null) return ''
    return ` (${label} lines ${start}–${end})`
}

function firstLine(text: string | null): string | null {
    if (!text) return null
    for (const raw of text.split('\n')) {
        const line = raw
            .replace(/^\s*\/\*\*?/, '')
            .replace(/\*\/\s*$/, '')
            .replace(/^\s*\*\s?/, '')
            .trim()
        if (line.length > 0) return line
    }
    return null
}

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
    const surfSym = syms.find(s => s.is_public_surface === 1)
    if (publicSym) {
        const sub = publicSym.export_subpath ? ` (\`${publicSym.export_subpath}\`)` : ''
        parts.push(`**public** ${publicSym.kind}${sub}`)
    } else if (surfSym) {
        parts.push(`**public-surface** ${surfSym.kind} (used through the fluent API; not directly importable)`)
    } else if (syms[0]) {
        parts.push(`**internal** ${syms[0].kind} (not in the public exports)`)
    }
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

// ── --coord matrix coordinates — moved to the shared test/lib/coords.ts so the
//    audit (tests:audit positional coords) reuses the same matcher. Re-exported
//    here so search.ts / verify.ts keep importing them from './render.js'.
import {
    coordMatch, coordMatchAny, coordDbMatchAny, coordDbMatches, cellFromPath,
    type CellLike,
} from '../coords.js'
export { coordMatch, coordMatchAny, coordDbMatchAny, coordDbMatches, cellFromPath }
export type { CellLike }

// Filter a member list by the owner-kind / owner result filters (declared/signature).
function applyOwnerFilter(mems: Q.MemberHit[], f: Filters): Q.MemberHit[] {
    let out = mems
    if (f.ownerKind) out = out.filter(m => m.owner_kind === f.ownerKind)
    if (f.owner) out = out.filter(m => m.owner === f.owner)
    return out
}

// ── the report ───────────────────────────────────────────────────────────────
// `focus` (set when the door was a SOURCE --search-location) pins the report to the EXACT declaration
// at that path:line — the concrete overload you landed on — instead of the whole by-name family. Without
// it (a by-name --search) the declared/signature sections show the WHOLE function (every overload).
export function render(db: QueryDb, name: string, opts: SearchOptions, meta: MetaInfo, focus?: { path: string, line: number }): string {
    const atFocus = <T extends { path: string, start_line: number, end_line: number }>(rows: T[]): T[] => {
        if (!focus) return rows
        const at = rows.filter(r => r.path === focus.path && r.start_line <= focus.line && r.end_line >= focus.line)
        return at.length ? at : rows
    }
    const out: string[] = []
    const push = (s = ''): void => { out.push(s) }
    const S = opts.sections
    const F = opts.filters

    push(`# where-is: \`${name}\``)
    push()

    // Provenance + staleness banner (always shown so the answer carries its trust level).
    const builtAt = meta.map['built_at'] ?? '(unknown)'
    const rev = meta.map['git_rev'] ? meta.map['git_rev'].slice(0, 8) : '(no git)'
    push(`> index: built ${builtAt} · ${rev}${meta.map['git_dirty'] === '1' ? '-dirty' : ''} · ${meta.resolved ? 'resolved' : 'name-based'} · schema v${meta.map['schema_version'] ?? '?'}`)
    for (const w of meta.warnings) push(`> ⚠️  ${w}`)
    push()

    // 1. Existence + classification (always computed; the verdict header).
    const ex = Q.existence(db, name)
    const syms = Q.symbols(db, name)
    const mems = Q.members(db, name)
    const pubIfaces = Q.publicInterfacesDeclaring(db, name)
    if (S.classification !== 'none') {
        push('## Classification')
        push(classify(name, ex, syms, mems, pubIfaces))
        push()
    }
    if (ex.any_sym === 0 && ex.any_member === 0) {
        return out.join('\n') + '\n'   // nothing else to say
    }

    // Declared (symbol declaration sites). A SOURCE-line focus pins it to the declaration at that line
    // (the concrete overload, for an overloaded function), else every declaration shows.
    if (S.declared !== 'none' && syms.length) {
        const shownSyms = atFocus(syms)
        push('## Declared')
        const cap = S.declared === 'full' ? shownSyms.length : 12
        for (const s of shownSyms.slice(0, cap)) {
            const flags = [s.is_public ? 'public' : 'internal', s.kind].join(' ')
            push(`- ${flags} \`${s.name}\` — ${s.path}:${s.start_line}${block('definition spans', s.start_line, s.end_line)}`)
            const doc = firstLine(s.jsdoc)
            if (doc) push(`  - ${doc}`)
        }
        if (shownSyms.length > cap) push(`- …and ${shownSyms.length - cap} more`)
        if (focus && shownSyms.length < syms.length) push(`  (focused on ${focus.path}:${focus.line} — \`--search ${name}\` for all ${syms.length} declarations)`)
        push()
    }

    // 2. Signature + JSDoc (members; simplified map first). Visibility levels filter the set.
    if (S.signature !== 'none' && mems.length) {
        const visFilter: Record<string, string | null> = {
            'public-interface': 'public', 'public-impl': 'public_impl', 'internal': 'internal',
        }
        const wantVis = visFilter[S.signature] ?? null
        let shownMems = applyOwnerFilter(mems, F)
        if (wantVis) shownMems = shownMems.filter(m => m.visibility === wantVis)
        // An owner is OVERLOADED when it declares this name more than once (signatures + the impl). Only
        // THEN is the impl a `: any` catch-all (not a callable overload). A method with NO overloads has
        // exactly one declaration per owner — its impl IS the visible definition (don't treat it special).
        const ownerCount = new Map<string, number>()
        for (const m of mems) ownerCount.set(m.owner, (ownerCount.get(m.owner) ?? 0) + 1)
        const isOverloadImpl = (m: Q.MemberHit): boolean => m.is_implementation === 1 && (ownerCount.get(m.owner) ?? 0) > 1
        // A SOURCE-line focus → just the concrete overload; but landing on the overload IMPL (its `: any`
        // catch-all body) isn't "a specific overload" → show the whole function instead.
        let focusedMems = atFocus(shownMems)
        let landedOnImpl = false
        if (focus && focusedMems.length && focusedMems.every(isOverloadImpl)) { focusedMems = shownMems; landedOnImpl = true }
        // Dedup by SIGNATURE (not owner.name) so distinct overloads all show — by name you get the
        // whole function; located on a line you get that one. True duplicates still collapse.
        const distinct: Q.MemberHit[] = []
        const seen = new Set<string>()
        for (const m of focusedMems) {
            const sig = m.signature ? m.signature.replace(/\s+/g, ' ').trim() : m.name
            const key = `${m.owner}.${sig}`
            if (seen.has(key)) continue
            seen.add(key); distinct.push(m)
        }
        if (distinct.length) {
            push('## Signature')
            const cap = (S.signature === 'summary') ? 10 : distinct.length
            for (const m of distinct.slice(0, cap)) {
                const sig = m.signature ? m.signature.replace(/\s+/g, ' ').trim() : m.name
                const mark = m.visibility === 'public_impl' ? 'public impl' : m.visibility
                const implNote = isOverloadImpl(m) ? '  — _(implementation catch-all, not a callable overload)_' : ''
                push(`- [${mark}] ${m.owner_kind} \`${m.owner}.${sig}\`  — ${m.path}:${m.start_line}${block('definition spans', m.start_line, m.end_line)}${implNote}`)
                const doc = firstLine(m.jsdoc)
                if (doc) push(`  - ${doc}`)
            }
            if (distinct.length > cap) push(`- …and ${distinct.length - cap} more overload(s)`)
            if (landedOnImpl) push(`  (landed on the implementation catch-all — showing the whole function, all overloads)`)
            else if (focus && focusedMems.length < shownMems.length) push(`  (focused on the overload at ${focus.path}:${focus.line} — \`--search ${name}\` for all ${shownMems.length} declarations)`)
            push()
        }
    }

    // 3. Search — call-chain (strict / broad / full).
    if (S.chain !== 'none') {
        renderChain(push, db, name, S.chain, meta.resolved)
    }

    // ref-return — references to this element AS A RETURN TYPE: members whose return type
    // produces a receiver of this type (the "how to obtain a receiver" view, case B).
    if (S.refReturn !== 'none' && mems.length) {
        const producers = Q.producersOf(db, name)
        if (producers.length) {
            push('## Referenced as a return type (how to obtain a receiver)')
            push(`Members whose return type produces an object you can call \`${name}\` on:`)
            const cap = S.refReturn === 'full' ? producers.length : 12
            for (const p of producers.slice(0, cap)) {
                push(`- \`${p.owner}.${p.producer}\` → returns \`${p.produces}\` — ${p.path}:${p.start_line}${block('definition spans', p.start_line, p.end_line)}`)
            }
            if (producers.length > cap) push(`- …and ${producers.length - cap} more`)
            push()
        }
    }

    // ref-implements — references to this element IN AN implements/extends clause: the
    // interface→class bridge, incl. non-overriders / inherited (§9.2).
    if (S.refImplements !== 'none' && mems.length) {
        const impls = Q.implementedBy(db, name)
        if (impls.length) {
            push('## Referenced in implements/extends (implemented by)')
            push(`Classes implementing an interface that declares \`${name}\`:`)
            const cap = S.refImplements === 'full' ? impls.length : 20
            for (const c of impls.slice(0, cap)) {
                if (c.impl_start !== null) {
                    push(`- class \`${c.cls}\` — ${c.path}:${c.impl_start} (implementation spans lines ${c.impl_start}–${c.impl_end}; class spans lines ${c.class_start}–${c.class_end})`)
                } else {
                    push(`- class \`${c.cls}\` — ${c.path} (**inherits it, does not override**; class spans lines ${c.class_start}–${c.class_end})`)
                }
            }
            if (impls.length > cap) push(`- …and ${impls.length - cap} more`)
            const defs = Q.simplifiedDefsDeclaring(db, name)
            if (defs.length) {
                push('')
                push('Realizes simplified def(s):')
                for (const d of defs) push(`- \`${d.name}\` — ${d.path}:${d.start_line}${block('definition spans', d.start_line, d.end_line)}`)
            }
            push()
        }
    }

    // ref-{type-arg,param,field,new,property} — the v5 `reference` dimension: where the searched
    // element is referenced in a given syntactic role (keyed on the NAME). One helper, one section
    // per role; each self-omits when empty.
    const refRoleSection = (level: Level, role: string, header: string, desc: string): void => {
        if (level === 'none') return
        const hits = Q.referencesByRole(db, name, role)
        if (!hits.length) return
        push(`## ${header}`)
        push(desc)
        const cap = level === 'full' ? hits.length : 20
        for (const h of hits.slice(0, cap)) {
            const enclName = h.enclosing_member ? `${h.enclosing_owner ? `${h.enclosing_owner}.` : ''}${h.enclosing_member}` : h.enclosing_symbol
            const encl = enclName ? ` (in \`${enclName}\`)` : ''
            push(`- ${h.path}:${h.line}${encl}`)
        }
        if (hits.length > cap) push(`- …and ${hits.length - cap} more`)
        push()
    }
    refRoleSection(S.refTypeArg, 'type-arg', 'Referenced as a type argument', `Where \`${name}\` appears as a type argument (\`Outer<${name}>\`):`)
    refRoleSection(S.refParam, 'param', 'Referenced as a parameter type', `Where \`${name}\` is the declared type of a parameter:`)
    refRoleSection(S.refField, 'field', 'Referenced as a field type', `Where \`${name}\` is the declared type of a property/field:`)
    refRoleSection(S.refNew, 'new', 'Referenced in a construction (new)', `Where \`${name}\` is constructed (\`new ${name}(…)\`):`)
    refRoleSection(S.refProperty, 'property', 'Referenced via property access', `Where \`${name}\` is read/written as a property (not called):`)
    refRoleSection(S.refBrand, 'brand', 'Used as a brand key (branded/phantom types)', `Types branded by \`${name}\` — declared as the computed key \`[${name}]: T\` (the compiler discriminates on it):`)

    // Surface — the members of the declaring type(s). Seed a TYPE → its own members (its surface); seed a
    // MEMBER → its siblings (the other members of its owner(s), the fluent state's surface). Both from one
    // query (Q.surfaceOf). summary = the member NAMES per owner; full = signature + visibility + location.
    if (S.surface !== 'none') {
        const scope = S.surface   // 'own' | 'all' | 'full'
        const mem = Q.surfaceOf(db, name, scope)
        if (mem.length) {
            const typeSeed = mem.some(m => m.is_own === 1 && m.owner === name)
            // every member line carries path:line + span, so a caller can extract the code directly
            const line = (m: Q.SurfaceMember): string => {
                const vis = m.visibility === 'public' ? '' : ` [${m.visibility}]`
                return `  - ${m.signature ? `\`${m.signature}\`` : `\`${m.name}\``}${vis} — ${m.path}:${m.start_line}${block('spans', m.start_line, m.end_line)}`
            }
            const scopeNote = scope === 'own' ? 'declared directly (no inheritance)'
                : scope === 'all' ? 'everything it has — own + inherited + implemented'
                : 'broken down by declaring type — own + every inherited/implemented source'
            push(`## ${typeSeed ? 'Surface — members of the type' : 'Sibling API — the surface around it'} (${scope}: ${scopeNote})`)

            if (scope === 'full') {
                // grouped by the contributing type, own owners first, each member with its span
                const byOwner = new Map<string, Q.SurfaceMember[]>()
                for (const m of mem) { const l = byOwner.get(m.owner) ?? []; if (!l.length) byOwner.set(m.owner, l); l.push(m) }
                const owners = [...byOwner.keys()].sort((a, b) =>
                    (byOwner.get(b)![0]!.is_own - byOwner.get(a)![0]!.is_own) || a.localeCompare(b))
                const OWNER_CAP = 20
                for (const owner of owners.slice(0, OWNER_CAP)) {
                    const list = byOwner.get(owner)!
                    const tag = list[0]!.is_own ? 'own' : 'inherited'
                    push(`- **\`${owner}\`** (${list[0]!.owner_kind}, ${tag}) — ${list.length} member${list.length === 1 ? '' : 's'}:`)
                    for (const m of list.slice(0, 40)) push(line(m))
                    if (list.length > 40) push(`    - …and ${list.length - 40} more`)
                }
                if (owners.length > OWNER_CAP) push(`- …and ${owners.length - OWNER_CAP} more declaring type(s)`)
            } else {
                // own / all: a flat list, deduped by member name (own declaration wins)
                const seen = new Set<string>()
                const flat = mem.filter(m => { if (seen.has(m.name)) return false; seen.add(m.name); return true })
                push(`${flat.length} member${flat.length === 1 ? '' : 's'}${scope === 'all' ? ' (across the heritage closure)' : ''}:`)
                const CAP = 120
                for (const m of flat.slice(0, CAP)) push(line(m))
                if (flat.length > CAP) push(`  - …and ${flat.length - CAP} more`)
            }
            push()
        }
    }

    // Version gates — compatibility-version branches (case E). Scope-local first, else the landscape.
    if (S.versionGates !== 'none') {
        const scoped = Q.versionGatesByScope(db, name)
        const gates = scoped.length ? scoped : Q.versionGatesAll(db, F.breakpoint)
        if (gates.length) {
            push('## Version gates')
            if (!scoped.length) push(`Compatibility-version branches across the SqlBuilders${F.breakpoint ? ` (breakpoint ${F.breakpoint})` : ''}:`)
            const byBp = new Map<string, typeof gates>()
            for (const g of gates) { const l = byBp.get(g.breakpoint) ?? []; if (!l.length) byBp.set(g.breakpoint, l); l.push(g) }
            for (const [bp, list] of byBp) {
                push(`- breakpoint **${bp}** (${list.length}):`)
                for (const g of list.slice(0, S.versionGates === 'full' ? list.length : 12)) {
                    const sc = g.scope_name ? `\`${g.scope_name}\` ` : ''
                    push(`  - ${sc}${g.field} ${g.operator} ${g.breakpoint} — ${g.path}:${g.line}${block('scope', g.scope_start_line, g.scope_end_line)}`)
                }
                if (S.versionGates !== 'full' && list.length > 12) push(`  - …and ${list.length - 12} more`)
            }
            push()
        }
    }

    // 4. Where explained / reflected in the docs
    if (S.docs !== 'none') {
        let docs = Q.docHits(db, name).filter(d => d.dbs.split(',').some(x => coordDbMatchAny(x, F.coord)))
        if (F.fileNamePattern) docs = docs.filter(d => F.fileNamePattern!.test(d.page))
        if (docs.length) {
            push('## Explained in docs')
            if (S.docs === 'by-page') {
                const byPage = new Map<string, Q.DocHit[]>()
                for (const d of docs) { const l = byPage.get(d.page) ?? []; if (!l.length) byPage.set(d.page, l); l.push(d) }
                for (const [page, hits] of byPage) push(`- ${page} — ${hits.length} occurrence(s) [${[...new Set(hits.map(h => h.kind))].join(', ')}]`)
            } else {
                const cap = S.docs === 'full' ? docs.length : 20
                for (const d of docs.slice(0, cap)) {
                    const head = d.heading ? ` — "${d.heading}"` : ''
                    push(`- ${d.page}:${d.md_line}${block('snippet spans', d.block_start, d.block_end)}${head} [${d.kind}, ${d.dbs}]`)
                }
                if (docs.length > cap) push(`- …and ${docs.length - cap} more occurrences`)
            }
            push()
        }
    }

    // Simplified reconcile + member-in-def
    if (S.simplified !== 'none') {
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
        const inDef = Q.memberShownInSimplified(db, name).filter(h => coordDbMatchAny(h.db, F.coord))
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
    }

    // Emitted SQL — the SQL a symbol's tests/docs assert (cases C/D/F). Across two sources,
    // labelled by how each refreshes (test snapshots auto; docs are user-owned regen).
    if (S.emittedSql !== 'none') {
        const sqls = Q.emittedSqlForName(db, name).filter(r => {
            if (r.source === 'doc') return coordDbMatchAny(r.db, F.coord)   // doc cells are db-only
            const p = r.cell.split('/')   // 'db/version/connector' (test row)
            return coordMatchAny({ db: r.db, version: p[1] ?? '', connector: p[2] ?? '', file: r.file }, F.coord)
        })
        if (sqls.length) {
            push('## Emitted SQL (asserted snapshots)')
            // De-dup identical SQL strings; track which cells assert each.
            const bySql = new Map<string, { source: string, cells: Set<string> }>()
            for (const r of sqls) {
                const e = bySql.get(r.sql) ?? { source: r.source, cells: new Set() }
                e.cells.add(r.cell)
                bySql.set(r.sql, e)
            }
            const refresh = (src: string): string => src === 'doc' ? 'docs — user-owned, regen via codegen:doc-code' : 'tests — auto via --update-snapshots'
            const cap = S.emittedSql === 'full' ? bySql.size : 12
            let shown = 0
            for (const [sql, e] of bySql) {
                if (shown++ >= cap) { push(`- …and ${bySql.size - cap} more distinct snapshot(s)`); break }
                const cells = [...e.cells]
                const cellNote = cells.length <= 3 ? cells.join(', ') : `${cells.slice(0, 3).join(', ')} +${cells.length - 3}`
                push(`- \`${sql.length > 160 ? sql.slice(0, 160) + '…' : sql}\``)
                push(`  - ${e.cells.size} cell(s): ${cellNote} · ${refresh(e.source)}`)
            }
            push()
        }
    }

    // 5. Coverage — tests (summary / detail / gaps) + examples + negatives
    if (S.tests !== 'none') {
        renderTests(push, db, name, S.tests, F)
    }
    if (S.examples !== 'none') {
        // Legacy examples carry their cell (db/version/connector) in the filename, so --coord
        // matches them at the full-cell level (best-effort: the documentation/ generators have no
        // connector, so a coord with a connector segment skips them).
        const occ = Q.exampleOccurrences(db, name).filter(o => coordMatchAny(o, F.coord))
        if (occ.length) {
            const blocks = new Set(occ.map(o => o.example_block_id)).size
            push('## Legacy examples')
            push(`- ${occ.length} occurrence(s) across ${blocks} block(s)${F.coord.length ? ` (coord-filtered)` : ''}`)
            push()
        }
    }
    if (S.negTypes !== 'none') {
        const neg = Q.negCoverage(db, name).filter(r => coordDbMatchAny(r.db, F.coord))
        if (neg.length) {
            push('## Negative-type assertions')
            const total = neg.reduce((a, r) => a + r.assertions, 0)
            push(`- ${total} (${neg.map(r => `${r.db} ${r.assertions}`).join(', ')})`)
            if (S.negTypes === 'full') {
                // The actual rules — what an author needs to model a new @ts-expect-error lock on (H/I).
                const rows = Q.negAssertions(db, name).filter(r => coordDbMatchAny(r.db, F.coord))
                const cap = Math.min(rows.length, 40)
                for (const r of rows.slice(0, cap)) {
                    push(`  · ${r.file.replace(/^test\/db\//, '')}:${r.line} — ${r.description ?? '(no rule comment)'}`)
                    if (r.snippet) push(`      ${r.snippet.length > 100 ? r.snippet.slice(0, 97) + '…' : r.snippet}`)
                }
                if (rows.length > cap) push(`  · …and ${rows.length - cap} more`)
            }
            push()
        }
    }

    // Known divergences — // TODO[BUG] markers mentioning the name (case C/D/F).
    if (S.bugs !== 'none') {
        const markers = Q.todoMarkersMatching(db, name, 'BUG')
        if (markers.length) {
            push('## Known divergences (// TODO[BUG])')
            const cap = S.bugs === 'full' ? markers.length : 15
            for (const m of markers.slice(0, cap)) push(`- ${m.file}:${m.line} — ${m.text}`)
            if (markers.length > cap) push(`- …and ${markers.length - cap} more`)
            push('_(test/BUGS.md is the full channel — read it directly; it is normally short.)_')
            push()
        }
    }

    // Known limitations — // TODO[LIMITATION] markers mentioning the name.
    if (S.limitation !== 'none') {
        const markers = Q.todoMarkersMatching(db, name, 'LIMITATION')
        if (markers.length) {
            push('## Known limitations (// TODO[LIMITATION])')
            const cap = S.limitation === 'full' ? markers.length : 15
            for (const m of markers.slice(0, cap)) push(`- ${m.file}:${m.line} — ${m.text}`)
            if (markers.length > cap) push(`- …and ${markers.length - cap} more`)
            push('_(test/LIMITATIONS.md is the full channel — read it directly.)_')
            push()
        }
    }

    // Dialect boundaries — // NOT-APPLICABLE markers mentioning the name. A DIFFERENT category from a
    // limitation: permanent, nothing pending, and the same test runs+validates in the cells whose dialect
    // supports it (usually with a types.negative/ counterpart here). Distinct section, never merged into
    // limitations — so an agent doesn't mistake a deliberate dialect boundary for actionable debt.
    if (S.notApplicable !== 'none') {
        const markers = Q.todoMarkersMatching(db, name, 'NOT-APPLICABLE')
        if (markers.length) {
            push('## Dialect boundaries (// NOT-APPLICABLE)')
            const cap = S.notApplicable === 'full' ? markers.length : 15
            for (const m of markers.slice(0, cap)) push(`- ${m.file}:${m.line} — ${m.text}`)
            if (markers.length > cap) push(`- …and ${markers.length - cap} more`)
            push('_(permanent — not a bug or a missing feature; the test runs in the cells whose dialect supports it.)_')
            push()
        }
    }

    // Cell caveats — TODO[BUG]/TODO[LIMITATION] declared on cells (case G). COORD-scoped and NOT
    // filtered by the searched symbol: a wave/propagation can be invalidated by a caveat on the target
    // CELL (e.g. MariaDB UPDATE…RETURNING needs 13.0.1+), which name-filtered --bugs/--limitation miss.
    // The LEVEL is the view, --coord only filters which cells appear (it never changes the view):
    //   summary → the per-cell MAP (each cell + its caveat counts);  full → the MARKERS, cell-prefixed.
    if (S.cellCaveats !== 'none') {
        const scoped = Q.caveatMarkers(db)
            .map(m => ({ ...m, cell: cellFromPath(m.file) }))
            .filter((m): m is typeof m & { cell: CellLike } => !!m.cell && coordMatchAny(m.cell, F.coord))
        const cellKey = (c: CellLike): string => `${c.db}/${c.version}/${c.connector}`
        const matrix = F.coord.length ? '' : ' (whole matrix)'
        if (scoped.length && S.cellCaveats === 'summary') {
            // summary = the per-cell MAP: which cells carry caveats + counts (one entry = one cell). The
            // three categories are counted SEPARATELY (NOT-APPLICABLE is never folded into LIMITATION).
            push(`## Cell caveats — per-cell map${matrix}`)
            const byCell = new Map<string, { bug: number, lim: number, na: number }>()
            for (const m of scoped) {
                const k = cellKey(m.cell)
                let c = byCell.get(k)
                if (!c) { c = { bug: 0, lim: 0, na: 0 }; byCell.set(k, c) }
                if (m.tag === 'BUG') c.bug++
                else if (m.tag === 'NOT-APPLICABLE') c.na++
                else c.lim++
            }
            const total = (c: { bug: number, lim: number, na: number }): number => c.bug + c.lim + c.na
            const cells = [...byCell.entries()].sort((a, b) => total(b[1]) - total(a[1]))
            const cap = Math.min(cells.length, 40)
            for (const [k, c] of cells.slice(0, cap)) {
                const parts = [c.bug ? `${c.bug} BUG` : '', c.lim ? `${c.lim} LIMITATION` : '', c.na ? `${c.na} NOT-APPLICABLE` : ''].filter(Boolean).join(', ')
                push(`- ${k} — ${total(c)} (${parts})`)
            }
            if (cells.length > cap) push(`- …and ${cells.length - cap} more cells`)
            push('_(counts per cell, not by symbol; `--cell-caveats full` shows the markers — narrow with `--coord` first.)_')
            push()
        } else if (scoped.length) {
            // full = the MARKERS, each prefixed with its cell (one entry = one marker). The [TAG] keeps the
            // three categories distinct — `[NOT-APPLICABLE]` is a permanent dialect boundary, not debt.
            push(`## Cell caveats — markers${matrix}`)
            const sorted = [...scoped].sort((a, b) => cellKey(a.cell).localeCompare(cellKey(b.cell)) || a.line - b.line)
            const cap = Math.min(sorted.length, 60)
            for (const m of sorted.slice(0, cap)) {
                const text = m.text.length > 140 ? m.text.slice(0, 137) + '…' : m.text
                push(`- ${cellKey(m.cell)} · [${m.tag}] ${m.file.split('/').pop()}:${m.line} — ${text}`)
            }
            if (sorted.length > cap) push(`- …and ${sorted.length - cap} more markers`)
            push('_(caveats apply to the CELL, not your symbol. BUG→test/BUGS.md · LIMITATION→test/LIMITATIONS.md · NOT-APPLICABLE = permanent dialect boundary.)_')
            push()
        }
    }

    // 6. Search — NAME strategy (name-based discovery; ignores the call-chain).
    if (S.nameSearch !== 'none') {
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

// ── chain section (strict | broad | full) ────────────────────────────────────
function renderChain(push: (s?: string) => void, db: QueryDb, name: string, level: ChainLevel, resolved: boolean): void {
    const broad = level === 'broad' || level === 'full'
    const chain = Q.callChain(db, name, broad, resolved)
    push(`## Search: chain-${level} (call-chain${resolved ? '' : ', name-based — index is --no-resolve'})`)
    if (!chain.hops.length) {
        push(`No recorded callers reach \`${name}\`.`)
        push()
        return
    }
    if (level === 'full') {
        // The WHOLE internal stack — every hop, grouped by depth (not just public callers).
        push('Full call stack — every recorded hop up from the seed, by depth:')
        const byDepth = new Map<number, Q.ChainHop[]>()
        for (const h of chain.hops) { const l = byDepth.get(h.depth) ?? []; if (!l.length) byDepth.set(h.depth, l); l.push(h) }
        const seen = new Set<string>()
        for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
            push(`- depth ${depth}:`)
            for (const h of byDepth.get(depth)!) {
                const key = `${h.caller}@${h.path}:${h.call_line}`
                if (seen.has(key)) continue
                seen.add(key)
                const pub = h.is_public_hop ? ' [public]' : ''
                push(`  - \`${h.caller}\`${pub} (${h.area}) invokes \`${h.callee}\` at ${h.path}:${h.call_line}${block('caller body', h.caller_start_line, h.caller_end_line)}`)
            }
        }
        if (chain.truncated) push(`\n_(call graph truncated — too many edges; narrow the seed.)_`)
        push()
        return
    }
    // strict / broad: public callers grouped by area + direct callers.
    const publicHops = dedupPublicHops(chain.hops)
    if (publicHops.length) {
        push('Public API reached (public callers that reach it, grouped by area):')
        const byArea = new Map<string, Q.ChainHop[]>()
        for (const h of publicHops) { const l = byArea.get(h.area) ?? []; if (!l.length) byArea.set(h.area, l); l.push(h) }
        for (const [area, hs] of [...byArea].sort((a, b) => b[1].length - a[1].length)) {
            push(`- **${area}** (${hs.length}):`)
            for (const h of hs.slice(0, 8)) {
                push(`  - \`${h.caller}\` invokes \`${h.callee}\` at ${h.path}:${h.call_line}${block('caller body', h.caller_start_line, h.caller_end_line)}`)
            }
            if (hs.length > 8) push(`  - …and ${hs.length - 8} more in ${area}`)
        }
    } else {
        push(`No public caller reached within ${chain.hops.length} edge(s). ${broad ? '' : 'Try `--chain broad` or `--chain full`.'}`)
    }
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

// ── tests section (summary | detail | gaps) ──────────────────────────────────
// Every test row passes the same gate: the global axis filters (db/version/connector),
// the --coord matrix patterns, and the test-name / file-name regexes. All three levels
// derive from the SAME filtered detail rows, so the filters apply uniformly.
function testRowMatches(r: Q.TestDetailRow, F: Filters): boolean {
    if (!coordMatchAny(r, F.coord)) return false
    if (F.testNamePattern && !F.testNamePattern.test(r.name)) return false
    if (F.fileNamePattern && !F.fileNamePattern.test(r.file)) return false
    return true
}

function renderTests(push: (s?: string) => void, db: QueryDb, name: string, level: TestsLevel, F: Filters): void {
    const rows = Q.testCoverageDetail(db, name).filter(r => testRowMatches(r, F))

    if (level === 'summary') {
        if (!rows.length) return
        const byDb = new Map<string, { total: number, newest: number }>()
        for (const r of rows) {
            const e = byDb.get(r.db) ?? { total: 0, newest: 0 }
            e.total++; if (r.version === 'newest') e.newest++
            byDb.set(r.db, e)
        }
        const total = rows.length, newest = rows.filter(r => r.version === 'newest').length
        push('## Coverage')
        push(`- matrix tests: ${total} total, ${newest} on newest — by db as newest/total: ${[...byDb].map(([d, c]) => `${d} ${c.newest}/${c.total}`).join(', ')}`)
        push()
        return
    }
    if (level === 'detail') {
        push('## Coverage — per-test detail')
        if (!rows.length) { push('No matrix tests match the filters.'); push(); return }
        const byFile = new Map<string, Q.TestDetailRow[]>()
        for (const r of rows) { const l = byFile.get(r.file) ?? []; if (!l.length) byFile.set(r.file, l); l.push(r) }
        let shown = 0
        for (const [file, list] of byFile) {
            if (shown >= 60) { push(`- …and ${rows.length - shown} more tests`); break }
            const cell = `${list[0]!.db}/${list[0]!.version}/${list[0]!.connector}`
            push(`- ${file}  (cell ${cell}, ${list.length} test(s))`)
            for (const r of list) {
                push(`  - "${r.name}"  L${r.start_line}${r.is_active ? '' : '  [skip/todo]'}`)
                shown++
            }
        }
        push()
        return
    }
    // gaps: per db, which newest connectors are MISSING the name. The full newest matrix
    // is filtered by the same global + coord cell filters (version pinned to newest here).
    const all = Q.newestConnectorsByDb(db).filter(c => coordMatchAny({ db: c.db, version: 'newest', connector: c.connector }, F.coord))
    const have = new Set(rows.filter(r => r.version === 'newest').map(r => `${r.db}/${r.connector}`))
    const byDb = new Map<string, string[]>()
    for (const c of all) { const l = byDb.get(c.db) ?? []; if (!l.length) byDb.set(c.db, l); l.push(c.connector) }
    push('## Coverage — gaps per db (newest cells)')
    for (const [dbName, connectors] of byDb) {
        const marks = connectors.map(c => `${c} ${have.has(`${dbName}/${c}`) ? '✓' : '✗'}`)
        const missing = connectors.filter(c => !have.has(`${dbName}/${c}`))
        const tag = missing.length === 0 ? 'ok' : missing.length === connectors.length ? '**MISSING entirely**' : `add to ${missing.length}`
        push(`- ${dbName}: ${marks.join('  ')}  → ${tag}`)
    }
    push()
}
