// Reconcile the hand-maintained SIMPLIFIED definitions the docs render with the REAL code,
// so the simplified defs are discoverable from the query-building world and drift in the
// hand-maintained map is detectable. Each of the THREE simplified sources is reconciled and
// tagged with `source`, so a search can distinguish WHERE a def is shown:
//
//   - source='master'      — `simplifiedQueryDefinition.ts` (the complete hand-maintained map).
//                            Pass 1 CLASS-SUBTREE (the collapsing query defs: `SelectExpression`
//                            collapses 40+ real interfaces, so a curated SIMPLIFIED_TO_ROOT maps
//                            it to the ROOT class and we expand the whole descendant subtree —
//                            union coverage — and emit synthesised `heritage` edges
//                            (`simplified=1`) so the def shows up as "another implemented
//                            interface"). Pass 2 NAME (the rest, name-matched to a real symbol).
//   - source='doc'         — `simplifiedDefinition.generated.test.ts` (the full reassembly of the
//                            doc pages). EVERY def it shows (incl. ones also in the master, like
//                            SelectExpression) gets a per-source row + the doc-only additions
//                            (TsSqlError ecosystem, query-runner config, filters).
//   - source='doc-inquery' — `simplifiedDefinitionInQuery.generated.test.ts` (the SUBSET extracts
//                            that show only the methods relevant to a query). partial=1: its
//                            `missing` is by design, not drift.
//
// Heritage `simplified=1` edges are emitted ONCE (master pass 1) — the def NAME is the bridge,
// shared across sources. `reconcile` rows carry the member diff (missing = real has, source
// lacks; extra = source shows, real lacks → drift); `reconcile_gap` the member names, also
// tagged by `source`. The def→doc-location anchor is `doc_test_block.simplified_def`.

import ts from 'typescript'
import { resolve } from 'node:path'
import type { SrcExtract } from './extractSrc.js'
import type { HeritageRow, ReconcileRow, ReconcileGapRow, ReconcileSource, SymbolRow } from './model.js'

// The two generated decl cells: the full reassembly + the in-query SUBSET extracts.
const GENERATED_SIMPLIFIED = 'test/db/general/newest/documentation/simplifiedDefinition.generated.test.ts'
const GENERATED_SIMPLIFIED_INQUERY = 'test/db/general/newest/documentation/simplifiedDefinitionInQuery.generated.test.ts'

// A real, comparable member name: not a `_`-internal. (The `makeCompilerHappy_*`
// phantom-type placeholders are no longer reachable — they live OUTSIDE the master's
// and the generated cells' BEGIN/END regions, which the extractors now honour.)
const isCleanMember = (name: string): boolean => !name.startsWith('_')

// Top-level interface/class declarations in a generated cell → their own public member
// names (restricted to its BEGIN/END regions, the part that comes from the .md). Reads the
// COMPILED cell from the unified Program (no isolated parse). Returns empty if not generated.
function parseGeneratedDecls(program: ts.Program, cellPath: string): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>()
    const sf = program.getSourceFile(resolve(cellPath))
    if (!sf) return out
    const text = sf.text
    // ONLY the code between `// BEGIN … // END` comes from the .md (the simplified defs); the
    // rest is test scaffolding. Collect those 1-based line ranges and keep decls inside them.
    const lines = text.split('\n')
    const regions: Array<[number, number]> = []
    let begin = -1
    for (let i = 0; i < lines.length; i++) {
        if (/^\/\/ BEGIN /.test(lines[i]!)) begin = i + 1
        else if (begin > 0 && /^\/\/ END /.test(lines[i]!)) { regions.push([begin, i + 1]); begin = -1 }
    }
    const inRegion = (line: number): boolean => regions.some(([a, b]) => line > a && line < b)
    // The decl snippets are emitted nested inside the cell (not all top-level), so recurse.
    const visit = (node: ts.Node): void => {
        const decl = ts.isInterfaceDeclaration(node) ? node : (ts.isClassDeclaration(node) && node.name ? node : null)
        if (decl && inRegion(sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line + 1)) {
            const members = out.get(decl.name!.text) ?? new Set<string>()
            for (const m of decl.members) {
                const n = m.name
                if (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) && isCleanMember(n.text)) members.add(n.text)
            }
            out.set(decl.name!.text, members)
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)
    return out
}

// Curated: simplified def name → the ROOT class of the subtree that implements it. The
// tool expands DOWN to the root + ALL its descendant classes, so coverage is the UNION of
// the whole chain — members spread over deeper/specific classes (Connection's are split
// across the per-db connections) stay discoverable WITHOUT hardcoding the leaves; a new
// subclass is picked up automatically.
//
// Pick the topmost OPERATION-SPECIFIC class: the abstract base where one exists
// (`AbstractSelect`, `AbstractConnection`), else the concrete builder (Insert/Update/Delete
// only extend the UNIVERSAL `AbstractQueryBuilder` — rooting there would bleed into the
// other operations, so root at the builder itself). Collapsed/structural defs only; the
// `*ValueSource` hierarchy is intentionally NOT here (already name-matches its real
// interfaces; `ValueSourceImpl` implements them all, too broad for a per-type diff).
export const SIMPLIFIED_TO_ROOT: Record<string, string> = {
    SelectExpression: 'AbstractSelect',          // → SelectQueryBuilder, CompoundSelectQueryBuilder
    InsertExpression: 'InsertQueryBuilder',
    UpdateExpression: 'UpdateQueryBuilder',
    DeleteExpression: 'DeleteQueryBuilder',
    Connection: 'AbstractConnection',            // → AbstractAdvancedConnection + every per-db connection
    FragmentExpression: 'FragmentQueryBuilder',
    Sequence: 'SequenceQueryBuilder',
    DynamicConditionExpression: 'DynamicConditionBuilder',
    Table: 'Table',
    View: 'View',
    Values: 'Values',
}

export interface ReconcileResult {
    heritage: HeritageRow[]
    reconcile: ReconcileRow[]
    gaps: ReconcileGapRow[]
}

// Public, named members only — exclude `_`-prefixed internals and the construct/call/
// index signature placeholders (member.name = '[construct]' etc.), which aren't methods.
const NAMED_KINDS = new Set(['method', 'property', 'getter', 'setter'])
const isPublicMember = (name: string, kind: string): boolean => isCleanMember(name) && NAMED_KINDS.has(kind)

export function reconcileSimplified(src: SrcExtract, program: ts.Program): ReconcileResult {
    const heritage: HeritageRow[] = []
    const reconcile: ReconcileRow[] = []
    const gaps: ReconcileGapRow[] = []

    const areaOfModule = new Map<number, string>()
    for (const m of src.modules) areaOfModule.set(m.id, m.area)
    const isSimplified = (s: SymbolRow): boolean => areaOfModule.get(s.module_id) === 'simplified'

    const byName = new Map<string, SymbolRow[]>()
    for (const s of src.symbols) {
        const a = byName.get(s.name); if (a) a.push(s); else byName.set(s.name, [s])
    }
    const membersOf = new Map<number, Set<string>>()
    for (const m of src.members) {
        if (!isPublicMember(m.name, m.kind)) continue
        const set = membersOf.get(m.symbol_id); if (set) set.add(m.name); else membersOf.set(m.symbol_id, new Set([m.name]))
    }
    const nameOfId = new Map<number, string>()
    const kindOfId = new Map<number, string>()
    for (const s of src.symbols) { nameOfId.set(s.id, s.name); kindOfId.set(s.id, s.kind) }
    // name → base names, from REAL heritage only (a synthesised/commented edge mustn't feed the closure).
    const basesOf = new Map<string, Set<string>>()
    // parent class name → child CLASS names (downward `extends` edges) — to expand a subtree.
    const childrenOf = new Map<string, string[]>()
    for (const h of src.heritage) {
        if (h.commented || h.simplified) continue
        const child = nameOfId.get(h.symbol_id); if (!child) continue
        const set = basesOf.get(child); if (set) set.add(h.base_name); else basesOf.set(child, new Set([h.base_name]))
        if (h.relation === 'extends' && kindOfId.get(h.symbol_id) === 'class') {
            const arr = childrenOf.get(h.base_name); if (arr) arr.push(child); else childrenOf.set(h.base_name, [child])
        }
    }

    // The root class + ALL its descendant LIBRARY classes (downward closure over `extends`).
    // Example/user subclasses (src/examples — a docs' `Connection extends PostgreSqlConnection`
    // with its own methods) are EXCLUDED: they'd pollute the diff with user API.
    const isLibraryClass = (s: SymbolRow): boolean => {
        const a = areaOfModule.get(s.module_id)
        return s.kind === 'class' && a !== 'simplified' && a !== 'examples'
    }
    const subtreeClasses = (root: string): SymbolRow[] => {
        const out: SymbolRow[] = []; const seen = new Set<string>(); const stack = [root]
        while (stack.length) {
            const n = stack.pop()!; if (seen.has(n)) continue; seen.add(n)
            const cls = (byName.get(n) ?? []).find(isLibraryClass)
            if (cls) out.push(cls)
            for (const c of childrenOf.get(n) ?? []) if (!seen.has(c)) stack.push(c)
        }
        return out
    }

    // Reachable public member NAMES from a symbol name (closure over implements+extends).
    // `wantSimplified` selects whether members come from the simplified copy or the real
    // one when a name exists in both worlds — the base-name walk is shared, the filter is
    // applied at member collection.
    const reachable = (start: string, wantSimplified: boolean): Set<string> => {
        const out = new Set<string>(); const seen = new Set<string>(); const stack = [start]
        while (stack.length) {
            const n = stack.pop()!; if (seen.has(n)) continue; seen.add(n)
            for (const s of byName.get(n) ?? []) {
                if (isSimplified(s) !== wantSimplified) continue
                for (const mm of membersOf.get(s.id) ?? []) out.add(mm)
            }
            for (const b of basesOf.get(n) ?? []) if (!seen.has(b)) stack.push(b)
        }
        return out
    }

    // real symbol's OWN public members by name (for pass 3, doc-only additions are self-contained).
    const realOwnByName = new Map<string, Set<string>>()
    for (const s of src.symbols) {
        if (isSimplified(s) || (s.kind !== 'interface' && s.kind !== 'class')) continue
        const set = realOwnByName.get(s.name) ?? new Set<string>()
        for (const m of membersOf.get(s.id) ?? []) set.add(m)
        realOwnByName.set(s.name, set)
    }

    const emit = (name: string, via: ReconcileRow['via'], source: ReconcileSource, simp: Set<string>, real: Set<string>, partial: 0 | 1): void => {
        const missing = [...real].filter(m => !simp.has(m)).sort()
        const extra = [...simp].filter(m => !real.has(m)).sort()
        reconcile.push({ simplified_name: name, via, source, partial, simplified_members: simp.size, real_members: real.size, missing_in_simplified: missing.length, extra_in_simplified: extra.length })
        // For a partial source the `missing` list is the WHOLE rest of the def (by design) — keep
        // it out of the gap detail; `extra` (shown but not real) is still a genuine error signal.
        if (!partial) for (const m of missing) gaps.push({ simplified_name: name, member_name: m, side: 'missing_in_simplified', source })
        for (const m of extra) gaps.push({ simplified_name: name, member_name: m, side: 'extra_in_simplified', source })
    }

    // The real-side member set + `via` for a simplified def name — shared by the master passes
    // and the generated-cell passes so the same name reconciles consistently across sources.
    //   class : a collapsing query def (SIMPLIFIED_TO_ROOT) → union over the root's whole subtree.
    //   name  : a real same-name interface/class → its reachable closure (defs ALSO in the master)
    //           or its OWN members (doc-only additions like TsSqlError — self-contained).
    const realFor = (name: string): { via: ReconcileRow['via'], real: Set<string> } | null => {
        const root = SIMPLIFIED_TO_ROOT[name]
        if (root) {
            const classes = subtreeClasses(root)
            if (classes.length) {
                const real = new Set<string>()
                for (const c of classes) for (const m of reachable(c.name, false)) real.add(m)
                return { via: 'class', real }
            }
        }
        const hasRealType = (byName.get(name) ?? []).some(x => !isSimplified(x) && (x.kind === 'interface' || x.kind === 'class'))
        if (!hasRealType) return null
        const isInMaster = (byName.get(name) ?? []).some(isSimplified)
        return { via: 'name', real: isInMaster ? reachable(name, false) : (realOwnByName.get(name) ?? new Set<string>()) }
    }

    // ── source='master' ──────────────────────────────────────────────────────
    const done = new Set<string>()   // master uniqueness only (pass 1 → pass 2)

    // Pass 1 — CLASS-SUBTREE (the collapsing query defs): root + whole descendant subtree,
    // union coverage, + synthesised heritage edges (discoverability — the def NAME bridge).
    for (const [simpName, root] of Object.entries(SIMPLIFIED_TO_ROOT)) {
        if (!(byName.get(simpName) ?? []).some(isSimplified)) continue
        const classes = subtreeClasses(root)
        if (!classes.length) continue   // root not found → curate the table
        const simp = reachable(simpName, true)
        const real = new Set<string>()
        for (const c of classes) for (const m of reachable(c.name, false)) real.add(m)
        for (const c of classes) heritage.push({ symbol_id: c.id, base_name: simpName, relation: 'implements', commented: 0, simplified: 1 })
        emit(simpName, 'class', 'master', simp, real, 0)
        done.add(simpName)
    }

    // Pass 2 — NAME (master): the rest of simplifiedQueryDefinition.ts whose name matches a
    // real interface/class. Already name-discoverable, so just the member diff.
    for (const s of src.symbols) {
        if (!isSimplified(s) || (s.kind !== 'interface' && s.kind !== 'class') || done.has(s.name)) continue
        if (!(byName.get(s.name) ?? []).some(x => !isSimplified(x) && (x.kind === 'interface' || x.kind === 'class'))) continue
        const simp = reachable(s.name, true)
        const real = reachable(s.name, false)
        if (simp.size || real.size) { emit(s.name, 'name', 'master', simp, real, 0); done.add(s.name) }
    }

    // ── source='doc' / 'doc-inquery' ─────────────────────────────────────────
    // EVERY def each generated cell shows gets its own per-source row (no `done` gating — the
    // point is to record presence per source). simplified_members = what THAT cell shows
    // (the in-query subset shows fewer → its `missing` is expected, partial=1).
    const cells: { path: string, source: ReconcileSource, partial: 0 | 1 }[] = [
        { path: GENERATED_SIMPLIFIED, source: 'doc', partial: 0 },
        { path: GENERATED_SIMPLIFIED_INQUERY, source: 'doc-inquery', partial: 1 },
    ]
    for (const cell of cells) {
        for (const [name, docMembers] of parseGeneratedDecls(program, cell.path)) {
            const rf = realFor(name)
            if (!rf || (!docMembers.size && !rf.real.size)) continue   // no real counterpart → skip
            emit(name, rf.via, cell.source, docMembers, rf.real, cell.partial)
        }
    }

    return { heritage, reconcile, gaps }
}
