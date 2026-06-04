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
        `SELECT mb.name, mb.kind, mb.visibility, mb.signature, mb.jsdoc,
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

export function callChain(db: QueryDb, seed: string, broad: boolean): ChainResult {
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

// ── R2: coverage — which databases test the name, at test() granularity ──────
// `tests` is across ALL matrix versions; `newest` is just the canonical newest cells
// (older versions usually re-emit the same snapshots, so newest is the telling number).
export interface CoverageRow { db: string, tests: number, newest: number }
export function testCoverage(db: QueryDb, name: string): CoverageRow[] {
    return db.all<CoverageRow>(
        `SELECT tb.db,
                count(DISTINCT tb.id) AS tests,
                count(DISTINCT CASE WHEN tb.version='newest' THEN tb.id END) AS newest
         FROM test_ref tr JOIN test_block tb ON tb.id=tr.test_block_id
         WHERE tr.symbol_name=? GROUP BY tb.db ORDER BY newest DESC, tests DESC`,
        [name],
    )
}

export interface ExampleCoverage { occurrences: number, blocks: number }
export function exampleCoverage(db: QueryDb, name: string): ExampleCoverage {
    const [row] = db.all<ExampleCoverage>(
        `SELECT count(*) AS occurrences, count(DISTINCT example_block_id) AS blocks
         FROM example_ref WHERE symbol_name=?`,
        [name],
    )
    return row ?? { occurrences: 0, blocks: 0 }
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
