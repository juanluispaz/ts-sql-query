// SQLite schema for the symbol index. Plain portable SQLite (no bun-specific
// features) so a future sql.js backend can run the same DDL.
//
// The index records WHERE each declaration and member lives (file + 1-based
// line/column span) so it can be looked up later — this is a queryable symbol
// index first, and a foundation other tooling will build on.

// Bump when the schema (tables/columns) changes, so a consumer can reject an index built
// by an older/newer tool. Written to the meta table at build time as schema_version.
export const SCHEMA_VERSION = 4

export const SCHEMA = `
-- Build metadata (key/value): schema_version, built_at (ISO), git_rev, git_dirty, resolve
-- ('resolved' | 'name-based'). Lets a consumer detect staleness (built_at/git_rev vs the
-- working tree) and incompatibility (schema_version) before trusting the index.
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE module (
    id              INTEGER PRIMARY KEY,
    path            TEXT NOT NULL UNIQUE,   -- e.g. 'src/expressions/select.ts'
    area            TEXT NOT NULL,          -- first path segment under src/ ('root' for src/*.ts)
    is_public       INTEGER NOT NULL,       -- module is a public entry point in package.json exports
    export_subpath  TEXT,                   -- './connections/PostgreSqlConnection' or NULL
    zone            TEXT                    -- 'root'|'connections'|'queryRunners'|'extras'|... (public modules)
);

CREATE TABLE symbol (
    id            INTEGER PRIMARY KEY,
    module_id     INTEGER NOT NULL REFERENCES module(id),
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL,            -- interface|class|type|function|const|enum|namespace
    is_abstract   INTEGER NOT NULL,         -- 1 for an abstract class (the shared implementation base, e.g. AbstractConnection/AbstractSelect); 0 otherwise
    is_exported   INTEGER NOT NULL,         -- exported from its own module
    is_public     INTEGER NOT NULL,         -- importable by name through package exports
    is_public_surface INTEGER NOT NULL,     -- part of the PUBLIC SURFACE: is_public, OR a fluent-API interface (area 'expressions') / curated 'simplified' def. These are reached through the public connection methods even though not directly importable. Set by the publics-marking phase.
    exported_name TEXT,                     -- public name if re-exported (usually same as name)
    start_line    INTEGER NOT NULL,
    start_col     INTEGER NOT NULL,
    end_line      INTEGER NOT NULL,
    end_col       INTEGER NOT NULL,
    jsdoc         TEXT
);

CREATE TABLE member (
    id          INTEGER PRIMARY KEY,
    symbol_id   INTEGER NOT NULL REFERENCES symbol(id),
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,              -- method|property|getter|setter|index|call|construct
    is_optional INTEGER NOT NULL,
    is_static   INTEGER NOT NULL,
    visibility  TEXT NOT NULL,              -- public | public_impl | internal. ONLY functions exposed by a PUBLIC INTERFACE are public: 'public' = declared on a public-surface interface (the contract); 'public_impl' = a CLASS method whose name a public interface exposes (it implements the contract — public by implementation); 'internal' = on no public interface (e.g. __addOrderBy). Set by the publics-marking phase.
    signature   TEXT,                       -- the member SIGNATURE only (declaration up to the body / initializer; no implementation), trimmed to 400 chars
    start_line  INTEGER NOT NULL,
    start_col   INTEGER NOT NULL,
    end_line    INTEGER NOT NULL,
    end_col     INTEGER NOT NULL,
    jsdoc       TEXT
);

CREATE TABLE heritage (
    symbol_id INTEGER NOT NULL REFERENCES symbol(id),
    base_name TEXT NOT NULL,                -- extended/implemented type name (head identifier)
    relation  TEXT NOT NULL,                -- extends|implements
    commented INTEGER NOT NULL,             -- 1 when the implements entry is commented out (/*Name<…>,*/) — a DELIBERATE gap (a type too complex for the compiler); these would otherwise be invisible. Closure/coverage uses commented=0; commented=1 marks "accounted for, not forgotten".
    simplified INTEGER NOT NULL             -- 1 when this is a SYNTHESISED edge: the class realizes a SIMPLIFIED definition (base_name is a simplified def name, area='simplified'), injected from the reconcile map so the simplified def shows up as "another implemented interface". Real analyses filter simplified=0 (like commented=0).
);

CREATE INDEX idx_symbol_name     ON symbol(name);
CREATE INDEX idx_symbol_module   ON symbol(module_id);
CREATE INDEX idx_symbol_surface  ON symbol(is_public_surface);
CREATE INDEX idx_member_name     ON member(name);
CREATE INDEX idx_member_symbol   ON member(symbol_id);
CREATE INDEX idx_member_vis      ON member(visibility);
CREATE INDEX idx_heritage_sym    ON heritage(symbol_id);
CREATE INDEX idx_heritage_base   ON heritage(base_name);   -- implementedBy joins heritage by base_name (interface→class bridge)

-- ── reconcile: simplified definitions ↔ the real implementing class ──────────
-- src/examples/documentation/simplifiedQueryDefinition.ts holds hand-maintained,
-- compiler-protection-free SIMPLIFIED versions of the query types (the ones the
-- docs render). Each maps to the CLASS that implements it (via the curated table in
-- reconcileSimplified.ts) — NOT the dozens of collapsed real interfaces — and members
-- match by NAME. reconcile records the mapping + a member-coverage diff: how many
-- public members the class has that the simplified def is MISSING (drift: simplified
-- incomplete), and how many the simplified has that aren't reachable on the class
-- (drift: simplified wrong/renamed). reconcile_gap lists those member names. This
-- closes the loop internal → call-chain → builder → simplified def → docs, and flags
-- a simplified definition that has fallen out of sync with the real API.
-- A simplified def may map to SEVERAL classes (e.g. Connection → AbstractConnection +
-- AbstractAdvancedConnection + the per-db connections): some members live only on the
-- specific/deeper classes, so mapping to one abstract base would make them undiscoverable.
-- Coverage is the UNION of the mapped classes; the per-class link is the heritage
-- simplified=1 edges (one per class). extra_in_simplified is then the members reachable on
-- NO mapped class — genuine drift (a rename / a member that no longer exists).
-- One row per (simplified_name, source): the SAME def reconciled from EACH of the three
-- simplified sources, so a search can distinguish where it is shown. source =
-- 'master' (simplifiedQueryDefinition.ts) | 'doc' (the full reassembly cell,
-- simplifiedDefinition.generated.test.ts) | 'doc-inquery' (the subset cell,
-- simplifiedDefinitionInQuery.generated.test.ts — partial=1, its missing is by design).
CREATE TABLE reconcile (
    simplified_name       TEXT NOT NULL,    -- e.g. SelectExpression, BooleanValueSource, TsSqlError
    via                   TEXT NOT NULL,    -- 'class' (mapped builder subtree, the collapsing query defs) | 'name' (real same-name symbol)
    source                TEXT NOT NULL,    -- 'master' | 'doc' | 'doc-inquery'
    partial               INTEGER NOT NULL, -- 1 when this source shows only a SUBSET by design (the in-query extracts) - missing is expected, not drift
    simplified_members    INTEGER NOT NULL, -- # public member names this source shows
    real_members          INTEGER NOT NULL, -- # public member names on the real side (union subtree for 'class'; the same-name symbol for 'name')
    missing_in_simplified INTEGER NOT NULL, -- # real public members absent from this source (over-broad for 'class': name-based closure; expected when partial)
    extra_in_simplified   INTEGER NOT NULL  -- # shown members not on the real side → genuine drift
);

CREATE TABLE reconcile_gap (
    simplified_name TEXT NOT NULL,
    member_name     TEXT NOT NULL,
    side            TEXT NOT NULL,          -- 'missing_in_simplified' | 'extra_in_simplified'
    source          TEXT NOT NULL           -- which reconcile source this gap belongs to (master | doc | doc-inquery)
);

CREATE INDEX idx_reconcile_simplified ON reconcile(simplified_name);
CREATE INDEX idx_reconcile_source     ON reconcile(source);
CREATE INDEX idx_reconcile_gap        ON reconcile_gap(simplified_name, side);

-- ── test/ dimension (adapted for test questions, not generic symbols) ────────
-- A test_block is one test()/it() leaf in a *.test.ts, located in the matrix
-- cell coordinates (db × version × connector) so coverage can be rolled up the
-- way the matrix is organised. A test_ref links a public API name referenced
-- inside that block to the block — the join that answers "which tests exercise
-- groupBy, in which databases, and is it saturated?".
CREATE TABLE test_block (
    id          INTEGER PRIMARY KEY,
    file        TEXT NOT NULL,            -- test/db/<db>/<version>/<connector>/<file>.test.ts
    db          TEXT NOT NULL,            -- postgres, mysql, mariadb, oracle, sqlite, sqlserver
    version     TEXT NOT NULL,            -- newest, oldest, <breakpoint>, or 'types.negative'
    connector   TEXT NOT NULL,            -- pg, mysql2, better-sqlite3, ...
    name        TEXT NOT NULL,            -- full 'describe > … > test' name
    start_line  INTEGER NOT NULL,
    end_line    INTEGER NOT NULL,
    is_active   INTEGER NOT NULL          -- 0 when commented-out / .skip / .todo (still a structural element)
);
-- NOTE: the autogenerated documentation cells (connector='documentation') are a
-- SEPARATE world and live in doc_test_block / doc_test_ref below, NOT here.
-- extractTests.ts skips them so test_block stays hand-written matrix tests only.

-- One row per OCCURRENCE (not per name): the exact line/col of each use, so a
-- search lands on the symbol itself, with test_block as the surrounding context.
-- (count of uses = COUNT(*) … GROUP BY symbol_name.)
CREATE TABLE test_ref (
    test_block_id      INTEGER NOT NULL REFERENCES test_block(id),
    symbol_name        TEXT NOT NULL,     -- identifier/member name referenced in the block (name-based fallback)
    line               INTEGER NOT NULL,  -- 1-based line of this occurrence in the .test.ts file
    col                INTEGER NOT NULL,  -- 1-based column of the name token
    resolved_symbol_id INTEGER REFERENCES symbol(id),  -- checker-resolved declaration (NULL = binds outside the indexed lib)
    resolved_member_id INTEGER REFERENCES member(id)   -- …and the member, when it resolves to one (JOIN here for an EXACT, collision-free link)
);

CREATE INDEX idx_test_block_cell ON test_block(db, version, connector);
CREATE INDEX idx_test_block_file ON test_block(file);   -- enclosingTestBlock (test-line inverse search) looks a block up by file
CREATE INDEX idx_test_ref_name   ON test_ref(symbol_name);
CREATE INDEX idx_test_ref_block  ON test_ref(test_block_id);
CREATE INDEX idx_test_ref_rsym   ON test_ref(resolved_symbol_id);
CREATE INDEX idx_test_ref_rmem   ON test_ref(resolved_member_id);

-- ── documentation dimension (autogenerated *.generated.test.ts cells) ────────
-- THE documentation dimension (replaces the old, less precise doc_block that read
-- the .md directly). A SEPARATE world from test_block: the doc-code extractor's
-- output — EVERY snippet from docs/**/*.md, copied per database into the matrix
-- and either type-checked or SQL-asserted. One row per snippet (each BEGIN/END
-- region in the generated file), classified by kind:
--   test = a runnable ts example paired with documented SQL, asserted against a mock
--   fn   = a compile-only ts example (no SQL) emitted as a function — type-checked
--   decl = a typescript type-declaration snippet emitted at module level (e.g.
--          simplifiedDefinition) — type-checked
-- Located by their SOURCE markdown (page + heading + fence line range) so the row
-- points straight at the docs (the destination); the generated .test.ts location
-- is kept as gen_* (a back-reference, to read that exact snippet without the whole
-- doc). doc_test_ref links each API name → the block, with positions. Answers
-- "which doc snippet (page:lines, which dbs, verified?) reflects <symbol>, and
-- where is it EXPLAINED (heading)?".
CREATE TABLE doc_test_block (
    id              INTEGER PRIMARY KEY,
    page            TEXT NOT NULL,        -- SOURCE markdown page: docs/queries/select.md
    area            TEXT NOT NULL,        -- first path segment under docs/ (queries, advanced, ...)
    heading         TEXT,                 -- nearest markdown heading above the snippet (the section title)
    db              TEXT NOT NULL,        -- the cell this copy lives in (postgres, mysql, mariadb, oracle, sqlite, sqlserver, general)
    kind            TEXT NOT NULL,        -- 'test' (SQL-asserted) | 'fn' (compile-only ts) | 'decl' (typescript module-level)
    simplified_def  TEXT,                 -- when this snippet declares a SIMPLIFIED def, the interface/class name (e.g. SelectExpression) — the precise def→doc anchor; NULL otherwise
    start_line      INTEGER NOT NULL,     -- markdown OPENING fence line
    end_line        INTEGER NOT NULL,     -- markdown CLOSING fence line
    name            TEXT NOT NULL,        -- test: full 'describe > … > test' name; fn/decl: 'page:line' locator
    gen_file        TEXT NOT NULL,        -- the autogenerated test/db/<db>/newest/documentation/*.generated.test.ts
    gen_start_line  INTEGER NOT NULL,     -- BEGIN marker line within gen_file
    gen_end_line    INTEGER NOT NULL,     -- END marker line within gen_file
    is_active       INTEGER NOT NULL      -- 0 when .skip/.todo (doc snippets are normally all active)
);

-- One row per OCCURRENCE, positioned in the SOURCE markdown (md_line/md_col) —
-- parsed straight from the .md fence body, so it's immune to the import-stripping
-- the generated copy undergoes. The "read the exact generated test" variant lives
-- at the block level (doc_test_block.gen_start_line/gen_end_line). count = COUNT(*).
-- Refs are taken from the COMPILED generated cell (in the unified Program, so the
-- checker can resolve them) within the BEGIN/END region, then mapped back to .md
-- coordinates (the in-region copy is verbatim line-for-line: md_line = gen_line +
-- (md_start - begin_file_line), col unchanged). No in-memory .md slice is parsed.
CREATE TABLE doc_test_ref (
    doc_test_block_id  INTEGER NOT NULL REFERENCES doc_test_block(id),
    symbol_name        TEXT NOT NULL,     -- identifier/member name referenced in the snippet (name-based fallback)
    md_line            INTEGER NOT NULL,  -- 1-based line of this occurrence in the SOURCE .md page
    md_col             INTEGER NOT NULL,  -- 1-based column in the .md page
    resolved_symbol_id INTEGER REFERENCES symbol(id),  -- checker-resolved declaration (NULL = binds outside the indexed lib)
    resolved_member_id INTEGER REFERENCES member(id)   -- …and the member, when it resolves to one
);

CREATE INDEX idx_doc_test_block_page ON doc_test_block(page);
CREATE INDEX idx_doc_test_block_db   ON doc_test_block(db);
CREATE INDEX idx_doc_test_block_sdef ON doc_test_block(simplified_def);
CREATE INDEX idx_doc_test_ref_name   ON doc_test_ref(symbol_name);
CREATE INDEX idx_doc_test_ref_block  ON doc_test_ref(doc_test_block_id);
CREATE INDEX idx_doc_test_ref_rsym   ON doc_test_ref(resolved_symbol_id);
CREATE INDEX idx_doc_test_ref_rmem   ON doc_test_ref(resolved_member_id);

-- ── invocation graph (NAME-BASED, src/ call sites) ──────────────────────────
-- One row per call site: the nearest enclosing scope (caller_name) invokes
-- callee_name at module:line. Edges are by NAME, not type-resolved — so
-- "where is X invoked?" (callee_name = X) is reliable, while a reconstructed
-- call chain is APPROXIMATE/over-broad (a '.execute()' edge matches every
-- receiver). Powers the coverage agent's "where is this internal symbol used,
-- and what is a candidate public path that reaches it?".
CREATE TABLE invocation (
    id                INTEGER PRIMARY KEY,
    module_id         INTEGER NOT NULL REFERENCES module(id),
    caller_name       TEXT,                -- nearest enclosing function/method/class scope (NULL = module top-level)
    caller_kind       TEXT NOT NULL,       -- function|method|constructor|getter|setter|arrow|class|top
    caller_start_line INTEGER,             -- enclosing scope's span (the function to READ for context); NULL at module top-level
    caller_end_line   INTEGER,
    callee_name       TEXT NOT NULL,       -- invoked identifier (call), member name (method call), or the keyof operation string ('operation')
    kind              TEXT NOT NULL,       -- call|method|new|operation
    line              INTEGER NOT NULL,    -- 1-based line/col of THIS call site
    col               INTEGER NOT NULL,
    resolved_symbol_id INTEGER REFERENCES symbol(id),  -- checker-resolved callee declaration (NULL for 'operation' edges + binds outside the lib)
    resolved_member_id INTEGER REFERENCES member(id)   -- …and the member, when the callee resolves to one (a type-exact call edge, unlike the name-based callee_name)
);
-- 'operation' edges bridge the keyof dispatch: a  new SqlOperation*ValueSource('_op', …)
-- stores '_op' as  __operation: keyof Sql…  and later runs  sqlBuilder['_op'](…)  via
-- element access (invisible to a name-based graph). The edge records '_op' (the exact
-- SqlBuilder method) at the construction site, so a call chain can cross the keyof.

CREATE INDEX idx_inv_callee ON invocation(callee_name);
CREATE INDEX idx_inv_caller ON invocation(caller_name);
CREATE INDEX idx_inv_module ON invocation(module_id, line);   -- (module_id) prefix for joins + (module_id,line) for calleesAt (--location-target callees)
CREATE INDEX idx_inv_rsym   ON invocation(resolved_symbol_id);
CREATE INDEX idx_inv_rmem   ON invocation(resolved_member_id);

-- ── examples dimension (LEGACY src/examples/, its own dimension) ─────────────
-- The old example suite is one giant main() per file with no function-level
-- structure; examples are delimited by their closing assertEquals() call (there
-- are never two consecutive assertEquals, so this segmentation is unambiguous)
-- for the legacy files, while documentation/ examples use the Preparation
-- banner. An example_block is one example case; example_ref links the API names
-- it references — the analogue of test_block/test_ref, answering "which example
-- shows how to use <symbol>?". src/examples/prisma/ (generated) excluded.
CREATE TABLE example_block (
    id          INTEGER PRIMARY KEY,
    file        TEXT NOT NULL,            -- src/examples/<...>.ts
    db          TEXT,                     -- database the example targets, from the filename (PgExample→postgres, MySql2Example→mysql, …); NULL if unrecognised
    version     TEXT,                     -- compatibility version, from the filename: '-compatibility' suffix → oldest, else newest
    connector   TEXT,                     -- driver/connector, from the filename (PgExample→pg, BunSqlPostgresExample→bun_sql_postgres, …); '' for the documentation/ per-db generators
    is_doc      INTEGER NOT NULL,         -- 1 when under src/examples/documentation/ (renders into docs)
    ordinal     INTEGER NOT NULL,         -- 1-based index of the example within the file
    start_line  INTEGER NOT NULL,
    end_line    INTEGER NOT NULL
);
-- The legacy examples carry their cell coordinates in the file NAME (no folder structure), so
-- these derived columns let --coord address them by db/version/connector like the matrix cells.
CREATE INDEX idx_example_block_cell ON example_block(db, version, connector);

-- One row per OCCURRENCE (line/col in the example .ts file); count = COUNT(*).
CREATE TABLE example_ref (
    example_block_id   INTEGER NOT NULL REFERENCES example_block(id),
    symbol_name        TEXT NOT NULL,     -- identifier/member name (name-based fallback)
    line               INTEGER NOT NULL,  -- 1-based line of this occurrence in the example .ts file
    col                INTEGER NOT NULL,  -- 1-based column of the name token
    resolved_symbol_id INTEGER REFERENCES symbol(id),  -- checker-resolved declaration (NULL = binds outside the indexed lib)
    resolved_member_id INTEGER REFERENCES member(id)   -- …and the member, when it resolves to one
);

CREATE INDEX idx_example_block_file ON example_block(file);
CREATE INDEX idx_example_ref_name   ON example_ref(symbol_name);
CREATE INDEX idx_example_ref_block  ON example_ref(example_block_id);
CREATE INDEX idx_example_ref_rsym   ON example_ref(resolved_symbol_id);
CREATE INDEX idx_example_ref_rmem   ON example_ref(resolved_member_id);

-- ── negative-type dimension (test/db/<db>/types.negative/) ───────────────────
-- The negative-type cells assert, with a // @ts-expect-error directive, that a misuse of the API
-- must NOT compile. They are compile-only (the wrapping function is never run), so the
-- generic test dimension only sees a coarse block per file. neg_type records ONE row per
-- @ts-expect-error directive: the rule (the comment text), the asserted-to-fail code line,
-- and the enclosing scope to read. neg_type_ref links the API names in the enclosing
-- statement (resolved) — "WHICH API + line does this negative assertion guard?". The
-- directive can sit on a statement OR on a property inside an object literal; target_line
-- is the next code line either way, and the refs come from the statement that contains it.
CREATE TABLE neg_type (
    id          INTEGER PRIMARY KEY,
    file        TEXT NOT NULL,        -- test/db/<db>/types.negative/<file>.test.ts
    db          TEXT NOT NULL,        -- postgres, mysql, mariadb, oracle, sqlite, sqlserver
    marker_line INTEGER NOT NULL,     -- line of the // @ts-expect-error directive
    target_line INTEGER NOT NULL,     -- the code line asserted to fail compilation (next code line)
    description TEXT,                 -- the rule: text after @ts-expect-error
    snippet     TEXT,                 -- trimmed target line
    scope       TEXT                  -- enclosing function/test name (the context to read)
);

-- One row per API name in the enclosing statement of a negative assertion, resolved.
CREATE TABLE neg_type_ref (
    neg_type_id        INTEGER NOT NULL REFERENCES neg_type(id),
    symbol_name        TEXT NOT NULL,
    line               INTEGER NOT NULL,
    col                INTEGER NOT NULL,
    resolved_symbol_id INTEGER REFERENCES symbol(id),  -- the negatively-tested declaration (NULL = domain/local)
    resolved_member_id INTEGER REFERENCES member(id)
);

CREATE INDEX idx_neg_type_db       ON neg_type(db);
CREATE INDEX idx_neg_type_ref_name ON neg_type_ref(symbol_name);
CREATE INDEX idx_neg_type_ref_neg  ON neg_type_ref(neg_type_id);
CREATE INDEX idx_neg_type_ref_rmem ON neg_type_ref(resolved_member_id);

-- NOTE: the old doc_block / doc_ref dimension (which read docs/*.md directly) was
-- REMOVED — it was a less precise duplicate of the documentation dimension above
-- (doc_test_block / doc_test_ref), which covers every snippet (kind test|fn|decl)
-- with exact positions, per db, and verification. That is why the doc tests exist.

-- ── version_gate (schema v4): compatibility-version branches in the SqlBuilders ─
-- One row per comparison against a per-db compatibility-version field (e.g.
-- this._connectionConfiguration.compatibilityVersion < 18_000_000). The navigation
-- target for version/matrix work: which methods branch on which breakpoint. Answers
-- "how does this codebase gate by version, and at which breakpoints" (see REPORT_MODEL_V2 E).
CREATE TABLE version_gate (
    id               INTEGER PRIMARY KEY,
    module_id        INTEGER NOT NULL REFERENCES module(id),
    scope_name       TEXT,                 -- enclosing method/function (NULL at top level)
    scope_start_line INTEGER,
    scope_end_line   INTEGER,
    field            TEXT NOT NULL,        -- the gated field, e.g. 'compatibilityVersion'
    operator         TEXT NOT NULL,        -- <, <=, >, >=, ===, !==
    breakpoint       TEXT NOT NULL,        -- the literal compared against, e.g. '18_000_000'
    line             INTEGER NOT NULL,
    col              INTEGER NOT NULL
);
CREATE INDEX idx_version_gate_module ON version_gate(module_id);
CREATE INDEX idx_version_gate_scope  ON version_gate(scope_name);
CREATE INDEX idx_version_gate_bp     ON version_gate(breakpoint);

-- ── sql_emit (schema v4): SQL string literals emitted by the SqlBuilders ──────
-- One row per string literal that looks like emitted SQL inside an _append*/_build*
-- (or any sqlBuilders-area) method. The build-side bridge for an emission bug: from a
-- bad SQL token ('returning old.', 'collate') to the code that emits it (REPORT_MODEL_V2
-- D). Searched by --emits-keyword <fragment> via a substring match on literal.
CREATE TABLE sql_emit (
    id               INTEGER PRIMARY KEY,
    module_id        INTEGER NOT NULL REFERENCES module(id),
    scope_name       TEXT,                 -- enclosing method/function
    scope_start_line INTEGER,
    scope_end_line   INTEGER,
    literal          TEXT NOT NULL,        -- the string-literal SQL fragment (lowercased copy in literal_lc)
    literal_lc       TEXT NOT NULL,        -- lower(literal) for case-insensitive LIKE
    line             INTEGER NOT NULL,
    col              INTEGER NOT NULL
);
CREATE INDEX idx_sql_emit_module ON sql_emit(module_id);
-- (no index on literal_lc: --emits-keyword uses a leading-wildcard LIKE '%frag%', which no index
--  can serve; sql_emit is small (~1.8k rows) so the scan is cheap.)

-- ── todo_marker (schema v4): ALL // TODO[...] markers across the test matrix ──
-- One row per // TODO comment, with its bracketed MODIFIER captured as tag (e.g. 'BUG',
-- 'PERF', …; NULL for a plain // TODO). TODO[BUG] is the channel the test-generator uses to
-- flag a real-DB divergence to the bug-fixer (test/BUGS.md itself is read directly; it's tiny)
-- and is surfaced by --bugs (tag='BUG'); the other tags are indexed for completeness even
-- though nothing consumes them yet. "Is this already a known divergence?" (REPORT_MODEL_V2 C/D).
CREATE TABLE todo_marker (
    id    INTEGER PRIMARY KEY,
    file  TEXT NOT NULL,                   -- the file carrying the marker
    line  INTEGER NOT NULL,
    tag   TEXT,                            -- the bracketed modifier (BUG, PERF, …); NULL for a bare // TODO
    text  TEXT NOT NULL,                   -- the marker text after the modifier
    scope TEXT                             -- nearest enclosing test/describe name, when known
);
CREATE INDEX idx_todo_marker_file ON todo_marker(file);
CREATE INDEX idx_todo_marker_tag  ON todo_marker(tag);

-- ── producer (schema v4): public calls whose RETURN TYPE yields a receiver ────
-- One row per public member (method/function) whose return type resolves to an indexed
-- interface/class symbol. Answers case B's "what public call returns an object I can call
-- <method> on" — the upstream/receiver question, the inverse of the call chain. Given a
-- searched member, find its owner interface(s), then the producers of those owners.
CREATE TABLE producer (
    member_id          INTEGER NOT NULL REFERENCES member(id),   -- the producing member
    produces_symbol_id INTEGER NOT NULL REFERENCES symbol(id)    -- the symbol it returns (interface/class)
);
CREATE INDEX idx_producer_produces ON producer(produces_symbol_id);
CREATE INDEX idx_producer_member   ON producer(member_id);

-- ── emitted_sql (schema v4): the asserted SQL snapshots (tests + docs) ────────
-- One row per toMatchInlineSnapshot string that looks like SQL, in a matrix test cell
-- ('test') or a generated documentation cell ('doc'). No block FK: the searcher joins by
-- file + line-containment against test_block (file/start_line/end_line) or doc_test_block
-- (gen_file/gen_start_line/gen_end_line), so this stays decoupled from those extractors.
-- The emitted-sql section shows the SQL a symbol's tests/docs assert (cases C/D/F). Legacy
-- examples are not covered here (the legacy suite uses runtime assertions, not inline snapshots).
CREATE TABLE emitted_sql (
    id     INTEGER PRIMARY KEY,
    source TEXT NOT NULL,                  -- 'test' (matrix cell) | 'doc' (generated documentation cell)
    file   TEXT NOT NULL,                  -- the *.test.ts carrying the snapshot
    line   INTEGER NOT NULL,               -- line of the toMatchInlineSnapshot call
    sql    TEXT NOT NULL                   -- the SQL text (snapshot quotes stripped)
);
CREATE INDEX idx_emitted_sql_file ON emitted_sql(file, line);
`
