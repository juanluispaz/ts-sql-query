# Code Searcher — using it

**Search the codebase for a symbol** and get back, in one report, where it lives, how
it's reached from the public API, where it's explained in the docs, and which tests
cover it — across `src/`, the `test/` matrix, the published `docs/` and the legacy
`src/examples/`, without grepping four worlds by hand.

The searcher is the **feature**. It runs against a queryable **SQLite map of the
codebase** (the *code index*), which is just a **prerequisite** you build once.

This is the **usage** doc — what you run and how to read the answer. **If you're
using the tool, this file is enough**; the implementation references under
[`lib/codeSearcher/`](./lib/codeSearcher/) and [`lib/codeIndexer/`](./lib/codeIndexer/)
exist for the person modifying the tools, not for the agent consuming them.

- [This tool vs. textual search](#this-tool-vs-textual-search)
- [The command you'll use](#the-command-youll-use)
- [When you'd use it](#when-youd-use-it)
- [Reading the report](#reading-the-report)
- [Worked example — internal symbol to docs & tests](#worked-example--internal-symbol-to-docs--tests)
- [Staleness — when to rebuild](#staleness--when-to-rebuild)

## This tool vs. textual search

**This tool understands TypeScript; `grep` understands text.** The searcher runs against a *resolved
semantic index* — the compiler's view of the code: who declares what, what's public vs internal, which
call resolves to which member, how a type is used, where the same symbol surfaces across `src/`, the
`test/` matrix, `docs/` and `src/examples/`. `grep` matches characters. Pick the one that fits the
*question*, not the habit.

**Reach for `tests:where-is` when the question is semantic or structural:**

- **Existence & visibility** — *does this symbol exist? public, public-surface, or internal?* It knows the
  real public surface (a fluent interface vs a class impl), not just that the text appears somewhere.
- **Reachability** — *what public API reaches this internal helper?* The call-chain is **type-resolved**, so
  it doesn't conflate a dozen same-named `__toSql` methods the way a name-grep would.
- **Type usage by role** — *where is this type used as a type argument / parameter / field / `new` / a brand
  key?* Resolved to the exact indexed type — `grep "Foo"` can't tell a type argument from a comment.
- **Cross-world joins** — *where is it explained in docs, which simplified def reflects it, how saturated is
  its matrix coverage?* One report across four worlds, instead of grepping each by hand.
- **Structure** — *what does this type implement, what else can I call in this state, which overload sits at
  this line?* Overload-aware, brand-aware, owner-aware.

**Reach for textual search (`grep`/`rg`) when the question is lexical or mechanical:**

- **Exact occurrence counts & mass-edit anchors** — byte/line positions for a `sed`/`perl` pass, or
  verifying a count dropped to 0. The index resolves and de-duplicates; it is the wrong ruler for "how many
  literal times".
- **Text in files the index doesn't parse** — a `package.json` script name, an env-var or CLI-flag string,
  a key in a config/JSON file, a shell snippet. The index parses **TypeScript + docs** (`src/`, `test/`,
  `docs/`, `src/examples/`); anything outside that surface is `grep`'s job.
- **A quick existence check when the index is stale** and you can't rebuild — `grep` confirms a string is
  present; just don't trust it for *public vs internal* or *reachable from where*.

> **Check before you `grep` — a lot of "just text" is already modeled** (use the tool, it's scoped and
> resolved): **test names** (`--test-name-pattern`, `--tests`), **where a symbol is explained in docs**
> (`--docs` — symbol-scoped, not free-text doc search), **`// TODO[BUG]` / `[LIMITATION]` markers**
> (`--bugs` / `--limitation` / `--cell-caveats`), **emitted SQL fragments** (`--emits-keyword`, a substring
> match over emitted SQL), and every declared **symbol/member name** (`--search` / `--search-pattern`).
> `grep` is for what falls *outside* those — including arbitrary prose *inside* a doc page.

Rule of thumb: if your question is about **the type system, the call graph, the public surface, or how code
connects across src/docs/tests**, use the tool. If it's about **literal text or byte-level edits**, use
`grep`. The deeper "is this assignment type-correct?" question is neither — that's the **compiler** (a
minimal repro + `tsgo`/`tsc`); the searcher *locates* the types, it doesn't *decide* assignability.

## The command you'll use

The invocation has three orthogonal parts (the same shape as `--help`): pick **one door** (WHAT
to search for), shape the report with **one levelled flag per section** (`none` hides it; defaults
reproduce the classic report), and narrow the data dimensions with **filters**. `--for <intent>`
presets a section set.

```
tests:where-is  <door>  [<section> <level>]…  [<filter>]…  [--for <intent>]  [--index <path>]
```

```bash
bun run tests:where-is --search __addOrderBy                              # an exact name
bun run tests:where-is --search-pattern 'orderBy'                         # regex → full reports
bun run tests:where-is --search-location src/sqlBuilders/AbstractSqlBuilder.ts:1119               # a source line → enclosing fn
bun run tests:where-is --search-location …:1119 --location-target produces                        # the TYPE it returns → its def (and more: see --location-target)
bun run tests:where-is --search-location src/Table.ts:389 --location-target types                  # the indexed TYPES named on that line → each one's def
bun run tests:where-is --search-location test/db/postgres/newest/pg/select.basic.test.ts:45       # a TEST line → inverse search
bun run tests:where-is --emits-keyword 'returning old.'                  # a SQL token → the code that emits it
bun run tests:where-is --search orderBy --coord postgres --chain full --for coverage-gap          # combine freely
```

### Doors — WHAT to search for (exactly one)

| Door | Resolves to |
|---|---|
| `--search <name>` | an exact symbol/member name (`orderBy`, `__addOrderBy`) |
| `--search-pattern <regex>` | a JS regex over names → a **full report per** matching name (capped) |
| `--search-pattern-summary <regex>` | the same regex → a compact **pick-list** (name · kind · visibility counts · decls · sample) |
| `--search-location <path:line>` | a **source** line → an element near it (the enclosing fn by default; `--location-target` chooses what — see the next section); a **test** line → inverse search (the `test_block` + the public API it exercises) |
| `--emits-keyword <sql-fragment>` | the `SqlBuilder` code that emits that SQL token — the emission-bug door |

### `--location-target` — what a source line resolves to

For a **source** `--search-location`, the line could mean several things — the function around it, what
it calls, what it produces, the types it names. `--location-target` picks which (a **test**
`--search-location` ignores it — that's always the inverse search):

| `--location-target` | From the line, resolves to | Output |
|---|---|---|
| **`enclosing`** *(default)* | the **concrete overload** declared at the line | full report |
| `enclosing-all` | the **whole function** — every overload | full report |
| `callees` | the function(s) **invoked on** the line (≥1 → one report each) | full report |
| `produces` | the **type the enclosing fn returns** → its definition | full report |
| `types` | the indexed **types referenced on the line** → each one's definition | navigation list |
| `types-all` | …the same **across the whole function** (every overload + body) | navigation list |
| `brand` | the **brand marker** a `[sym]: T` line keys on → the marker symbol | full report |

**Overloads — concrete vs whole-function.** By default the report pins to the **exact overload at that
line** (`Declared`/`Signature` show just that one, noting the rest). To get them **all**: search **by
name** (`--search <name>`); land on the **implementation** line (the `: any` catch-all body *is* the
whole function, so it un-focuses automatically); or use **`enclosing-all`** from any line — the **only**
way for an **interface** method, which has no implementation line to land on. A method with **no
overloads** has one declaration whose implementation *is* its visible definition — never a catch-all.

**`types` / `types-all` print a navigation list, not the section set.** They resolve to *many* types, so
instead of a report they print a terminal table (`type · role · defined-at`, plus a site count for
`types-all`) and **ignore the section flags** — the same shape as `--search-pattern-summary` and the test
inverse search. `types` reads the **exact line** (the concrete overload's composed types); `types-all`
reads the **whole function** (every overload + the implementation body, via the traceable enclosing FK),
deduped. The **return** type is omitted — that is what `produces` covers. Typical loop: land on a broken
signature → `--location-target types` to enumerate + locate its composed aliases → `--search <alias>
--for type-bug` for the suspect.

**`brand` — for a phantom/branded-type line.** ts-sql-query discriminates types with `unique symbol`
brands declared as computed keys (`[source]: SOURCE`, `[type]: 'column'`; the markers live in
`src/utils/symbols.ts`). Land on such a line and `--location-target brand` resolves it to the **marker
symbol** (a full report) — add `--ref-brand` there to list **every type carrying that brand** (the type
that won't unify is usually one of them). It's the forward dual of `--ref-brand` (symbol → its branded
types). The brand member itself is indexed under the name `[source]`, so `--search '[source]'` also finds
every declaration.

### Sections — one levelled flag each (`none` hides)

The **default** level is in **bold**; an un-flagged run = the classic report. The `what it shows`
column doubles as the "reading the report" key (sections appear only when they have content).

| Section flag | Levels (default **bold**) | What it shows |
|---|---|---|
| `--classification` | none · **summary** · full | exists? **public** (importable) / **public-surface** (fluent API, not importable) / **internal** / not found — its **kind**, and for a member which public interfaces expose it |
| `--declared` | none · **summary** · full | every declaration site: its kind, location and first JSDoc line |
| `--signature` | none · **summary** · public-interface · public-impl · internal · full | signature + JSDoc, prefixed `[public]` / `[public impl]` / `[internal]` + owner kind, **simplified-map form first** |
| `--chain` | none · **strict** · broad · full | the call-chain: public callers grouped by area + direct callers. `broad` climbs **past** public; `full` = the **whole internal stack** |
| `--ref-return` | **none** · summary · full | **references by role:** where the element is referenced **as a return type** — members whose return type yields a receiver you can call the member on (the upstream/receiver search) |
| `--ref-implements` | none · **summary** · full | **references by role:** where the element is referenced **in an implements/extends** clause — each class implementing an interface that declares the member — the implementation **and** the class, or "inherits it" (**non-overriders** shown); + the simplified def(s) it realizes |
| `--ref-type-arg` | **none** · summary · full | **references by role:** where the type is referenced **as a type argument** (`Outer<This>`) — a type alias's blast radius across signatures — each site with its enclosing fn |
| `--ref-param` | **none** · summary · full | **references by role:** where the type is referenced **as a parameter type** — each site with its enclosing fn |
| `--ref-field` | **none** · summary · full | **references by role:** where the type is referenced **as a field/property type** — each site with its enclosing fn |
| `--ref-new` | **none** · summary · full | **references by role:** where the class is referenced **in a construction** (`new This(…)`) — each site with its enclosing fn |
| `--ref-property` | **none** · summary · full | **references by role:** where the member is referenced **via property access** (`x.member`, read/written, NOT a call — calls are `--chain`) — each site with its enclosing fn |
| `--ref-brand` | **none** · summary · full | **references by role:** where a `unique symbol` is used **as a brand key** — the computed-key declaration `[sym]: T` (the phantom/branded-type markers in `src/utils/symbols.ts` the compiler discriminates on). `--search source --ref-brand` → every type branded by `source` — each site with the branded type |
| `--surface` | **none** · own · all · full | the **members of the declaring type(s)** — seed a **TYPE** (interface/class) → its members; seed a **MEMBER** → its **siblings** (the other members of its owner(s)). The level is the **inheritance scope**: `own` = declared directly (no inheritance); `all` = everything it has — own + inherited (`extends`) + implemented (`implements`), flat; `full` = the same coverage **broken down by the declaring type** (own first, then each inherited/implemented source, incl. interfaces). Fills the gap that searching a type otherwise lists no members |
| `--version-gates` | **none** · summary · full | compatibility-version branches (`compatibilityVersion <op> <breakpoint>`) + the methods they gate |
| `--docs` | none · **summary** · by-page · full | where it's **explained**: doc page + heading + exact line, per db, with the snippet kind |
| `--simplified` | none · **summary** · full | when the name IS a simplified def: completeness vs the real API per source + drift; and where the member appears **inside** a simplified-def snippet |
| `--emitted-sql` | **none** · summary · full | the asserted `toMatchInlineSnapshot` SQL the symbol's **tests + docs** produce, de-duped with the asserting cells + the refresh kind |
| `--tests` | none · **summary** · detail · gaps | matrix coverage — `summary` = `newest/total` per db; `detail` = per-test; `gaps` = who's-**missing** per db |
| `--examples` | none · **summary** · full | legacy `src/examples/` occurrences |
| `--neg-types` | none · **summary** · full | `@ts-expect-error` negative-type assertions — `summary` = count per db; `full` = each assertion's **rule comment + rejected snippet + file:line** (what you model a new lock on) |
| `--bugs` | **none** · summary · full | `// TODO[BUG]` markers whose text **names the searched symbol** (the BUG subset of all indexed TODO markers) |
| `--limitation` | **none** · summary · full | `// TODO[LIMITATION]` markers whose text **names the searched symbol** (the sibling tag) |
| `--cell-caveats` | **none** · summary · full | **coord-scoped:** `// TODO[BUG]`/`// TODO[LIMITATION]` declared on cells, *not* filtered by the symbol — surfaces a caveat on the target **cell** (a dialect/version limitation) a wave/propagation would hit late. **The level is the view:** `summary` = the per-cell **map** (each cell + its caveat counts); `full` = the **markers** (each line cell-prefixed). `--coord` only **filters which cells** appear — it never changes the view |
| `--name-search` | **none** · full | name-based discovery — every place the name appears, per dimension (high recall) |
| `--refs` | none · summary · full | **shortcut**, not a section: sets the whole "references by role" family (every `--ref-*` above) to one level at once. An explicit per-role flag still overrides it; `--refs` itself beats a `--for` preset |

> **The "references by role" family.** The `--ref-*` sections are all views of one question — *where is
> this element referenced, and how?* — one per syntactic role: **as a return type** (`--ref-return`), **in
> implements/extends** (`--ref-implements`), **as a type argument** (`--ref-type-arg`), **as a parameter
> type** (`--ref-param`), **as a field type** (`--ref-field`), **in a construction** (`--ref-new`), **via
> property access** (`--ref-property`), and **as a brand key** (`--ref-brand`, a `unique symbol` used as
> `[sym]: T`). They are separate sections so the agent pays only for the role it needs (low noise);
> `--refs <level>` raises them together.
>
> These point one way — *a type → its uses*. The **opposite** direction, *a line → the types it touches*,
> lives on `--search-location --location-target` (`produces` / `types` / `types-all` / `brand`; see the
> **`--location-target`** table above). `--ref-type-arg` is the exact reverse of `types`. (`--chain` and
> `--name-search` answer "where used" too, but as a graph traversal and a flat catch-all — not a single
> syntactic role.)

> **Caveats: `--bugs` / `--limitation` (name-scoped) vs `--cell-caveats` (coord-scoped).** A `// TODO`
> caveat can block you for two different reasons, hence two flags:
> - **`--bugs` / `--limitation`** match markers whose **text names the symbol you searched** —
>   *"is there a known bug/limitation **about what I'm calling**?"* Independent of `--coord`.
> - **`--cell-caveats`** lists **every** BUG+LIMITATION marker in the **cells `--coord` selects**,
>   named or not — *"is anything declared on the **cell I'm about to write into** that blocks my wave?"*
>
> They diverge when a caveat is about a *dialect/version*, not a method. Searching `oldValues`,
> `--limitation` finds the markers that literally say `oldValues()`, but **misses** the "MariaDB
> UPDATE…RETURNING needs 13.0.1+" limitation in the same cells (its text never says `oldValues`) —
> which `--cell-caveats --coord mariadb/newest` **does** surface. Name-scoped for *my symbol*,
> coord-scoped for *my cell*.
>
> Note: every section (incl. `--cell-caveats`) rides a **resolved `--search`** — if the symbol comes
> back *not found*, the report stops at that verdict and no section renders. Fix the symbol/typo
> first; a coordinate alone doesn't drive a report.

### Global focus — matrix coordinates (`--coord`)

`--coord` is the **single focus filter** — a matrix coordinate `db[/version[/connector[/file]]]`
with glob `*` and brace `{a,b}`, **repeatable** (union). It focuses **every db/cell-aware section**,
best-effort per dimension (the same mental model as the main `tests` CLI's coordinates, but as a
global focus). Exact closed-set values; no fuzzy substrings.

| | Matched against the coord |
|---|---|
| **tests**, **emitted-sql** (test rows) | the **full cell** — `db` / `version` / `connector` (/ test-file basename) |
| **legacy examples** | the **full cell** too — db/version/connector are derived from the filename (`PgExample`→`postgres/newest/pg`, `MariaDBExample-compatibility`→`mariadb/oldest/mariadb`; the `documentation/` generators have no connector) |
| **docs**, **shown-in-simplified-def**, **negative-type**, **emitted-sql** (doc rows) | the **db segment** only (these have no version/connector). db-agnostic `general` docs are always kept |

The optional **4th (file) segment** is a glob/brace on the test-file **basename**; it **coexists**
with `--file-name-pattern` (a regex over the full path that also covers doc pages) — both AND. A
coord matching no indexed cell/file is an **error** (nullglob). Examples: `--coord postgres`
(everything postgres) · `--coord 'postgres/*/{pg,postgres}'` (those connectors) · `--coord
'mariadb/oldest'` (the `-compatibility` examples) · `--coord 'postgres/newest/pg/select.order-by*'`
(a test file) · `--coord '*/newest' --coord mysql`.

### Narrow WITHIN the sections (orthogonal to the matrix axes)

| Narrowing | Narrows |
|---|---|
| `--test-name-pattern <regex>` | tests by name |
| `--file-name-pattern <regex>` | file dimensions (test files, doc pages) |
| `--owner-kind <interface\|class\|type>` · `--owner <name>` | declared / signature by owner |
| `--breakpoint <n>` | the `--version-gates` section to one compatibility-version breakpoint (e.g. `18_000_000`); validated — an unknown breakpoint errors with the known list |

### Presets — `--for <intent>` (explicit flags still override)

Each preset sets a **level per section** (shown below); every section it doesn't name keeps its
default. Explicit flags still override.

| `--for` | section `level` it sets |
|---|---|
| `bare` | **every section `none`** — a blank report; add only the section(s) you want instead of typing a dozen `--<section> none`. Explicit flags (and `--refs`) turn things back on: `--for bare --surface own` shows only the surface |
| `coverage-gap` | classification `full` · chain `full` · ref-return `summary` · tests `gaps` · examples `full` · cell-caveats `summary`→`full` if `--coord` |
| `type-bug` | declared `full` · signature `full` · ref-type-arg `full` · neg-types `full` · bugs `summary` · limitation `summary` · chain `none` — the TYPE counterpart of `emission-bug`: a type-resolution bug lives in the **signature**, not the call-chain, so it raises every declaration site, the full signature/overloads, the alias's blast radius (where the type is a type argument), and the negative type tests |
| `emission-bug` | emitted-sql `full` · ref-implements `full` (non-overriders) · version-gates `summary` · bugs `full` · limitation `summary` · chain `none` |
| `version-work` | version-gates `full` · tests `summary` · bugs `summary` · limitation `summary` · chain `none` |
| `post-fix-sync` | emitted-sql `full` · docs `full` · examples `full` · tests `detail` · bugs `summary` · chain `none` |
| `propagation` | classification `summary` · tests `gaps` · examples `summary` · cell-caveats `summary`→`full` if `--coord` · chain `none` — the COVERAGE_RUNBOOK *Propagation* view (copy the canonical test to the sibling cells) |

The caveat sections split by *scope*: `--bugs`/`--limitation` are **name-scoped** (markers naming the
symbol) and ride the feature-centric presets; `--cell-caveats` is **coord-scoped** and rides
`coverage-gap` / `propagation` **coord-aware** — `summary` (the per-cell **map**) while you browse
with no `--coord`, auto-raised to `full` (the **markers**) the moment you scope with a `--coord`. The
level meaning is fixed (`summary`=map, `full`=markers); the preset just picks the useful one. An
explicit `--cell-caveats` still overrides.

`--index <path>` selects which code-index file to read (default
`test/lib/codeIndexer/generated/code-index.sqlite`, gitignored/disposable) — rarely needed. **Build
the index once** before the first search and refresh it when stale:

```bash
bun run tests:index                  # build / refresh the index (~28 s)
```

## When you'd use it

You're generating tests from a coverage report and you hold a symbol — often an
**internal** one like `__addOrderBy`, or a public name you're weighing — or just a
file:line from the report. Ask:

```bash
bun run tests:where-is --search __addOrderBy
```

and you get, in one markdown report: does it exist? public or internal? the public
methods that reach it; where it's explained in the docs (page:line); which
simplified definition reflects it; and how saturated its test coverage is per
database. Paste it into a wave plan as a verifiable artifact.

## Reading the report

Sections appear only when they have content; **what each shows** is the `What it shows` column of
the **Sections** table above. The cross-cutting reading conventions:

**Every location is jump-ready — this is how you find and extract code.** Wherever the report points at
code — a declaration, a member, a type/brand definition, a reference site, a call — it gives `file:line`,
and for a declaration/definition it follows with a **labelled span** so you can open (or extract) exactly
that range without guessing where it starts and ends: `(spans lines N–M)` / `(definition spans lines N–M)`
for a declaration or member, `(caller body lines N–M)` for a calling function, `(snippet spans lines N–M)`
for a doc snippet. This holds **across every section**, so the per-section descriptions don't repeat it. A
reference *site* is a single point (no span); everything that names a *declaration* carries its span.
In a **chain search**, the line shown is the **exact invocation line** (where the searched symbol is
called), and the labelled range is the body of the calling function:

```
- `orderBy` invokes `__addOrderBy` at src/queryBuilders/SelectQueryBuilder.ts:247 (caller body lines 241–249)
```

**Public surface vs internal.** Only functions **exposed by a public interface** are public.
The public surface is the fluent API interfaces (`src/expressions/*`, used through the public
connection methods even though not directly importable), the curated simplified map, and the
directly-exported symbols. So a member is marked:
- `[public]` — declared on a public interface (the contract).
- `[public impl]` — a **class** method that implements a public-interface member (it runs when
  the user calls the public method; public *by implementation*).
- `[internal]` — declared on no public interface (e.g. `__addOrderBy`, a private helper).

`tests:where-is --search orderBy` shows the contract interfaces as `[public]` and
`AbstractSelect.orderBy` as `[public impl]`; `tests:where-is --search __addOrderBy` is
`[internal]` — reachable only *through* the public `orderBy` (see the chain search below).

### When the symbol is not found

If `Classification` reads **not found**, the indexed `src/` surface has no symbol by
that name. Three causes, in order of likelihood:

1. **Typo or wrong casing** — re-check spelling, especially the leading `__` for
   internals (`addOrderBy` vs `__addOrderBy`) and camelCase boundaries.
2. **Same behaviour, different name** — try `--search-pattern <regex>` over a likely
   prefix (or a fragment of the documented intent) to surface the actual API.
3. **Hallucinated API** — the symbol does not exist in the library. If you were
   about to propose a wave around it, STOP — the wave is invalid. Paste the
   `Classification` block into the wave plan as the exit artifact and open a
   follow-up to discuss with the user whether the documented behaviour lives
   under a different name or whether the docs are stale. See
   [`ANTIPATTERNS.md` § Hallucinated API](./ANTIPATTERNS.md#5-hallucinated-api).

This is the mechanical close of the pre-flight required by
[`COVERAGE_RUNBOOK.md` § Verify the API actually exists](./COVERAGE_RUNBOOK.md#verify-the-api-actually-exists).

### The call-chain (`--chain`) and name search (`--name-search`)

The report's **facts** are always shown (classification, signature, where it's
implemented/explained/tested). The **searches** answer "where/how is this used?", and each is
its own levelled flag:

```bash
bun run tests:where-is --search <name>                          # --chain strict (default)
bun run tests:where-is --search <name> --chain broad            # climb past the public callers
bun run tests:where-is --search <name> --chain full             # the WHOLE internal stack
bun run tests:where-is --search <name> --name-search full       # every place the name appears
```

| level | how it searches | answers |
|---|---|---|
| **`--chain strict`** (default) | call-chain upward, **stop at the first public caller** (grouped by area) | "what public API reaches this — the precise route" |
| **`--chain broad`** | call-chain, climbing **past** the public callers through the whole graph | "the wider surrounding chain" |
| **`--chain full`** | the **entire internal stack**, every hop grouped by depth | "the complete route, internal included" — for understanding a deep emission site |
| **`--name-search full`** | name-based across every dimension (symbols, members, tests, docs, examples, negatives) | "everywhere this name appears" (high recall, low precision) |

A hop is *public* when the calling function is itself public (a `public`/`public_impl` member or
a public-surface symbol), in **any** area. **`--chain` is the wrong tool for an emission/syntax
bug** — the SQL is built then executed, so neither the runtime stack nor the call-chain reaches
the emission; use `--emits-keyword` instead (and `--for emission-bug` sets `--chain none`).

**The chain is type-precise.** It walks the **checker-resolved** call edges (`resolved_member_id` for
method calls, `resolved_symbol_id` for plain calls/`new`) and keys visited nodes by the caller's resolved
**identity**, so two distinct methods that happen to share a name never collapse into one node (e.g. the
dozen-plus distinct `__toSql` implementations stay separate). The level (`strict`/`broad`/`full`) is
orthogonal — it only controls depth/stopping, not precision. (Seeding is still by name: `--search __toSql`
walks every `__toSql`; the precision is in the upward walk not conflating *other* names mid-chain.)

Under `npm run` the flags need a `--` separator (`npm run tests:where-is -- --search <name> --chain full`);
under `bun run` they pass straight through.

## Worked example — internal symbol to docs & tests

`__addOrderBy` (an internal method at `src/queryBuilders/SelectQueryBuilder.ts:250`,
the kind of thing a coverage report points you at):

1. `tests:where-is --search __addOrderBy` → the **chain-strict** search shows it's reached by
   the public `orderBy` / `orderByFromString`.
2. `tests:where-is --search orderBy` → **Implemented by** `AbstractSelect`, realizing the
   simplified def `SelectExpression`; **Explained in docs** at `docs/api/select.md`
   plus every `.orderBy(...)` example across `docs/queries/*.md` with exact lines;
   **Coverage** ~5 k matrix tests across all databases + legacy examples + 6
   negative-type assertions.

That's the internal → public → docs → tests trail, from a single symbol.

## Staleness — when to rebuild

The index is a **snapshot** of the tree at build time. Every report header states its
provenance and warns when it's likely out of date:

```
> index: built 2026-06-05T14:20:00Z · 40fa555f-dirty · resolved · schema v4
> ⚠️  index built at 40fa555f, working tree is at d9100896 — likely STALE; rebuild with `tests:index`
> ⚠️  working tree is dirty — the index may not reflect uncommitted edits
```

If you see those warnings and your question is about code you just changed, re-run
`bun run tests:index`. If the searcher ever refuses the index outright instead of
just warning, the same rebuild is the fix.
