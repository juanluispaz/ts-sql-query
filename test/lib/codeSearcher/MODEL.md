# `tests:where-is` — the report model (design rationale, as built)

The **why** behind the searcher's shape. It was discovered by walking six worked case studies of
the test-writing agent (a deep/hidden coverage gap; a gap needing per-connector setup; a
real-vs-mock divergence; an emission bug where the stack is useless; a new DB version; a post-fix
stale-SQL sweep) — kept in [`CASE_STUDIES.md`](./CASE_STUDIES.md) — and distilling what each *intent*
actually needs. This doc records that model **as it ended up built** — what shipped, why, and what
was deliberately left out.

- **Using it:** [`../../CODE_SEARCH.md`](../../CODE_SEARCH.md) (agent-facing flags + how to read a report).
- **Implementing it:** [`CODE_SEARCHER.md`](./CODE_SEARCHER.md) (modules, queries) and
  [`../codeIndexer/CODE_INDEXER.md`](../codeIndexer/CODE_INDEXER.md) (the index it reads).

---

## 0. The realization — a report engine with intents

The searcher is **not one report**. It's a report engine where the agent picks a **door** (what to
search), then composes **levelled sections** (what to show) under a single **coordinate focus** (which
matrix cells). The case studies cluster into four intents; the same machinery serves all of them,
and **`--for <intent>` presets the section set**:

| Intent | Triggered by | Door | Sections it raises | Anti-pattern |
|---|---|---|---|---|
| **bare** | "I want only one section" | any | **nothing** — every section `none`; add the one(s) you want explicitly (`--for bare --surface own`). Saves a dozen `--<section> none` | — |
| **coverage-gap** | a red `src/` line, or a name to cover | `--search-location` (enclosing) · `--search` | classification · `--chain full` · `--ref-return` · simplified · docs · `--tests gaps` · examples · `--cell-caveats` | — |
| **propagation** | the canonical cell is baked; copy it to siblings | `--search` (`--coord '*/newest'`) | classification · `--tests gaps` · examples · `--cell-caveats` · `--chain none` | replicating ≠ finding — no chain/producers needed |
| **type-bug** | a type-resolution error on a name (case J) | `--search <name>` | `--declared full` · `--signature full` · `--ref-type-arg full` · `--neg-types full` · `--bugs` · `--limitation` · **`--chain none`** | the TYPE twin of emission-bug: the error is in the **signature**, never a frame — chasing the call-chain is wasted |
| **emission-bug** (real-vs-mock) | "this test fails on the real DB" (a test path) | test-line `--search-location` · `--emits-keyword` | `--emitted-sql` · `--ref-implements` (incl. **non-overriders**) · `--version-gates` · `--bugs` · `--limitation` · **`--chain none`** | `--chain` is useless here (build→execute is data-flow) |
| **version-work** | a DB release note / breakpoint | `--search compatibilityVersion` · `--emits-keyword` | `--version-gates full` · tests · `--bugs` · `--limitation` | starting from one statement kind hides the others |
| **post-fix-sync** | a merged fix changed the emitted SQL | `--emits-keyword` · `--search <feature>` | `--emitted-sql` · docs · examples · tests detail · `--bugs` | a `--update-snapshots` run leaves examples + docs stale |

The three axes are orthogonal and combine freely:

1. **WHAT** — the door (exactly one selects the target). §2.
2. **WHICH sections × level** — one levelled flag per section (`none` hides; defaults reproduce the
   classic report). §3.
3. **WHICH cells** — the single `--coord` focus + within-section narrowing. §4.

**Combine by default.** The biggest win across the cases: firing several sections at once turns ~7
search rounds into ~2. Single-section calls are for *re-focusing* after a broad orient, never the
opening move. The `--for` presets bundle the door+section set; explicit flags still override. (One
preset value is coord-aware: `coverage-gap`/`propagation` carry `--cell-caveats` at `summary` — the
per-cell map — while browsing, and auto-raise it to `full` — the markers — once a `--coord` scopes the
work. The level *meanings* stay fixed; only the preset's pick of level tracks the `--coord`.)

---

## 1. Cross-cutting lessons (the *why*)

These recurred across the cases and shaped the model. Each notes how it landed.

- **L1 — Most triggers are *data* preconditions invisible to the call graph.** A line fires because
  of an *argument literal* (`'asc insensitive'`), a *receiver type* (a uuid column), or a
  *compatibility version* (PG≥18) — not because "caller X called it". *Built:* classification names
  the **kind / public-surface verdict / exposing interfaces**, and the **call-chain** + **producers**
  + **version-gates** surface the route and the gate; the agent reads the precondition from those.
  (An auto-generated "fires when …" sentence was *not* built — it needs branch reasoning.)
- **L2 — The build→execute gap breaks both stacks.** SQL is *built* in one call and *executed* later
  as a string, so the runtime error stack (only the execute frame) *and* the static call-chain both
  fail to reach an emission bug. *Built:* the **`emitted-sql`** section + the **`--emits-keyword`**
  door (a SQL token → the `SqlBuilder` code that emits it); the `emission-bug` preset sets
  **`--chain none`**.
- **L3 — Absence is a finding.** The canonical emission bug was a *missing* override (`SqliteSqlBuilder`
  doesn't override `_useUpdateOldValueInFrom()` while every sibling does); no chain can express an
  absence. *Built:* **`implemented-by`** lists the base, the overriders **and the non-overriders**
  ("inherits it, does not override").
- **L4 — The receiver question ≠ the reach question.** For a method on an intermediate fluent type,
  "who reaches it" is useless; the agent needs "**what public call returns an object I can call this
  on**". *Built:* **`producers`** (members whose return type resolves to the owner interface).
- **L5 — Dimensions earn their keep per intent.** `examples` is marginal in one gap, *load-bearing*
  in another (per-connector uuid setup); `bugs`/`emitted-sql` only matter for debugging;
  `version-gates` only for version work. *Built:* every section is independently levelled, default
  `none` for the intent-specific ones, so each intent pays only for what it raises.
- **L6 — Coordinates are the unit of test work.** Every test task is "this cell first
  (postgres/newest/pg), then propagate". *Built:* `--tests detail|gaps`, and `--coord` is the single
  matrix-coordinate focus (§4). (A "version-split" view — same test, different snapshot across a
  breakpoint — was *not* built; `gaps` + `--coord '*/<version>'` cover the practical need.)
- **L7 — SQL lives in more than one place.** The same SQL is asserted in **test snapshots** and
  rendered in **docs** (the doc-code extractor turns docs into generated, then indexed, tests). A
  `--update-snapshots` fixes only the tests; the docs go stale silently. *Built:* **`emitted-sql`**
  aggregates **tests + docs** and labels each by refresh kind (tests auto via `--update-snapshots`;
  docs user-owned, regen via `codegen:doc-code`). Legacy `src/examples/` use *runtime* assertions,
  not inline snapshots, so their SQL is **not** in `emitted_sql` — but the examples dimension is
  still `--coord`-addressable by cell (§4).
- **L8 — Ownership is part of the answer.** Doc SQL and `test/templates/doc-code/` are the human's
  domain; the agent **locates but doesn't edit** them — `emitted-sql` labels the doc source as
  "user-owned". And `test/BUGS.md` / `test/LIMITATIONS.md` are just *read* (small files); only the
  scattered `// TODO[BUG]` / `// TODO[LIMITATION]` markers are indexed (§5).
- **L9 — A caveat is scoped two ways, and a wave needs both.** A disabled-test marker matters either
  because it **names the symbol** you're touching (a known bug on `virtualColumnFromFragment`) or because
  it's declared on the **cell** you're writing into (MariaDB UPDATE…RETURNING needs 13.0.1+ — true of *any*
  work in that cell, whatever the symbol). The feature-centric intents catch the first; coverage-gap /
  propagation are blocked by the second. *Built:* **name-scoped** `--bugs`/`--limitation`/`--not-applicable`
  (markers mentioning the symbol, in the feature-centric presets) **and** **coord-scoped** `--cell-caveats`
  (markers in the `--coord` cells, in coverage-gap/propagation). A wave is invalidated by a cell caveat the
  name filter alone is blind to (case G). *Discovered post-A–F by building case G before deciding.*
- **L10 — Three first-class caveat CATEGORIES, not two.** A disabled test carries `TODO[BUG]` (src/ defect,
  re-enabled when fixed), `TODO[LIMITATION]` (not covered yet / env, *might* re-enable), or **`NOT-APPLICABLE`**
  (a *permanent dialect boundary* — never runs here, by design; the test runs+validates in the cells whose
  dialect supports it). The third is **not** a `TODO`: the word implies pending work, which is exactly wrong
  for a boundary, and folding it into LIMITATION would mislabel a deliberate `never` as actionable debt.
  *Built:* the indexer stores `tag='NOT-APPLICABLE'` separately; the searcher gives it its own name-scoped
  section `--not-applicable` and a distinct `[NOT-APPLICABLE]` category in `--cell-caveats` — never merged
  into limitations. *(Added per a second agent's feedback; the audit `tests:audit` enforces the marker, the
  searcher classifies it.)*

---

## 2. WHAT — the doors (exactly one)

| Door | Resolves to |
|---|---|
| `--search <name>` | an exact symbol/member name |
| `--search-pattern <regex>` / `--search-pattern-summary <regex>` | matching names → a full report per match / a compact pick-list |
| `--search-location <path:line>` (`--location-target enclosing`, default) | the enclosing function/member — the **concrete overload** at that line (landing on the impl catch-all un-focuses to the whole function) |
| `--search-location <path:line>` `--location-target enclosing-all` | the enclosing function but the **whole** of it — every overload (the only way for an interface method, with no impl line) |
| `--search-location <path:line>` `--location-target callees` | the function(s) **invoked on** that line (≥1 → pick-list) |
| `--search-location <path:line>` `--location-target produces` | the **type the enclosing function returns** → that type's definition (the forward "go to type definition"; reads the `producer` dimension forward) |
| `--search-location <path:line>` `--location-target types` / `types-all` | the **indexed types referenced** on the line / across the **whole function** (every overload + impl body, via the enclosing FK) → each one's definition. A **terminal navigation report** (`type · role · defined-at(+span)` + site count), NOT a section set — reads `reference` forward; the dual of `--ref-type-arg` |
| `--search-location <path:line>` `--location-target brand` | the **brand marker** a computed-key line `[sym]: T` keys on → the marker symbol (a full report; add `--ref-brand` for its branded family). Reads `reference` role=`brand` forward; the dual of `--ref-brand` |
| `--search-location <test-file>:line` | **inverse search**: the enclosing `test_block` + the public API it exercises |
| `--emits-keyword <sql-fragment>` | the `SqlBuilder` code that emits that SQL token (the build-side bridge) |

`--search-mode` (the old WHAT×HOW "how" axis) was **removed** — the chain/name searches are now
levelled sections (`--chain`, `--name-search`). Doors that the version-work intent once imagined
(`--feature`, a `--matrix` structural door) were **not built**; version work is served by
`--search compatibilityVersion --version-gates full` + `--emits-keyword`.

---

## 3. Sections × levels

One levelled flag per section; `none` hides it. Base levels `none|summary|full`; some add **shape**
levels. The default column reproduces the classic report when no flag is passed. **The level arg is
optional:** a bare flag turns the section on at its lightest non-`none` level (`levels[1]` — summary /
strict / own / full), so `--ref-brand` ≡ `--ref-brand summary` — matching the muscle memory of "type the
flag to turn it on". A token starting with `-` is never consumed as a level (bare flags don't eat the next
flag).

| Section flag | Levels (default **bold**) | Content |
|---|---|---|
| `--classification` | none·**summary**·full | verdict (public / public-surface / internal / not found) + kind +, for a member, the public interfaces exposing it |
| `--declared` | none·**summary**·full | declaration sites (kind · path:line · first JSDoc line) |
| `--signature` | none·**summary**·public-interface·public-impl·internal·full | signatures + JSDoc, `[public]`/`[public impl]`/`[internal]`, simplified-map form first |
| `--chain` | none·**strict**·broad·full | call-chain; `full` = the whole internal stack |
| `--ref-return` | **none**·summary·full | **references-by-role:** referenced **as a return type** — members whose return type yields a receiver of this type (L4) |
| `--ref-implements` | none·**summary**·full | **references-by-role:** referenced **in implements/extends** — overriders **and non-overriders** (L3) + the simplified def(s) realized |
| `--ref-type-arg` | **none**·summary·full | **references-by-role:** referenced **as a type argument** (`Outer<This>`) — a type alias's blast radius across signatures (the type-bug, case J); v5 `reference` |
| `--ref-param` | **none**·summary·full | **references-by-role:** referenced **as a parameter type**; v5 `reference` |
| `--ref-field` | **none**·summary·full | **references-by-role:** referenced **as a field/property type**; v5 `reference` |
| `--ref-new` | **none**·summary·full | **references-by-role:** the class referenced **in a construction** (`new This(…)`); v5 `reference` |
| `--ref-property` | **none**·summary·full | **references-by-role:** the member referenced **via property access** (`x.member`, not a call) — cases B/L; v5 `reference` |
| `--ref-brand` | **none**·summary·full | **references-by-role:** a `unique symbol` used **as a brand key** (`[sym]: T` — the phantom/branded-type markers the compiler discriminates on, `src/utils/symbols.ts`) — case L; `reference` role=`brand` |
| `--surface` | **none**·own·all·full | the **members of the declaring type(s)**: a TYPE seed → its members; a MEMBER seed → its siblings (one `surfaceOf` query, both entry points). Level = **inheritance scope**: `own`=direct; `all`=+inherited(`extends`)+implemented(`implements`), flat; `full`=broken down by declaring type (incl. interfaces). Every member carries `path:line` + span |
| `--version-gates` | **none**·summary·full | `compatibilityVersion` comparisons, their breakpoint + the gated method |
| `--docs` | none·**summary**·by-page·full | where explained (page · heading · line · kind); `full` keeps every occurrence |
| `--simplified` | none·**summary**·full | reconcile (completeness vs real API + drift) + where the member is shown inside a simplified-def snippet |
| `--emitted-sql` | **none**·summary·full | the asserted SQL from **tests + docs**, de-duped with the asserting cells + refresh kind (L2, L7) |
| `--tests` | none·**summary**·detail·gaps | rollup `newest/total` per db / per-test / who's-**missing** per db |
| `--examples` | none·**summary**·full | legacy `src/examples/` occurrences (L5) |
| `--neg-types` | none·**summary**·full | `@ts-expect-error` assertions — `summary` = count per db; `full` = each rule comment + rejected snippet + file:line (to model a new lock, cases H/I) |
| `--bugs` | **none**·summary·full | `// TODO[BUG]` markers **naming the symbol** — a src/ defect (→ `test/BUGS.md`); name-scoped |
| `--limitation` | **none**·summary·full | `// TODO[LIMITATION]` markers **naming the symbol** — not covered yet / env (→ `test/LIMITATIONS.md`); name-scoped |
| `--not-applicable` | **none**·summary·full | `// NOT-APPLICABLE` markers **naming the symbol** — a *permanent dialect boundary* (runs in the cells whose dialect supports it); name-scoped, a DISTINCT category from limitation (L10) |
| `--cell-caveats` | **none**·summary·full | BUG/LIMITATION declared on cells — coord-scoped, *not* by symbol. **Level = view:** `summary` = per-cell map (each cell + counts), `full` = the markers (cell-prefixed); `--coord` only filters which cells. Case G |
| `--name-search` | **none**·full | name-based discovery across every dimension (high recall) |
| `--refs` | none·summary·full | **shortcut, not a section:** sets the whole `--ref-*` family (`--ref-return` + `--ref-implements`) at one level; explicit per-role flag overrides, and `--refs` itself beats a `--for` preset |

**References to this element, by role.** `--ref-return` and `--ref-implements` are two views of one
question — *where is this element referenced, and how?* — kept as **separate sections** so the agent
pays only for the role it needs (granularity = low noise), with `--refs` as the all-at-once shortcut.
The **forward duals** live on `--search-location` (from a line *outward* to what it references):
`--location-target produces` (→ the type the enclosing fn returns, reads `producer`),
`--location-target types` / `types-all` (→ the indexed types referenced on the line / across the whole
function, reads `reference`), and `--location-target brand` (→ the marker symbol a `[sym]: T` line keys
on, reads `reference` role=`brand`). `--ref-type-arg` is the reverse of `types`; `--ref-brand` the reverse
of `brand`. The reverse family by role: `--ref-return` (producer) and `--ref-implements` (heritage) read
existing dimensions; **`--ref-type-arg`** (type argument — the type-bug, case J), **`--ref-param`**
(parameter type), **`--ref-field`** (field type), **`--ref-new`** (construction), **`--ref-property`**
(property access — cases B/L) and **`--ref-brand`** (brand key — case L) read the **`reference` dimension**
(§5). `--chain` (call-graph walk) and `--name-search` (flat) stay outside the family by nature. See §6.

**`--location-target types` / `types-all` are a navigation report, not a section** — a third "terminal
list, no section set" shape alongside `--search-pattern-summary` (the recalled precedent: a list that
needs the *which-one?* decision before `--search`) and the test-line inverse search ("the banner IS the
report"). They resolve to *many* types, so rendering the section set is meaningless without first picking
one; instead they print `type · role · defined-at(+span)` (with a site count for `types-all`) and ignore the
`--<section>` flags. `types` = the exact line (concrete overload), `types-all` = the whole function (all
overloads + impl body, via the traceable enclosing FK) — the same `enclosing`/`enclosing-all` axis.

Not built: a `--matrix` (cell-symmetry) section and a tests `version-split` shape — see §6.

---

## 4. WHICH cells — the `--coord` focus + within-section narrowing

The filter design **collapsed** to a single global focus. An earlier draft had a `--db`/`--version`/
`--connector` trio (mirroring the CLI's coordinate + `--run-versions`/`--run-connectors`); it became
**one** `--coord` because connectors are a *closed set* (a substring `--connector pg` wrongly matched
`pglite`), and coordinates give exact values + glob/brace.

- **`--coord <db[/version[/connector[/file]]]>`** — the single focus filter, glob `*` + brace `{a,b}`,
  **repeatable** (union). It focuses **every db/cell-aware section**, best-effort per dimension:
  - **tests · emitted-sql (test rows) · legacy examples** match the **full cell** (db/version/
    connector, plus the test-file basename at the 4th level). Examples derive their cell from the
    *filename* (`PgExample`→`postgres/newest/pg`, `MariaDBExample-compatibility`→`mariadb/oldest/mariadb`).
  - **docs · shown-in-simplified-def · neg-types · emitted-sql (doc rows)** match the **db segment**
    only (no version/connector axis); db-agnostic `general` docs are always kept.
  - A coord matching no indexed cell/file is an **error** (nullglob). The 4th (file) segment is a
    glob on the basename and **coexists** with `--file-name-pattern` (both AND).
- **Within-section narrowing** (orthogonal to the matrix axes): `--test-name-pattern <regex>`,
  `--file-name-pattern <regex>` (tests + doc pages), `--owner-kind`/`--owner` (declared/signature),
  `--breakpoint <n>` (version-gates).
- **`--index <path>`** selects which code-index file to read (default the generated one) — rarely used.

Not built: a `--real-capable` real/mock annotation, and terminal `--list-sections` / `--list-version-files`
views — see §6.

---

## 5. What the index provides (schema v4)

The v3 base — `symbol` / `member` / `heritage` / `invocation` / `reconcile` / `test_block` /
`doc_test_block` / `example_block` / `neg_type` (+ their `*_ref`) — already powered classification,
signature, chain, implemented-by, docs, simplified, tests, examples, neg-types. The intents above
added **five schema-v4 dimensions** plus the **v5 `reference`** dimension (built in `extractExtras.ts`,
asserted in `verify.ts`):

| Dimension | Powers | How it's derived |
|---|---|---|
| `version_gate` | `--version-gates` | `compatibilityVersion <op> <breakpoint>` comparisons in the SqlBuilders (AST) |
| `sql_emit` | `--emits-keyword` | SQL string literals in the SqlBuilders (substring match on `literal_lc`) |
| `producer` | `--ref-return` | members whose return type resolves (checker) to an indexed interface/class |
| `todo_marker` | `--bugs` (`tag='BUG'`), `--limitation` (`tag='LIMITATION'`), `--not-applicable` (`tag='NOT-APPLICABLE'`) — all name-scoped; `--cell-caveats` (all three, coord-scoped, counted per category) | every `// TODO[<tag>]` **and** `// NOT-APPLICABLE:` in `test/` |
| `emitted_sql` | `--emitted-sql` | `toMatchInlineSnapshot` SQL in test + documentation cells; the searcher joins it to the block by file + line-containment |
| `reference` (v5) | `--ref-type-arg`/`--ref-param`/`--ref-field`/`--ref-new`/`--ref-property` (roles `type-arg`/`param`/`field`/`new`/`property`) | checker-resolved references to an indexed element by syntactic role; resolution-gated (empty under `--no-resolve`) |

`example_block` also gained `db`/`version`/`connector` columns (filename-derived) so `--coord`
addresses the legacy examples by full cell. `test/BUGS.md` and `test/LIMITATIONS.md` are read
directly by the agent, not indexed.

---

## 6. Deliberately not built (and why)

- **`--feature` / `--matrix` doors + a matrix-symmetry section** (the version-work intent's structural
  half). Version work is currently served well enough by `--version-gates full` + `--emits-keyword`;
  the "what files must a new version cell mirror" view is `tests:audit` / `tests --list-files` territory.
- **tests `version-split`** (same test, different snapshot across a breakpoint). `--tests gaps` +
  `--coord '*/<version>'` cover the practical need.
- **`--real-capable`** (annotate cells real/mock-capable). The index is static and can't know a *run's*
  outcome; the agent runs the failing test itself.
- **`--list-sections` / `--list-version-files`** terminal views. Sections already self-omit when empty;
  the file-list is the main CLI's job.
- **An auto "fires when …" precondition sentence** in classification (L1). It needs branch-condition
  reasoning; the agent infers the precondition from chain/producers/version-gates instead.
- **`--for negative-types` (proposal E) as a dedicated preset.** Reconsidered against cases H/I and
  rejected: the fix flow's negative half is already covered — `--for emission-bug` *already* shows
  `--neg-types` (it never suppresses the `summary` default), so the only real gap was that `--neg-types`
  showed a count, not the rules. That gap is now closed (`--neg-types full` lists each rule comment +
  rejected snippet + file:line). A separate preset would re-split the two-step fix into two reports for
  no gain. (Distinct from the **shipped `--for type-bug`** preset: that one is centred on the type
  *signature* + the alias's blast radius via `--ref-type-arg`, and merely *includes* `--neg-types full`
  as one section — a type-resolution-bug orient, not a negative-types-only lens. No overlap.)
- **A "negative-coverage gap" lens** (declared restrictions/holes without a matching `@ts-expect-error`).
  Out of the searcher's scope by design: knowing *what type-safety is missing* is the job of a future
  **type-coverage** tool (the type-level equivalent of runtime code coverage), not a static index
  query — the searcher can show "no lock here + here's the documented hole", but deciding what *should*
  be invalid is dialect/type semantics (the `--real-capable` wall again). Case H surfaced the need and
  drew the boundary.
- **Auto-surfacing `--cell-caveats` at the no-`--coord` coverage-gap orient** (scope caveats to the
  symbol's gap cells automatically). Verified against the index, then rejected: limited tests are
  *commented out* → no `test_block` → the limited cells *are* genuine gaps, so a `--cell-caveats`
  does catch them. But two things sink the auto-scope: (1) `--cell-caveats` lists **all** caveats in a
  cell, so auto-firing across every gap cell surfaces caveats unrelated to the wave (an `orderBy` wave
  into mariadb would show the RETURNING limitation — noise); (2) it's premature — `--cell-caveats`
  already rides the `coverage-gap`/`propagation` presets, so it fires the moment the agent adds a
  `--coord`, which is exactly when it picks the cells it will write into. The explicit focused call is
  the precise, low-noise tool; the no-coord orient is a pure overview. Building the mini-case (Case G
  follow-up) is what surfaced this — the guardrail is already at the right moment.
- **`--search-body <regex>` (a door over declaration BODIES; case K).** Rejected: it would find a helper
  by the *shape* of its definition (reuse-don't-reinvent), but when the shape references a **named** type,
  `--search-pattern <token>` over that token already surfaces the sibling aliases — the common case is
  covered. The only residue is a *purely structural* shape with no shared named token (`T | null`), which
  isn't nameable and is honest `grep` territory — the same wall as F's non-inline example SQL. A new door
  buys a rare case `grep` already serves. (The suspected "exported-only" scope of `--search-pattern` that
  surfaced alongside was **verified false** — `nameIndex` has no visibility filter; the miss was a
  sliced-output artifact.)

---

## 7. One-line model

> A **report engine** with three orthogonal axes — a **door** (WHAT, intent-chosen), a set of
> **levelled sections** (WHICH content, one flag each, `none` = off), and a single **`--coord`**
> matrix focus (WHICH cells) — where the agent **combines sections by default** and `--for` presets
> the intent. The recurring truth that shaped it: **what triggers a line is usually data (an argument,
> a receiver type, a version), and the SQL is built before it runs** — so reachability comes from the
> chain/producers/version-gates, and emission bugs are found through the SQL (`--emitted-sql` /
> `--emits-keyword`), not the stack.
