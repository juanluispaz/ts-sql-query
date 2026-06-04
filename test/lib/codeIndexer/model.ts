// Row shapes mirroring schema.ts. Extractors produce these (with ids already
// assigned by an Ids counter); build.ts bulk-inserts them. Keeping ids in the
// extractor lets us emit foreign keys without a round-trip per row.

import type { SqlValue } from './db.js'

export interface MetaRow {
    key: string
    value: string | null
}

export interface ModuleRow {
    id: number
    path: string
    area: string
    is_public: 0 | 1
    export_subpath: string | null
    zone: string | null
}

export interface SymbolRow {
    id: number
    module_id: number
    name: string
    kind: string
    is_abstract: 0 | 1          // 1 for an abstract class (shared implementation base)
    is_exported: 0 | 1
    is_public: 0 | 1            // directly importable through package.json exports
    is_public_surface: 0 | 1    // public surface: importable OR a fluent-API/simplified interface (set by the publics-marking phase)
    exported_name: string | null
    start_line: number
    start_col: number
    end_line: number
    end_col: number
    jsdoc: string | null
}

// A member's place in the public surface. Only functions exposed by a PUBLIC INTERFACE
// are public; a class method that implements one is public-by-impl; the rest are internal.
export type Visibility = 'public' | 'public_impl' | 'internal'

export interface MemberRow {
    id: number
    symbol_id: number
    name: string
    kind: string
    is_optional: 0 | 1
    is_static: 0 | 1
    visibility: Visibility      // public | public_impl | internal (set by the publics-marking phase)
    signature: string | null
    start_line: number
    start_col: number
    end_line: number
    end_col: number
    jsdoc: string | null
}

export interface HeritageRow {
    symbol_id: number
    base_name: string
    relation: 'extends' | 'implements'
    commented: 0 | 1      // 1 when the implements entry was commented out (/*Name,*/) — a deliberate gap
    simplified: 0 | 1     // 1 when synthesised from the reconcile map (class realizes a simplified def)
}

export type ReconcileSource = 'master' | 'doc' | 'doc-inquery'

export interface ReconcileRow {
    simplified_name: string
    via: 'class' | 'name'
    source: ReconcileSource
    partial: 0 | 1
    simplified_members: number
    real_members: number
    missing_in_simplified: number
    extra_in_simplified: number
}

export interface ReconcileGapRow {
    simplified_name: string
    member_name: string
    side: 'missing_in_simplified' | 'extra_in_simplified'
    source: ReconcileSource
}

export interface TestBlockRow {
    id: number
    file: string
    db: string
    version: string
    connector: string
    name: string
    start_line: number
    end_line: number
    is_active: 0 | 1
}

export interface TestRefRow {
    test_block_id: number
    symbol_name: string
    line: number          // 1-based line of this occurrence in the .test.ts file
    col: number
    resolved_symbol_id: number | null   // checker-resolved declaration: indexed symbol (null if it binds outside the lib)
    resolved_member_id: number | null   // …and the member, when it resolves to one
}

export interface DocTestBlockRow {
    id: number
    page: string
    area: string
    heading: string | null
    db: string
    kind: 'test' | 'fn' | 'decl'
    simplified_def: string | null   // interface/class name when this snippet declares a simplified def (the def→doc anchor)
    start_line: number
    end_line: number
    name: string
    gen_file: string
    gen_start_line: number
    gen_end_line: number
    is_active: 0 | 1
}

export interface DocTestRefRow {
    doc_test_block_id: number
    symbol_name: string
    md_line: number       // 1-based line/col in the SOURCE .md page (mapped from the compiled cell)
    md_col: number
    resolved_symbol_id: number | null   // checker-resolved declaration: indexed symbol (null if it binds outside the lib)
    resolved_member_id: number | null   // …and the member, when it resolves to one
}

export interface InvocationRow {
    id: number
    module_id: number
    caller_name: string | null
    caller_kind: string
    caller_start_line: number | null   // enclosing scope span (function to read); null at module top-level
    caller_end_line: number | null
    callee_name: string
    kind: 'call' | 'method' | 'new' | 'operation'   // 'operation' = a keyof-dispatched SqlBuilder method, captured from a `new SqlOperation*ValueSource('_op', …)` site
    line: number
    col: number
    resolved_symbol_id: number | null   // checker-resolved callee declaration (null for 'operation' edges + binds outside the lib)
    resolved_member_id: number | null   // …and the member, when the callee resolves to one
}

export interface ExampleBlockRow {
    id: number
    file: string
    is_doc: 0 | 1
    ordinal: number
    start_line: number
    end_line: number
}

export interface ExampleRefRow {
    example_block_id: number
    symbol_name: string
    line: number          // 1-based line of this occurrence in the example .ts file
    col: number
    resolved_symbol_id: number | null   // checker-resolved declaration: indexed symbol (null if it binds outside the lib)
    resolved_member_id: number | null   // …and the member, when it resolves to one
}

export interface NegTypeRow {
    id: number
    file: string
    db: string
    marker_line: number   // line of the // @ts-expect-error directive
    target_line: number   // the code line asserted to fail compilation
    description: string | null
    snippet: string | null
    scope: string | null  // enclosing function/test name
}

export interface NegTypeRefRow {
    neg_type_id: number
    symbol_name: string
    line: number
    col: number
    resolved_symbol_id: number | null
    resolved_member_id: number | null
}

/** Monotonic id source so extractors can assign ids while staying decoupled. */
export class Ids {
    private n = 0
    next(): number {
        return ++this.n
    }
}

// Column orders for the INSERT statements (kept next to the row shapes so a
// schema change forces an update here too).
export const INSERTS = {
    meta: {
        sql: 'INSERT INTO meta (key,value) VALUES (?,?)',
        row: (r: MetaRow): SqlValue[] => [r.key, r.value],
    },
    module: {
        sql: 'INSERT INTO module (id,path,area,is_public,export_subpath,zone) VALUES (?,?,?,?,?,?)',
        row: (r: ModuleRow): SqlValue[] => [r.id, r.path, r.area, r.is_public, r.export_subpath, r.zone],
    },
    symbol: {
        sql: 'INSERT INTO symbol (id,module_id,name,kind,is_abstract,is_exported,is_public,is_public_surface,exported_name,start_line,start_col,end_line,end_col,jsdoc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        row: (r: SymbolRow): SqlValue[] => [r.id, r.module_id, r.name, r.kind, r.is_abstract, r.is_exported, r.is_public, r.is_public_surface, r.exported_name, r.start_line, r.start_col, r.end_line, r.end_col, r.jsdoc],
    },
    member: {
        sql: 'INSERT INTO member (id,symbol_id,name,kind,is_optional,is_static,visibility,signature,start_line,start_col,end_line,end_col,jsdoc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        row: (r: MemberRow): SqlValue[] => [r.id, r.symbol_id, r.name, r.kind, r.is_optional, r.is_static, r.visibility, r.signature, r.start_line, r.start_col, r.end_line, r.end_col, r.jsdoc],
    },
    heritage: {
        sql: 'INSERT INTO heritage (symbol_id,base_name,relation,commented,simplified) VALUES (?,?,?,?,?)',
        row: (r: HeritageRow): SqlValue[] => [r.symbol_id, r.base_name, r.relation, r.commented, r.simplified],
    },
    reconcile: {
        sql: 'INSERT INTO reconcile (simplified_name,via,source,partial,simplified_members,real_members,missing_in_simplified,extra_in_simplified) VALUES (?,?,?,?,?,?,?,?)',
        row: (r: ReconcileRow): SqlValue[] => [r.simplified_name, r.via, r.source, r.partial, r.simplified_members, r.real_members, r.missing_in_simplified, r.extra_in_simplified],
    },
    reconcileGap: {
        sql: 'INSERT INTO reconcile_gap (simplified_name,member_name,side,source) VALUES (?,?,?,?)',
        row: (r: ReconcileGapRow): SqlValue[] => [r.simplified_name, r.member_name, r.side, r.source],
    },
    invocation: {
        sql: 'INSERT INTO invocation (id,module_id,caller_name,caller_kind,caller_start_line,caller_end_line,callee_name,kind,line,col,resolved_symbol_id,resolved_member_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        row: (r: InvocationRow): SqlValue[] => [r.id, r.module_id, r.caller_name, r.caller_kind, r.caller_start_line, r.caller_end_line, r.callee_name, r.kind, r.line, r.col, r.resolved_symbol_id, r.resolved_member_id],
    },
    testBlock: {
        sql: 'INSERT INTO test_block (id,file,db,version,connector,name,start_line,end_line,is_active) VALUES (?,?,?,?,?,?,?,?,?)',
        row: (r: TestBlockRow): SqlValue[] => [r.id, r.file, r.db, r.version, r.connector, r.name, r.start_line, r.end_line, r.is_active],
    },
    testRef: {
        sql: 'INSERT INTO test_ref (test_block_id,symbol_name,line,col,resolved_symbol_id,resolved_member_id) VALUES (?,?,?,?,?,?)',
        row: (r: TestRefRow): SqlValue[] => [r.test_block_id, r.symbol_name, r.line, r.col, r.resolved_symbol_id, r.resolved_member_id],
    },
    docTestBlock: {
        sql: 'INSERT INTO doc_test_block (id,page,area,heading,db,kind,simplified_def,start_line,end_line,name,gen_file,gen_start_line,gen_end_line,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        row: (r: DocTestBlockRow): SqlValue[] => [r.id, r.page, r.area, r.heading, r.db, r.kind, r.simplified_def, r.start_line, r.end_line, r.name, r.gen_file, r.gen_start_line, r.gen_end_line, r.is_active],
    },
    docTestRef: {
        sql: 'INSERT INTO doc_test_ref (doc_test_block_id,symbol_name,md_line,md_col,resolved_symbol_id,resolved_member_id) VALUES (?,?,?,?,?,?)',
        row: (r: DocTestRefRow): SqlValue[] => [r.doc_test_block_id, r.symbol_name, r.md_line, r.md_col, r.resolved_symbol_id, r.resolved_member_id],
    },
    exampleBlock: {
        sql: 'INSERT INTO example_block (id,file,is_doc,ordinal,start_line,end_line) VALUES (?,?,?,?,?,?)',
        row: (r: ExampleBlockRow): SqlValue[] => [r.id, r.file, r.is_doc, r.ordinal, r.start_line, r.end_line],
    },
    exampleRef: {
        sql: 'INSERT INTO example_ref (example_block_id,symbol_name,line,col,resolved_symbol_id,resolved_member_id) VALUES (?,?,?,?,?,?)',
        row: (r: ExampleRefRow): SqlValue[] => [r.example_block_id, r.symbol_name, r.line, r.col, r.resolved_symbol_id, r.resolved_member_id],
    },
    negType: {
        sql: 'INSERT INTO neg_type (id,file,db,marker_line,target_line,description,snippet,scope) VALUES (?,?,?,?,?,?,?,?)',
        row: (r: NegTypeRow): SqlValue[] => [r.id, r.file, r.db, r.marker_line, r.target_line, r.description, r.snippet, r.scope],
    },
    negTypeRef: {
        sql: 'INSERT INTO neg_type_ref (neg_type_id,symbol_name,line,col,resolved_symbol_id,resolved_member_id) VALUES (?,?,?,?,?,?)',
        row: (r: NegTypeRefRow): SqlValue[] => [r.neg_type_id, r.symbol_name, r.line, r.col, r.resolved_symbol_id, r.resolved_member_id],
    },
} as const
