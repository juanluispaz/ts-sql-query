# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## Read this file in full — this section is the one to internalise

Whether you're **documenting** a new bug or **picking up an entry to
fix**, read every section of this file (every open entry below, the
"How to write an entry" recipe, the bug-shape presets at the bottom).
None is optional. This section in particular is the one prior sessions
skipped — internalise it before any `grep` or `Read` over `src/`:

1. **Read [`CODE_SEARCH.md`](./CODE_SEARCH.md) in full** once at session
   start (the doors, the sections, the presets, the cross-cutting reading
   conventions — all of it is operational). Pay special attention to
   [§ "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search):
   it defines when `tests:where-is` answers the question (symbol
   declarations, overload sites, type-arg blast radius, call-chain,
   neg-types, cell caveats) and when `grep` / the compiler still win
   (literal prose, byte-anchored edits, assignability decisions).
2. **Refresh the index**: `bun run tests:index` (~28 s, gitignored).
3. **Treat the entry's `Where:` / `Reproduction:` lines as starting
   points, not ground truth.** The test author wrote them from what
   they saw; the searcher gives you every declaration site, every
   implementing class, every test that exercises the API, every
   first-class reason marker that names the symbol (`// TODO[BUG]`,
   `// TODO[LIMITATION]`, `// NOT-APPLICABLE`), and the wrap shape
   across cells — in one report.

   Recent miss: an entry on `virtualColumnFromFragment` named
   `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`.
   A fix that grepped only the two listed files would have left
   `Table.ts` regressed. `--declared full` lists all three.

The presets for the two main bug shapes live in
[§ "Common bug shapes"](#common-bug-shapes-for-the-fixing-agent) below
(read them, even if your bug is "obvious"); the searcher-first triage
flow for test authors lives in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## How to write an entry (test author)

Keep it short — enough to reproduce, no deeper. The fixing agent
takes it from there. Recommended structure:

```markdown
## <One-line title naming the symptom>

**Where**: file + line, or class/method, or docs page reference.
**Reproduction**: the test that surfaces it, the SQL the lib emits
(if applicable), the runtime/type error observed.
**Current workaround in the suite**: which tests are wrapped /
marked, and with what reason line.
```

That's the contract. Do **not** spend time diagnosing the root cause,
choosing a category, or proposing a fix — the fixing agent owns all
of that. Two minutes of triage and one paragraph is the bar.

---

## Oracle has no `cot()` function — `.cot()` emits unsupported SQL

**Where**: `.cot()` on a numeric value source → `AbstractSqlBuilder._cot`
emitting `cot(<expr>)` for the Oracle dialect (`src/sqlBuilders/OracleSqlBuilder.ts`
inherits the generic `cot(...)` emission).
**Reproduction**: any Oracle query selecting `<numeric>.cot()` fails at
execution against a real Oracle 23ai engine with
`ORA-00904: "COT": invalid identifier` (Oracle has no native `COT`
function; the standard substitute is `1/TAN(x)` or `COS(x)/SIN(x)`).
Surfaced by `test/db/oracle/newest/oracledb/select.value-source.trig.test.ts`
(`cot`) and `select.value-source.custom-numeric.test.ts`
(`custom-numeric/customdouble-trig`, whose projection includes a `cot(:4)`
column so the whole statement is rejected).
**Current workaround in the suite**: both tests wrap their execution in
`if (ctx.realDbEnabled) return` with
`// tests-audit-disable-next-line mock-only -- Oracle has no COT() function (ORA-00904 …)`.
SQL/param snapshots still validate under the mock.

## Oracle rejects `.asString()` round-trip on a string-bound UUID const

**Where**: `.asString()` on a `uuid` value source → Oracle dialect emits
`raw_to_uuid(uuid_to_raw(:0))` (the `built-in` uuid strategy in
`src/sqlBuilders/OracleSqlBuilder.ts`).
**Reproduction**: `connection.const('123e4567-e89b-12d3-a456-426614174000', 'uuid').asString()`
selected from `dual` fails on a real Oracle 23ai engine with
`ORA-62432: 123e4567-e89b-12d3-a456-426614174000 is not a valid UUID value`.
The const is bound as a plain string param, but `uuid_to_raw(:0)` expects a
value Oracle accepts as a UUID literal/RAW, so the round-trip is rejected.
Surfaced by `test/db/oracle/newest/oracledb/select.value-source.uuid-cast.test.ts`
(`uuid-asString-on-const`).
**Current workaround in the suite**: the test wraps its execution in
`if (ctx.realDbEnabled) return` with
`// tests-audit-disable-next-line mock-only -- Oracle rejects the emitted raw_to_uuid(uuid_to_raw(:0)) round-trip … (ORA-62432)`.
SQL/param snapshots still validate under the mock.

## SQL Server scalar UDF call omits the `dbo.` schema prefix

**Where**: `executeFunction` → `_buildCallFunction` on the SQL Server
dialect (`src/sqlBuilders/SqlServerSqlBuilder.ts`, inherits the generic
`select <name>(...)` emission from `AbstractSqlBuilder`).
**Reproduction**: any SQL Server function call (`callCountOpenIssues`,
`callProjectName`, `callProjectNameOrNull` in the domain wrappers) emits
`select count_open_issues(@0)` / `select project_name(@0)`. A real SQL
Server engine rejects the bare name with
`'count_open_issues' is not a recognized built-in function name`
(error 195) — scalar UDFs must be invoked with a two-part name
(`select dbo.count_open_issues(@0)`).
**Current workaround in the suite**: `execute-function-returning-int`,
`execute-function-returning-string`, and
`execute-function-optional-accepts-null-result` in
`test/db/sqlserver/newest/mssql/exec.procedure-function.test.ts` wrap
their execution in `if (ctx.realDbEnabled) return` with
`// tests-audit-disable-next-line mock-only -- SQL Server scalar UDF call lacks the \`dbo.\` schema prefix; see test/BUGS.md`.
SQL/param snapshots still validate under the mock.

## SQL Server double-wraps a boolean inline-subquery condition as `((...) = 1) = 1`

**Where**: a one-column boolean SELECT taken through
`forUseAsInlineQueryValue()` and used directly as a `where(...)`
condition. The SQL Server dialect coerces the boolean subquery to
`((<select>) = 1)`, then the inline-query-as-condition path coerces the
result a second time, emitting
`where (((select ...) = 1) = 1)` (and `not (... = 1) = 1` for the
negated case).
**Reproduction**: `boolean-inline-subquery-as-condition` and
`negated-boolean-inline-subquery-as-condition` in
`test/db/sqlserver/newest/mssql/select.where.inline-subquery.test.ts`.
A real SQL Server engine rejects the doubled coercion with
`Incorrect syntax near '='` (error 102) — a bit/boolean expression
cannot itself be compared with `= 1` again.
**Current workaround in the suite**: both tests wrap their execution in
`if (ctx.realDbEnabled) return` with
`// tests-audit-disable-next-line mock-only -- SQL Server rejects the \`((...) = 1) = 1\` double bit-coercion; see test/BUGS.md`.
SQL/param snapshots still validate under the mock.

---

## MariaDB `.minus()` / `.minusAll()` emit the `MINUS` keyword, which MariaDB rejects

**Where**: `MariaDBSqlBuilder._appendCompoundOperator`. For `.minus(...)`
/ `.minusAll(...)` it emits ` minus ` / ` minus all `, but MariaDB has no
`MINUS` keyword (it uses `EXCEPT` / `EXCEPT ALL`, like PostgreSQL).
**Reproduction**: `minus-routes-through-the-dialect-alias` and
`minus-all-routes-through-the-dialect-alias` in
`test/db/mariadb/newest/mariadb/select.compound-extras.test.ts`. The
emitted `select … minus select …` is rejected by a real MariaDB engine
with `ER_PARSE_ERROR` (`You have an error in your SQL syntax … near
'minus …'`). PostgreSQL renders the same `.minus(...)` as `except` and
runs fine, so the MariaDB override is the outlier.
**Current workaround in the suite**: both tests wrap their execution in
`if (ctx.realDbEnabled) return` with
`// tests-audit-disable-next-line mock-only -- MariaDB rejects the emitted MINUS keyword (ER_PARSE_ERROR); the builder should emit EXCEPT — see test/BUGS.md`.
SQL/param snapshots still validate under the mock.

---

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

**First, locate every declaration site of the symbol** —
`bun run tests:where-is --search <symbol> --declared full` lists ALL
declaration sites. Trust the index over the entry: the files named in
the open entry are the ones known when it was filed, and they can be
**incomplete**. (Past miss: an entry on `virtualColumnFromFragment`
named `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`
and a fix that grepped only the two listed files would have left
`Table.ts` regressed.)

Then gather the context appropriate to the bug's shape:

- **SQL-emission bug** (the lib emits SQL the engine rejects, or the
  emitted SQL is wrong) — `bun run tests:where-is --search <symbol> --for emission-bug`
  bundles `emitted-sql full · implemented-by full (non-overriders) ·
  version-gates · bugs full · limitation · not-applicable · chain
  none`: the SQL the symbol emits across tests and docs, every
  implementing class, the compatibility-version branches that gate
  the method, sibling `// TODO[BUG]` markers and any declared
  `// TODO[LIMITATION]` / `// NOT-APPLICABLE` that names the symbol.
  `chain` is off on purpose — emission happens after the call-chain,
  so the chain never reaches the emission site; use
  `--emits-keyword <sql-fragment>` to walk back from the SQL token
  to the builder code instead.
- **Type-system bug** (overload selection, variance, assignability —
  the symbol's typing rejects or accepts something it shouldn't) —
  `bun run tests:where-is --search <symbol> --for type-bug` bundles
  `declared full · signature full · ref-type-arg full · neg-types
  full · bugs summary · limitation summary · not-applicable summary ·
  chain none`: every declaration + signature, every place the type is
  **used as a type argument** (the blast radius of an alias), the
  existing `@ts-expect-error` locks and sibling markers. The route
  for a type
  bug is the signature, not the call-chain — `chain` is off for the
  same reason as `emission-bug`. Before inventing a new helper or
  type alias, run `--search-pattern-summary '<shared-token>'` to
  check whether the shape already exists under a different name
  (past near-miss: nearly re-introduced `AllowsNoTableOrViewRequired`
  by hand).

Each entry above usually falls into one of these:

- **TS accepts something runtime rejects** — a method typed on a
  connection class whose dialect refuses the SQL it emits. Mock
  cells silently pass (the SQL is never executed); only the real-DB
  cell surfaces the rejection. Treat as a typing gap: the type
  should narrow. The fix is two-step: tighten the connection's typed
  surface in `src/connections/<DB>Connection.ts` (or wherever the
  method is exposed), then add a `@ts-expect-error` rule under
  `test/db/<db>/types.negative/` that locks the new narrower
  contract. Example shipped: commit `9b5ab1c` on
  `PostgreSqlConnection.onConflictDoUpdateSet`.
- **TS rejects something the docs page describes** — the docs show a
  call that doesn't typecheck on the connection that snippet is
  supposed to demonstrate. Either the docs page is stale or the lib
  types are too tight. The fix is either to widen the type or to
  update the docs page; check both before assuming one.
- **Two equivalent forms documented but only one is typed** — the
  docs describe two interchangeable forms per dialect (e.g.
  "MariaDB/MySQL use bare `.onConflictDoUpdateSet({...})`;
  PostgreSQL/SQLite use `.onConflictOn(col).doUpdateSet({...})`")
  and the lib types let you use the wrong form on a given dialect.
  The fix narrows the typed surface for the dialect that should not
  accept that form.
- **A snippet references a public symbol that no longer exists** in
  the current `exports` map of [`package.json`](../package.json) —
  the page is stale or the symbol was removed. The fix is to update
  the docs page or restore the export.

When the fix lands:

1. Patch `src/` and add the negative-type test (where applicable).
2. Remove the corresponding entry from the open list above.
3. **Walk every place that reflected the old behaviour**:
   `bun run tests:where-is --search <symbol> --for post-fix-sync` bundles
   `emitted-sql full · docs full · examples full · tests detail · bugs
   · chain none` — every asserted SQL across tests and docs, the doc
   pages that explain it, the legacy `src/examples/` occurrences,
   per-test references, and any remaining `// TODO[BUG]` markers that
   still mention the symbol (typically the entry you're closing here).
   Anything still naming the old behaviour needs refreshing.
4. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or **switch the
   marker to its final category**. If the fix establishes that the
   feature simply doesn't exist on this dialect, the right marker is
   `// NOT-APPLICABLE: <reason>; see test/db/<db>/types.negative/<file>.ts
   for the compile-time negative` — a permanent dialect boundary, not
   pending work. If the bug exposed an unsolved library gap, use
   `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` instead.
5. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
