// The query layer of the code searcher: one function per question the searcher
// answers, mapping the validated recipes in DESIGN.md §10 (R1–R8) to typed reads
// over the index. Nothing here renders — callers in render.ts shape the output.
//
// All reads go through QueryDb (read-only). Parameters are bound, never
// interpolated, so a symbol name with odd characters is safe.

import type { QueryDb } from '../codeIndexer/db.js'

// ── input resolution: pattern (regex) + location (path:line → enclosing function) ──

// Every declared NAME with a location + visibility, for `--search-pattern` (filtered by a
// JS regex in the caller — SQLite has no portable regex). Symbols + members in one list.
// `decl_kind`/`abstract` describe the DECLARING type (for a member: its owner; for a
// symbol: itself), so a caller can prefer a sample on an implementation class — best if
// abstract — over an interface.
export interface NameRow { name: string, src: 'symbol' | 'member', kind: string, decl_kind: string, abstract: number, path: string, line: number, vis: string }
export function nameIndex(db: QueryDb): NameRow[] {
    const syms = db.all<NameRow>(
        `SELECT s.name, 'symbol' AS src, s.kind, s.kind AS decl_kind, s.is_abstract AS abstract, m.path, s.start_line AS line,
                (CASE WHEN s.is_public THEN 'public' WHEN s.is_public_surface THEN 'public-surface' ELSE 'internal' END) AS vis
         FROM symbol s JOIN module m ON m.id=s.module_id`,
    )
    const mems = db.all<NameRow>(
        `SELECT mb.name, 'member' AS src, mb.kind, s.kind AS decl_kind, s.is_abstract AS abstract, m.path, mb.start_line AS line, mb.visibility AS vis
         FROM member mb JOIN symbol s ON s.id=mb.symbol_id JOIN module m ON m.id=s.module_id`,
    )
    return syms.concat(mems)
}

// The INNERMOST declared element whose span contains `line` in the module at `path` — the
// function/method (or symbol) that encloses that source line, for `--search-location`.
export interface Enclosing { name: string, kind: string, owner: string | null, path: string, start_line: number, end_line: number }
export function enclosingAt(db: QueryDb, path: string, line: number): Enclosing | null {
    const [row] = db.all<Enclosing>(
        `SELECT name, kind, owner, path, start_line, end_line FROM (
            SELECT mb.name AS name, mb.kind AS kind, s.name AS owner, m.path AS path,
                   mb.start_line AS start_line, mb.end_line AS end_line, (mb.end_line - mb.start_line) AS span
            FROM member mb JOIN symbol s ON s.id=mb.symbol_id JOIN module m ON m.id=s.module_id
            WHERE m.path=? AND mb.start_line<=? AND mb.end_line>=?
            UNION ALL
            SELECT s.name, s.kind, NULL, m.path, s.start_line, s.end_line, (s.end_line - s.start_line) AS span
            FROM symbol s JOIN module m ON m.id=s.module_id
            WHERE m.path=? AND s.start_line<=? AND s.end_line>=?
         ) ORDER BY span ASC LIMIT 1`,
        [path, line, line, path, line, line],
    )
    return row ?? null
}

// ── R1: existence + classification ───────────────────────────────────────────
export interface Existence {
    in_simplified: number   // members with this name on a simplified-map def
    public_sym: number      // top-level exported symbols with this name
    any_sym: number         // any symbol (public or internal) with this name
    any_member: number      // any member with this name
}

export function existence(db: QueryDb, name: string): Existence {
    const [row] = db.all<Existence>(
        `SELECT
           (SELECT count(*) FROM member mb JOIN symbol sy ON sy.id=mb.symbol_id
              JOIN module m ON m.id=sy.module_id
              WHERE m.area='simplified' AND mb.name=?)        AS in_simplified,
           (SELECT count(*) FROM symbol WHERE name=? AND is_public=1) AS public_sym,
           (SELECT count(*) FROM symbol WHERE name=?)         AS any_sym,
           (SELECT count(*) FROM member WHERE name=?)         AS any_member`,
        [name, name, name, name],
    )
    return row ?? { in_simplified: 0, public_sym: 0, any_sym: 0, any_member: 0 }
}

export interface SymbolHit {
    name: string
    kind: string
    is_public: number          // directly importable through package exports
    is_public_surface: number  // part of the public surface (importable OR fluent-API/simplified interface)
    is_exported: number
    path: string
    area: string
    export_subpath: string | null
    start_line: number
    start_col: number
    end_line: number       // enclosing scope: the symbol declaration spans start_line..end_line
    jsdoc: string | null
}

export function symbols(db: QueryDb, name: string): SymbolHit[] {
    return db.all<SymbolHit>(
        `SELECT s.name, s.kind, s.is_public, s.is_public_surface, s.is_exported, m.path, m.area,
                m.export_subpath, s.start_line, s.start_col, s.end_line, s.jsdoc
         FROM symbol s JOIN module m ON m.id=s.module_id
         WHERE s.name=? ORDER BY s.is_public_surface DESC, s.is_public DESC, m.area, m.path`,
        [name],
    )
}

export interface MemberHit {
    name: string
    kind: string
    visibility: string        // public | public_impl | internal (materialised in the index)
    is_implementation: number // 1 = the impl declaration (has a body); 0 = an overload/interface signature
    signature: string | null
    jsdoc: string | null
    owner: string
    owner_kind: string
    area: string
    path: string
    start_line: number
    start_col: number
    end_line: number       // enclosing scope: the member declaration spans start_line..end_line
}

export function members(db: QueryDb, name: string): MemberHit[] {
    return db.all<MemberHit>(
        `SELECT mb.name, mb.kind, mb.visibility, mb.is_implementation, mb.signature, mb.jsdoc,
                s.name AS owner, s.kind AS owner_kind,
                m.area, m.path, mb.start_line, mb.start_col, mb.end_line
         FROM member mb JOIN symbol s ON s.id=mb.symbol_id JOIN module m ON m.id=s.module_id
         WHERE mb.name=?
         ORDER BY (mb.visibility='public') DESC, (m.area='simplified') DESC, m.area, s.name`,
        [name],
    )
}

// The PUBLIC-SURFACE interfaces declaring `memberName` — the contracts that expose it,
// for the "exposed by X, Y" detail. (The public/internal verdict itself is materialised
// on member.visibility; this just names the interfaces.) A public interface is one with
// is_public_surface=1 and kind='interface'.
export interface PublicIface { owner: string, area: string }
export function publicInterfacesDeclaring(db: QueryDb, memberName: string): PublicIface[] {
    return db.all<PublicIface>(
        `SELECT DISTINCT s.name AS owner, m.area
         FROM member mb JOIN symbol s ON s.id=mb.symbol_id JOIN module m ON m.id=s.module_id
         WHERE mb.name=? AND s.kind='interface' AND s.is_public_surface=1
         ORDER BY (m.area='simplified') DESC, s.name`,
        [memberName],
    )
}

// ── R4 + §9.2: interface → implementing class bridge ─────────────────────────
// For each CLASS implementing an interface that declares `memberName`: the class
// location + span, and WHERE that class implements the member itself (impl_* — null
// when it inherits the implementation from a base class). So the agent gets the exact
// implementation site without a second search.
export interface ImplHit {
    cls: string
    path: string
    class_start: number
    class_end: number
    impl_start: number | null   // this class's own declaration of the member (null = inherited)
    impl_end: number | null
}
export function implementedBy(db: QueryDb, memberName: string): ImplHit[] {
    return db.all<ImplHit>(
        `SELECT DISTINCT cls.name AS cls, cm.path AS path,
                cls.start_line AS class_start, cls.end_line AS class_end,
                impl.start_line AS impl_start, impl.end_line AS impl_end
         FROM member mb
         JOIN symbol iface ON iface.id=mb.symbol_id AND iface.kind='interface'
         JOIN heritage h   ON h.base_name=iface.name AND h.relation='implements' AND h.commented=0
         JOIN symbol cls   ON cls.id=h.symbol_id AND cls.kind='class'
         JOIN module cm    ON cm.id=cls.module_id
         LEFT JOIN member impl ON impl.symbol_id=cls.id AND impl.name=mb.name
         WHERE mb.name=? ORDER BY cls.name`,
        [memberName],
    )
}

// The simplified-map defs that declare `memberName`, with their location (the curated
// public contract the implementing classes realize).
export interface DefLoc { name: string, path: string, start_line: number, end_line: number }
export function simplifiedDefsDeclaring(db: QueryDb, memberName: string): DefLoc[] {
    return db.all<DefLoc>(
        `SELECT DISTINCT s.name, m.path, s.start_line, s.end_line
         FROM member mb JOIN symbol s ON s.id=mb.symbol_id JOIN module m ON m.id=s.module_id
         WHERE mb.name=? AND m.area='simplified' ORDER BY s.name`,
        [memberName],
    )
}

// ── R5 + §9.1/§5: call-chain reconstruction (PRECISE), iterative BFS upward ──
// Walk the invocation graph from the seed callee upward, keeping module context.
// strict (default): stop climbing a branch as soon as it reaches the public
// queryBuilders layer (record that hop). broad: keep climbing the whole graph.
export interface ChainHop {
    callee: string          // the name being called at this edge
    caller: string          // the enclosing scope that calls it
    caller_kind: string
    area: string            // module area of the caller (queryBuilders | connections | expressions | …) — for classifying the public entry point
    path: string
    call_line: number       // the EXACT line where `caller` invokes `callee`
    call_col: number
    caller_start_line: number | null   // the caller's body span (open this to read the calling function)
    caller_end_line: number | null
    depth: number           // hops away from the seed
    is_public_hop: number   // 1 when the CALLER is itself public (a public/public_impl member, or a public-surface symbol) — a public entry point, in ANY area
}

const CHAIN_MAX_DEPTH = 8
const CHAIN_MAX_EDGES = 400

export interface ChainResult {
    hops: ChainHop[]
    truncated: boolean
}

// The chain is PRECISE when the index is resolved: it walks the checker-resolved callee edges
// (`resolved_member_id` for method calls, `resolved_symbol_id` for call/new) and keys `visited` by the
// caller's resolved ID, so two distinct methods that share a name never collapse into one node. Under a
// `--no-resolve` index those FKs are NULL, so it relaxes to the name-based walk. The chain LEVEL
// (strict/broad/full) is orthogonal — it controls depth/stopping, not precision.
export function callChain(db: QueryDb, seed: string, broad: boolean, resolved: boolean): ChainResult {
    return resolved ? callChainResolved(db, seed, broad) : callChainByName(db, seed, broad)
}

// The caller scope of an invocation, resolved to its declaration ID (member or top-level symbol) by
// (module, name, span-start). ~98% of caller scopes map; the rest (arrow/anonymous scopes with no
// declMap row) return null → the precise walk records the hop but does not climb past them.
interface ScopeRef { kind: 'm' | 's', id: number, isPublic: boolean }
function scopeIdResolver(db: QueryDb): (moduleId: number, name: string, startLine: number) => ScopeRef | null {
    const cache = new Map<string, ScopeRef | null>()
    return (moduleId, name, startLine) => {
        const key = `${moduleId}:${startLine}:${name}`
        const hit = cache.get(key)
        if (hit !== undefined) return hit
        let res: ScopeRef | null = null
        const [mb] = db.all<{ id: number, visibility: string }>(
            `SELECT mb.id, mb.visibility FROM member mb JOIN symbol s ON s.id=mb.symbol_id
             WHERE s.module_id=? AND mb.start_line=? AND mb.name=? LIMIT 1`, [moduleId, startLine, name])
        if (mb) res = { kind: 'm', id: mb.id, isPublic: mb.visibility === 'public' || mb.visibility === 'public_impl' }
        else {
            const [sy] = db.all<{ id: number, is_public_surface: number }>(
                `SELECT id, is_public_surface FROM symbol WHERE module_id=? AND start_line=? AND name=? LIMIT 1`,
                [moduleId, startLine, name])
            if (sy) res = { kind: 's', id: sy.id, isPublic: sy.is_public_surface === 1 }
        }
        cache.set(key, res)
        return res
    }
}

function callChainResolved(db: QueryDb, seed: string, broad: boolean): ChainResult {
    interface Node { kind: 'm' | 's', id: number, name: string }
    const seedNodes: Node[] = [
        ...db.all<{ id: number }>(`SELECT id FROM member WHERE name=?`, [seed]).map(r => ({ kind: 'm' as const, id: r.id, name: seed })),
        ...db.all<{ id: number }>(`SELECT id FROM symbol WHERE name=?`, [seed]).map(r => ({ kind: 's' as const, id: r.id, name: seed })),
    ]
    const scopeOf = scopeIdResolver(db)
    const hops: ChainHop[] = []
    const visited = new Set<string>(seedNodes.map(n => `${n.kind}:${n.id}`))
    let frontier = seedNodes
    let truncated = false

    for (let depth = 1; depth <= CHAIN_MAX_DEPTH && frontier.length; depth++) {
        const next: Node[] = []
        for (const node of frontier) {
            const col = node.kind === 'm' ? 'resolved_member_id' : 'resolved_symbol_id'
            const rows = db.all<{
                caller_name: string, caller_kind: string, call_line: number, call_col: number,
                caller_start_line: number | null, caller_end_line: number | null,
                path: string, area: string, module_id: number,
            }>(`SELECT i.caller_name, i.caller_kind, i.line AS call_line, i.col AS call_col,
                       i.caller_start_line, i.caller_end_line, m.path, m.area, i.module_id
                FROM invocation i JOIN module m ON m.id=i.module_id
                WHERE i.${col}=? AND i.caller_name IS NOT NULL`, [node.id])
            for (const r of rows) {
                if (hops.length >= CHAIN_MAX_EDGES) { truncated = true; break }
                const caller = r.caller_start_line !== null ? scopeOf(r.module_id, r.caller_name, r.caller_start_line) : null
                const isPublic = caller?.isPublic ? 1 : 0
                hops.push({
                    callee: node.name, caller: r.caller_name, caller_kind: r.caller_kind, area: r.area,
                    path: r.path, call_line: r.call_line, call_col: r.call_col,
                    caller_start_line: r.caller_start_line, caller_end_line: r.caller_end_line,
                    depth, is_public_hop: isPublic,
                })
                // strict: a PUBLIC hop is a stopping point; only climb when we can map the caller to an ID
                // (an unmapped arrow/anonymous scope is a leaf for the precise walk).
                const stopHere = !broad && isPublic === 1
                if (caller && !stopHere) {
                    const key = `${caller.kind}:${caller.id}`
                    if (!visited.has(key)) { visited.add(key); next.push({ kind: caller.kind, id: caller.id, name: r.caller_name }) }
                }
            }
            if (truncated) break
        }
        if (truncated) break
        frontier = next
    }
    return { hops, truncated }
}

function callChainByName(db: QueryDb, seed: string, broad: boolean): ChainResult {
    // caller_public: is the enclosing function itself public? — a public/public_impl member,
    // OR a public-surface symbol (top-level function), in the SAME module. That makes the hop
    // a public entry point regardless of area (not just queryBuilders).
    const stmt = `SELECT i.caller_name, i.caller_kind, i.line AS call_line, i.col AS call_col,
                         i.caller_start_line, i.caller_end_line, m.path, m.area,
                         (CASE WHEN EXISTS (SELECT 1 FROM member mb JOIN symbol s ON s.id=mb.symbol_id
                                            WHERE s.module_id=i.module_id AND mb.name=i.caller_name
                                              AND mb.visibility IN ('public','public_impl'))
                                 OR EXISTS (SELECT 1 FROM symbol s
                                            WHERE s.module_id=i.module_id AND s.name=i.caller_name
                                              AND s.is_public_surface=1)
                               THEN 1 ELSE 0 END) AS caller_public
                  FROM invocation i JOIN module m ON m.id=i.module_id
                  WHERE i.callee_name=? AND i.caller_name IS NOT NULL`
    const hops: ChainHop[] = []
    const visited = new Set<string>([seed])
    let frontier = [seed]
    let truncated = false

    for (let depth = 1; depth <= CHAIN_MAX_DEPTH && frontier.length; depth++) {
        const next: string[] = []
        for (const callee of frontier) {
            const rows = db.all<{
                caller_name: string, caller_kind: string, call_line: number, call_col: number,
                caller_start_line: number | null, caller_end_line: number | null,
                path: string, area: string, caller_public: number,
            }>(stmt, [callee])
            for (const r of rows) {
                if (hops.length >= CHAIN_MAX_EDGES) { truncated = true; break }
                hops.push({
                    callee, caller: r.caller_name, caller_kind: r.caller_kind, area: r.area,
                    path: r.path, call_line: r.call_line, call_col: r.call_col,
                    caller_start_line: r.caller_start_line,
                    caller_end_line: r.caller_end_line, depth, is_public_hop: r.caller_public,
                })
                // strict: a PUBLIC hop is a stopping point (we reached the public API) — don't climb past it.
                const stopHere = !broad && r.caller_public === 1
                if (!stopHere && !visited.has(r.caller_name)) {
                    visited.add(r.caller_name)
                    next.push(r.caller_name)
                }
            }
            if (truncated) break
        }
        if (truncated) break
        frontier = next
    }
    return { hops, truncated }
}

// One row per legacy-example OCCURRENCE of the name, carrying the example's cell coordinates
// (db/version/connector from the filename) so the searcher can apply --coord per occurrence and
// then count (occurrences + distinct blocks).
export interface ExampleOcc { example_block_id: number, db: string, version: string, connector: string }
export function exampleOccurrences(db: QueryDb, name: string): ExampleOcc[] {
    return db.all<ExampleOcc>(
        `SELECT er.example_block_id, COALESCE(eb.db,'') AS db, COALESCE(eb.version,'') AS version, COALESCE(eb.connector,'') AS connector
         FROM example_ref er JOIN example_block eb ON eb.id=er.example_block_id
         WHERE er.symbol_name=?`,
        [name],
    )
}

// ── neg_type (§11.2): which negative assertions guard the name, by db ────────
export interface NegCoverageRow { db: string, assertions: number }
export function negCoverage(db: QueryDb, name: string): NegCoverageRow[] {
    return db.all<NegCoverageRow>(
        `SELECT nt.db, count(DISTINCT nt.id) AS assertions
         FROM neg_type_ref nr JOIN neg_type nt ON nt.id=nr.neg_type_id
         WHERE nr.symbol_name=? GROUP BY nt.db ORDER BY assertions DESC`,
        [name],
    )
}
// --neg-types full: the actual assertions (the rule comment + rejected snippet + file:line), not a
// count — what a negative-test author needs to model a new @ts-expect-error lock on (cases H/I).
export interface NegAssertion { db: string, file: string, line: number, description: string | null, snippet: string | null }
export function negAssertions(db: QueryDb, name: string): NegAssertion[] {
    return db.all<NegAssertion>(
        `SELECT nt.db, nt.file, nt.marker_line AS line, nt.description, nt.snippet
         FROM neg_type_ref nr JOIN neg_type nt ON nt.id=nr.neg_type_id
         WHERE nr.symbol_name=? ORDER BY nt.db, nt.file, nt.marker_line`,
        [name],
    )
}

// ── R3: where explained / reflected in the docs (doc_test dimension) ─────────
export interface DocHit {
    page: string
    heading: string | null
    md_line: number
    md_col: number
    kind: string
    dbs: string
    block_start: number    // enclosing scope: the doc snippet's markdown fence spans block_start..block_end
    block_end: number
}
// `dbs` is a comma-list of the databases the snippet is copied into; the searcher's --coord
// db focus is applied in JS over that list (so a glob/brace coord works without SQL gymnastics).
export function docHits(db: QueryDb, name: string): DocHit[] {
    return db.all<DocHit>(
        `SELECT dtb.page, dtb.heading, r.md_line, r.md_col, dtb.kind,
                group_concat(DISTINCT dtb.db) AS dbs,
                dtb.start_line AS block_start, dtb.end_line AS block_end
         FROM doc_test_ref r JOIN doc_test_block dtb ON dtb.id=r.doc_test_block_id
         WHERE r.symbol_name=?
         GROUP BY dtb.page, dtb.start_line, r.md_line, r.md_col
         ORDER BY dtb.page, r.md_line`,
        [name],
    )
}

// ── R8 / R8b: simplified ↔ real reconcile + def→doc location ─────────────────
export interface ReconcileRow {
    simplified_name: string
    via: string
    source: string
    partial: number
    simplified_members: number
    real_members: number
    missing_in_simplified: number
    extra_in_simplified: number
}
// Reconcile rows when the QUERIED NAME is itself a simplified def (e.g. SelectExpression).
export function reconcileForDef(db: QueryDb, name: string): ReconcileRow[] {
    return db.all<ReconcileRow>(
        `SELECT simplified_name, via, source, partial, simplified_members, real_members,
                missing_in_simplified, extra_in_simplified
         FROM reconcile WHERE simplified_name=? ORDER BY source`,
        [name],
    )
}

// R8b: where a MEMBER name is SHOWN inside a simplified-def snippet in the docs.
export interface DefDocHit {
    simplified_def: string
    page: string
    md_line: number
    db: string
    block_start: number    // enclosing scope: the simplified-def snippet's markdown fence
    block_end: number
}
export function memberShownInSimplified(db: QueryDb, memberName: string): DefDocHit[] {
    return db.all<DefDocHit>(
        `SELECT b.simplified_def, b.page, r.md_line, b.db,
                b.start_line AS block_start, b.end_line AS block_end
         FROM doc_test_ref r JOIN doc_test_block b ON b.id=r.doc_test_block_id
         WHERE b.simplified_def IS NOT NULL AND r.symbol_name=?
         GROUP BY b.simplified_def, b.page, r.md_line, b.db
         ORDER BY b.simplified_def, b.page, r.md_line`,
        [memberName],
    )
}

// ── global-filter / coord validation: known axis values + the matrix cells ───
export function knownDbs(db: QueryDb): string[] {
    return db.all<{ db: string }>(
        `SELECT DISTINCT db FROM test_block UNION SELECT DISTINCT db FROM doc_test_block ORDER BY db`,
    ).map(r => r.db)
}
// The compatibility-version breakpoints that appear in the SqlBuilders — to validate --breakpoint.
export function knownBreakpoints(db: QueryDb): string[] {
    return db.all<{ breakpoint: string }>(`SELECT DISTINCT breakpoint FROM version_gate ORDER BY breakpoint`).map(r => r.breakpoint)
}
// Every distinct cell+file the searcher can address with --coord — the matrix test files UNION
// the legacy-example files (examples carry their cell in the filename). `file` lets a 4th-level
// coord (db/version/connector/file) be nullglob-validated; coordMatch ignores it for shorter coords.
export function distinctCells(db: QueryDb): { db: string, version: string, connector: string, file: string }[] {
    return db.all<{ db: string, version: string, connector: string, file: string }>(
        `SELECT DISTINCT db, version, connector, file FROM test_block
         UNION
         SELECT DISTINCT db, version, connector, file FROM example_block WHERE db IS NOT NULL`,
    )
}

// ── tests: per-test DETAIL (one row per matrix test exercising the name) ─────
// The raw rows behind `--tests detail`; render.ts applies the result filters
// (version / connector / name-regex / file-regex) in JS, since SQLite has no regex.
export interface TestDetailRow {
    db: string
    version: string
    connector: string
    file: string
    name: string          // full 'describe > … > test' name
    start_line: number
    is_active: number     // 0 when .skip/.todo/commented
}
export function testCoverageDetail(db: QueryDb, name: string): TestDetailRow[] {
    return db.all<TestDetailRow>(
        `SELECT DISTINCT tb.db, tb.version, tb.connector, tb.file, tb.name, tb.start_line, tb.is_active
         FROM test_ref tr JOIN test_block tb ON tb.id=tr.test_block_id
         WHERE tr.symbol_name=?
         ORDER BY tb.db, tb.version, tb.connector, tb.start_line`,
        [name],
    )
}

// ── tests: GAPS per db — which `newest` connectors are MISSING a test ────────
// The full set of newest cells in the matrix vs the ones that actually test the name;
// render.ts diffs them per db to print "covered ✓ / MISSING ✗" per connector.
export interface CellRow { db: string, connector: string }
export function newestConnectorsByDb(db: QueryDb): CellRow[] {
    return db.all<CellRow>(
        `SELECT DISTINCT db, connector FROM test_block WHERE version='newest' ORDER BY db, connector`,
    )
}

// ── --location-target callees: the function(s) INVOKED on a given src line ───
export interface CalleeAt { callee_name: string, kind: string, col: number }
export function calleesAt(db: QueryDb, path: string, line: number): CalleeAt[] {
    return db.all<CalleeAt>(
        `SELECT DISTINCT i.callee_name, i.kind, i.col
         FROM invocation i JOIN module m ON m.id=i.module_id
         WHERE m.path=? AND i.line=? ORDER BY i.col`,
        [path, line],
    )
}

// ── test-line inverse search: the test_block ENCLOSING a test/*.ts:line ──────
export interface TestBlockHit {
    id: number
    db: string
    version: string
    connector: string
    file: string
    name: string
    start_line: number
    end_line: number
    is_active: number
}
export function enclosingTestBlock(db: QueryDb, file: string, line: number): TestBlockHit | null {
    const [row] = db.all<TestBlockHit>(
        `SELECT id, db, version, connector, file, name, start_line, end_line, is_active
         FROM test_block WHERE file=? AND start_line<=? AND end_line>=?
         ORDER BY (end_line - start_line) ASC LIMIT 1`,
        [file, line, line],
    )
    return row ?? null
}
// The public API names a test_block exercises (for the inverse-search report).
export interface ApiInBlock { symbol_name: string, line: number, uses: number }
export function testBlockApi(db: QueryDb, blockId: number): ApiInBlock[] {
    return db.all<ApiInBlock>(
        `SELECT symbol_name, min(line) AS line, count(*) AS uses
         FROM test_ref WHERE test_block_id=? GROUP BY symbol_name ORDER BY line`,
        [blockId],
    )
}

// ── version_gate (schema v4): compatibility-version branches ─────────────────
export interface VersionGateRow {
    path: string
    scope_name: string | null
    scope_start_line: number | null
    scope_end_line: number | null
    field: string
    operator: string
    breakpoint: string
    line: number
}
// Gates whose enclosing scope IS this name (e.g. --search _useUpdateOldValueInFrom).
export function versionGatesByScope(db: QueryDb, scopeName: string): VersionGateRow[] {
    return db.all<VersionGateRow>(
        `SELECT m.path, g.scope_name, g.scope_start_line, g.scope_end_line, g.field, g.operator, g.breakpoint, g.line
         FROM version_gate g JOIN module m ON m.id=g.module_id
         WHERE g.scope_name=? ORDER BY m.path, g.line`,
        [scopeName],
    )
}
// The whole version landscape (for --search compatibilityVersion or the version-work intent).
export function versionGatesAll(db: QueryDb, breakpoint: string | null): VersionGateRow[] {
    const where = breakpoint ? 'WHERE g.breakpoint=?' : ''
    return db.all<VersionGateRow>(
        `SELECT m.path, g.scope_name, g.scope_start_line, g.scope_end_line, g.field, g.operator, g.breakpoint, g.line
         FROM version_gate g JOIN module m ON m.id=g.module_id ${where}
         ORDER BY g.breakpoint, m.path, g.line`,
        breakpoint ? [breakpoint] : [],
    )
}

// ── sql_emit (schema v4): emission sites for --emits-keyword ──────────────────
export interface SqlEmitRow { path: string, scope_name: string | null, scope_start_line: number | null, scope_end_line: number | null, literal: string, line: number }
export function sqlEmitsMatching(db: QueryDb, fragment: string): SqlEmitRow[] {
    return db.all<SqlEmitRow>(
        `SELECT m.path, e.scope_name, e.scope_start_line, e.scope_end_line, e.literal, e.line
         FROM sql_emit e JOIN module m ON m.id=e.module_id
         WHERE e.literal_lc LIKE ? ORDER BY m.path, e.line`,
        [`%${fragment.toLowerCase()}%`],
    )
}

// ── producer (schema v4): public calls whose RETURN TYPE yields a receiver ────
// Given a searched member name, find the interfaces that declare it, then the members
// whose return type produces one of those interfaces (the receiver one calls it on).
export interface ProducerRow { producer: string, owner: string, owner_kind: string, path: string, start_line: number, end_line: number, produces: string }
export function producersOf(db: QueryDb, memberName: string): ProducerRow[] {
    return db.all<ProducerRow>(
        `SELECT pm.name AS producer, ps.name AS owner, ps.kind AS owner_kind,
                m.path, pm.start_line, pm.end_line, prod_s.name AS produces
         FROM member mb
         JOIN producer p ON p.produces_symbol_id=mb.symbol_id
         JOIN symbol prod_s ON prod_s.id=mb.symbol_id
         JOIN member pm ON pm.id=p.member_id
         JOIN symbol ps ON ps.id=pm.symbol_id
         JOIN module m ON m.id=ps.module_id
         WHERE mb.name=?
         GROUP BY pm.id ORDER BY ps.name, pm.name`,
        [memberName],
    )
}

// ── --location-target produces: the TYPE the function enclosing a src line returns ──
// Forward read of the `producer` dimension (the dual of producersOf): the innermost member
// whose span contains the line and whose RETURN type resolves to an indexed symbol → that
// type's name + definition site. The "go to type definition" of the produced value.
export interface ProducedType { type_name: string, type_kind: string, def_path: string, def_line: number, def_end: number, via_owner: string, via_member: string }
export function producedTypeAt(db: QueryDb, path: string, line: number): ProducedType | null {
    const [row] = db.all<ProducedType>(
        `SELECT prod_s.name AS type_name, prod_s.kind AS type_kind, prod_m.path AS def_path,
                prod_s.start_line AS def_line, prod_s.end_line AS def_end,
                owner.name AS via_owner, mb.name AS via_member
         FROM member mb
         JOIN symbol owner ON owner.id=mb.symbol_id
         JOIN module om ON om.id=owner.module_id
         JOIN producer p ON p.member_id=mb.id
         JOIN symbol prod_s ON prod_s.id=p.produces_symbol_id
         JOIN module prod_m ON prod_m.id=prod_s.module_id
         WHERE om.path=? AND mb.start_line<=? AND mb.end_line>=?
         ORDER BY (mb.end_line - mb.start_line) ASC LIMIT 1`,
        [path, line, line],
    )
    return row ?? null
}

// ── reference (schema v5): references to this element, by syntactic ROLE ──────
// The reverse "references by role" views: where the searched element (a type for type-arg, a
// member for property) is referenced in that role. Name-keyed (resolution-scatter convention),
// the resolved FK is available in the row but the searcher queries by ref_name.
export interface ReferenceHit { path: string, line: number, col: number | null, enclosing_member: string | null, enclosing_owner: string | null, enclosing_symbol: string | null }
export function referencesByRole(db: QueryDb, name: string, role: string): ReferenceHit[] {
    // The enclosing is a FK (member or top-level symbol); join to recover its name + owner — so the
    // result is traceable to a real declaration, not a free-text scope name.
    return db.all<ReferenceHit>(
        `SELECT m.path, r.line, r.col,
                em.name AS enclosing_member, eo.name AS enclosing_owner, es.name AS enclosing_symbol
         FROM reference r
         JOIN module m ON m.id=r.module_id
         LEFT JOIN member em ON em.id=r.enclosing_member_id
         LEFT JOIN symbol eo ON eo.id=em.symbol_id
         LEFT JOIN symbol es ON es.id=r.enclosing_symbol_id
         WHERE r.role=? AND r.ref_name=?
         ORDER BY m.path, r.line`,
        [role, name],
    )
}

// ── --location-target types / types-all: the FORWARD read of `reference` ──────
// The dual of referencesByRole (reverse: a type → its uses): from a SOURCE line (or its whole
// enclosing function), the indexed TYPES referenced there → their definition sites. Reads the
// type-valued roles only (type-arg/param/field/new); `property` is a value access, not a type, and
// the return type is omitted by the extractor (--location-target produces covers it). The resolved
// FK is on the row, so each type resolves straight to its def site — no re-search needed.
const TYPE_ROLES = "('type-arg','param','field','new')"
export interface TypeRefHit {
    role: string
    ref_name: string
    sites: number              // occurrences (1 on a single line; N across a function's overloads/body)
    col: number                // first column on the line (reading order); 0 for the types-all view
    def_name: string | null
    def_kind: string | null
    def_path: string | null
    def_line: number | null
    def_end: number | null     // def span end — so a caller can extract the whole definition
}
// `types`: the type references on the EXACT line (the concrete overload's composed types).
export function typesReferencedAt(db: QueryDb, path: string, line: number): TypeRefHit[] {
    return db.all<TypeRefHit>(
        `SELECT r.role, r.ref_name, count(*) AS sites, min(r.col) AS col,
                rs.name AS def_name, rs.kind AS def_kind, dm.path AS def_path, rs.start_line AS def_line, rs.end_line AS def_end
         FROM reference r
         JOIN module m ON m.id=r.module_id
         LEFT JOIN symbol rs ON rs.id=r.resolved_symbol_id
         LEFT JOIN module dm ON dm.id=rs.module_id
         WHERE m.path=? AND r.line=? AND r.role IN ${TYPE_ROLES}
         GROUP BY r.role, r.ref_name, rs.name, rs.kind, dm.path, rs.start_line, rs.end_line
         ORDER BY min(r.col)`,
        [path, line],
    )
}
// `types-all`: every type the WHOLE function references, via the traceable enclosing FK. A method's
// overloads + implementation all share (owner symbol, member name), so matching on those unions them;
// a top-level function's references carry enclosing_symbol_id with a null member. `owner` null selects
// the symbol branch. Deduped by (role, ref_name) with a per-type site count.
export function typesReferencedIn(db: QueryDb, path: string, name: string, owner: string | null): TypeRefHit[] {
    if (owner !== null) {
        return db.all<TypeRefHit>(
            `SELECT r.role, r.ref_name, count(*) AS sites, 0 AS col,
                    rs.name AS def_name, rs.kind AS def_kind, dm.path AS def_path, rs.start_line AS def_line, rs.end_line AS def_end
             FROM reference r
             JOIN member em ON em.id=r.enclosing_member_id
             JOIN symbol o ON o.id=em.symbol_id
             JOIN module om ON om.id=o.module_id
             LEFT JOIN symbol rs ON rs.id=r.resolved_symbol_id
             LEFT JOIN module dm ON dm.id=rs.module_id
             WHERE om.path=? AND o.name=? AND em.name=? AND r.role IN ${TYPE_ROLES}
             GROUP BY r.role, r.ref_name, rs.name, rs.kind, dm.path, rs.start_line, rs.end_line
             ORDER BY r.role, r.ref_name`,
            [path, owner, name],
        )
    }
    return db.all<TypeRefHit>(
        `SELECT r.role, r.ref_name, count(*) AS sites, 0 AS col,
                rs.name AS def_name, rs.kind AS def_kind, dm.path AS def_path, rs.start_line AS def_line, rs.end_line AS def_end
         FROM reference r
         JOIN symbol es ON es.id=r.enclosing_symbol_id
         JOIN module om ON om.id=es.module_id
         LEFT JOIN symbol rs ON rs.id=r.resolved_symbol_id
         LEFT JOIN module dm ON dm.id=rs.module_id
         WHERE om.path=? AND es.name=? AND r.enclosing_member_id IS NULL AND r.role IN ${TYPE_ROLES}
         GROUP BY r.role, r.ref_name, rs.name, rs.kind, dm.path, rs.start_line, rs.end_line
         ORDER BY r.role, r.ref_name`,
        [path, name],
    )
}

// ── --surface: the members of the declaring type(s), inheritance-aware ────────
// Seed a TYPE (interface/class) → its members; seed a MEMBER → its siblings (the other members of its
// owner(s)). Owners = symbols named `name` ∪ the owners of members named `name`; the seed name is
// excluded (a no-op for a type seed). The scope controls how far up the heritage graph it reaches:
//   'own'  — only members declared directly on the owner(s) (no inheritance).
//   'all'  — every member the type HAS: own + inherited (extends) + implemented (implements), flat.
//   'full' — the same coverage, kept BROKEN DOWN by the contributing type (incl. each interface).
// Every row carries `path` + `start_line` + `end_line` (the span) so a caller can extract the code.
export type SurfaceScope = 'own' | 'all' | 'full'
export interface SurfaceMember {
    owner: string             // the type that DECLARES this member (own type or an ancestor)
    owner_kind: string
    is_own: number            // 1 = declared on a seed owner; 0 = inherited/implemented from an ancestor
    name: string
    kind: string
    visibility: string
    signature: string | null
    path: string
    start_line: number
    end_line: number
}
function placeholders(n: number): string { return Array.from({ length: n }, () => '?').join(',') }
export function surfaceOf(db: QueryDb, name: string, scope: SurfaceScope): SurfaceMember[] {
    // seed owners: symbols named `name` ∪ owners of members named `name`
    const seed = db.all<{ id: number }>(
        `SELECT s.id FROM symbol s WHERE s.name=?
         UNION SELECT s.id FROM symbol s JOIN member m ON m.symbol_id=s.id WHERE m.name=?`,
        [name, name])
    const seedIds = new Set(seed.map(r => r.id))
    if (!seedIds.size) return []
    const typeIds = new Set(seedIds)
    if (scope !== 'own') {
        // Heritage closure: follow extends + implements (commented-out edges excluded) by name
        // (base_name → symbol.name), bounded against cycles.
        let frontier = [...seedIds]
        for (let guard = 0; frontier.length && guard < 50; guard++) {
            const bases = db.all<{ id: number }>(
                `SELECT DISTINCT b.id FROM heritage h JOIN symbol b ON b.name=h.base_name
                 WHERE h.symbol_id IN (${placeholders(frontier.length)}) AND h.commented=0`,
                frontier)
            const next = bases.map(r => r.id).filter(id => !typeIds.has(id))
            next.forEach(id => typeIds.add(id))
            frontier = next
        }
    }
    const ids = [...typeIds]
    const rows = db.all<SurfaceMember & { source_id: number }>(
        `SELECT s.id AS source_id, s.name AS owner, s.kind AS owner_kind, mb.name, mb.kind, mb.visibility,
                mb.signature, m.path, mb.start_line, mb.end_line
         FROM member mb JOIN symbol s ON s.id=mb.symbol_id JOIN module m ON m.id=s.module_id
         WHERE mb.symbol_id IN (${placeholders(ids.length)}) AND mb.name != ?
         ORDER BY (mb.visibility='public') DESC, (mb.visibility='public_impl') DESC, s.name, mb.name`,
        [...ids, name])
    return rows.map(r => ({ ...r, is_own: seedIds.has(r.source_id) ? 1 : 0 }))
}

// ── --location-target brand: the marker symbol(s) a computed key `[sym]: T` on a line keys on ──
// From a brand-declaration line → the unique-symbol const it brands with (resolved off the FK), so the
// searcher can jump to that marker and (with --ref-brand) its whole branded family. The forward dual of
// --ref-brand. One brand per line is the norm; ≥1 → a pick-list, like --location-target callees.
export interface BrandKeyHit { ref_name: string, def_path: string | null, def_line: number | null }
export function brandKeysAt(db: QueryDb, path: string, line: number): BrandKeyHit[] {
    return db.all<BrandKeyHit>(
        `SELECT DISTINCT r.ref_name, dm.path AS def_path, rs.start_line AS def_line
         FROM reference r
         JOIN module m ON m.id=r.module_id
         LEFT JOIN symbol rs ON rs.id=r.resolved_symbol_id
         LEFT JOIN module dm ON dm.id=rs.module_id
         WHERE m.path=? AND r.line=? AND r.role='brand'
         ORDER BY r.ref_name`,
        [path, line],
    )
}

// ── todo_marker (schema v4): markers (by tag) mentioning the name ─────────────
// --bugs surfaces tag='BUG' (the generator→fixer channel); --limitation surfaces
// tag='LIMITATION'. Other indexed TODO tags aren't consumed by a section yet.
export interface TodoMarkerHit { file: string, line: number, text: string }
export function todoMarkersMatching(db: QueryDb, name: string, tag: string): TodoMarkerHit[] {
    return db.all<TodoMarkerHit>(
        `SELECT file, line, text FROM todo_marker WHERE tag=? AND text LIKE ? ORDER BY file, line`,
        [tag, `%${name}%`],
    )
}

// --cell-caveats (case G): every first-class disabled-test marker — BUG, LIMITATION and the permanent
// dialect-boundary NOT-APPLICABLE — NOT filtered by symbol. The searcher derives each marker's cell from
// its file path and keeps the ones the --coord focus matches, so a caveat declared on a cell (e.g. MariaDB
// UPDATE…RETURNING, or a dialect boundary like Oracle-only CONNECT BY) surfaces for any work in that cell.
// The `tag` keeps the three CATEGORIES distinct in the view (NOT-APPLICABLE is never merged into LIMITATION).
export interface CaveatMarker { file: string, line: number, tag: string, text: string }
export function caveatMarkers(db: QueryDb): CaveatMarker[] {
    return db.all<CaveatMarker>(
        `SELECT file, line, tag, text FROM todo_marker WHERE tag IN ('BUG','LIMITATION','NOT-APPLICABLE') ORDER BY file, line`,
    )
}

// ── emitted_sql (schema v4): the SQL a symbol's tests/docs assert ────────────
// Joined by file + line-containment against the block spans (no block FK stored). 'test'
// rows match the matrix cell span; 'doc' rows match the generated-cell gen_* span.
export interface EmittedSqlHit { source: string, db: string, cell: string, file: string, line: number, sql: string }
export function emittedSqlForName(db: QueryDb, name: string): EmittedSqlHit[] {
    return db.all<EmittedSqlHit>(
        `SELECT DISTINCT 'test' AS source, tb.db AS db, tb.db||'/'||tb.version||'/'||tb.connector AS cell,
                es.file, es.line, es.sql
         FROM test_ref tr JOIN test_block tb ON tb.id=tr.test_block_id
         JOIN emitted_sql es ON es.source='test' AND es.file=tb.file AND es.line>=tb.start_line AND es.line<=tb.end_line
         WHERE tr.symbol_name=?
         UNION ALL
         SELECT DISTINCT 'doc' AS source, dtb.db AS db, dtb.db||'/documentation' AS cell,
                es.file, es.line, es.sql
         FROM doc_test_ref dr JOIN doc_test_block dtb ON dtb.id=dr.doc_test_block_id
         JOIN emitted_sql es ON es.source='doc' AND es.file=dtb.gen_file AND es.line>=dtb.gen_start_line AND es.line<=dtb.gen_end_line
         WHERE dr.symbol_name=?
         ORDER BY source, db`,
        [name, name],
    )
}

// ── R6: name-based discovery — every place the name appears, by dimension ────
export interface DiscoveryRow { where_: string, count: number }
export function discovery(db: QueryDb, name: string): DiscoveryRow[] {
    return db.all<DiscoveryRow>(
        `SELECT 'src-symbol'  AS where_, count(*) AS count FROM symbol     WHERE name=?
         UNION ALL SELECT 'src-member',  count(*) FROM member     WHERE name=?
         UNION ALL SELECT 'src-call',    count(*) FROM invocation WHERE callee_name=?
         UNION ALL SELECT 'test',        count(*) FROM test_ref   WHERE symbol_name=?
         UNION ALL SELECT 'doc-test',    count(*) FROM doc_test_ref WHERE symbol_name=?
         UNION ALL SELECT 'example',     count(*) FROM example_ref  WHERE symbol_name=?
         UNION ALL SELECT 'neg-type',    count(*) FROM neg_type_ref WHERE symbol_name=?`,
        [name, name, name, name, name, name, name],
    )
}
