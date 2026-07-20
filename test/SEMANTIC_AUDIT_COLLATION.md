# Semantic audit — collation & case-sensitivity homogeneity (dedicated brief)

A **themed** semantic audit, scoped to one problem: the library mirrors JavaScript's
**case-sensitive** string semantics, but several engines match strings **case-insensitively by
default** (their default collation is CI), so a fully-typed call silently behaves the opposite of
what the JS-shaped API promises — and differently across dialects. This is the collation half of the
`SEMANTIC_AUDIT_RUNBOOK.md` defect family: *the declared/documented contract is one thing, the engine
does another, and nothing errors.*

**This is an analysis + proposal task, not an implementation task.** Review the whole surface,
probe every claim against a real engine, and **propose** the adjustments (code, config, docs) ranked
by user impact. The maintainer decides what lands. Do **not** change `src/` unless explicitly told to
after the report.

Read `SEMANTIC_AUDIT_RUNBOOK.md` in full first (the method, the evidence bar, "where the round before
you was wrong"), then `LIMITATIONS.md` (the `replace()` and SQLite `lower()` entries), then this brief.

- [Why this audit](#why-this-audit)
- [What the library already has — and the asymmetry](#what-the-library-already-has--and-the-asymmetry)
- [Evidence already gathered (do not re-derive — verify)](#evidence-already-gathered-do-not-re-derive--verify)
- [The surface to sweep](#the-surface-to-sweep)
- [The questions to answer](#the-questions-to-answer)
- [The design forks to develop](#the-design-forks-to-develop)
- [The evidence bar](#the-evidence-bar)
- [Out of scope — the extreme cases we live with](#out-of-scope--the-extreme-cases-we-live-with)
- [The deliverable](#the-deliverable)

## Why this audit

The library exposes a JS-shaped string API (`.replaceAll`, `.contains`, `.startsWith`, `.equals`, …).
JavaScript's `String` methods are **case-sensitive**. But the default collation of several supported
engines is **case-insensitive (and often accent-insensitive)**, so:

- **`.replaceAll('abc', 'X')` on `'ABCabc'`** returns `'XX'` on SQL Server (default CI collation) —
  it replaced BOTH — where JS and PostgreSQL/Oracle return `'ABCX'`. **A silently corrupted value, by
  default, in ordinary use.** This is the sharpest case: a value transformation, not a filter.
- **`.contains('abc')` / `.startsWith` / `.equals`** — the **sensitive** half of the API pair —
  match `'ABC'` too on the CI-default engines, so `.contains` and `.containsInsensitive` return the
  same rows there. The matrix has never distinguished them (round-1 finding #9, the "masking
  collation").

The round-1/round-2 audits ruled the collation issues to `LIMITATIONS.md` ("the library can't own the
user's schema"). This audit re-opens that verdict deliberately, because a native escape was found for
the worst case (see below) and the maintainer flagged `replace()` as the most painful limitation to
live with. **Inherit no verdict — re-derive it.**

## What the library already has — and the asymmetry

There is exactly **one** collation knob, and it points the **wrong way** for this problem:

- **`insensitiveCollation`** (`src/connections/AbstractConnection.ts:39`,
  `src/utils/ConnectionConfiguration.ts:4`, documented at `docs/configuration/connection.md:33`).
  When set, the `*Insensitive` operations emit `… collate <value>` instead of `lower(a) like
  lower(b)`. It exists to make the **insensitive** direction work (and to escape the `lower()`
  ASCII-only trap on SQLite). Used ~13× in `AbstractSqlBuilder` + the per-dialect builders.

There is **no** symmetric knob for the **sensitive** direction, and **no** per-column or per-value
`.collate(...)` API (confirmed: no `collate`/`collation` member on `Table.ts` / `values.ts`). So a
user who wants `.replaceAll` / `.contains` / `.equals` to be **truly case-sensitive** (JS-faithful)
on a CI-default engine has no library-level lever — only changing the column/DB collation in their
schema.

**The asymmetry is the spine of this audit**: the insensitive direction is configurable; the
sensitive direction — which is the *default* the JS API implies — is not.

## Evidence already gathered (do not re-derive — verify)

A native, code-point-exact fix for `replace()` on SQL Server was probed against a real
`mssql/server:2025` container. **Re-run it to confirm before building on it**, then extend the method
to the rest of the surface:

```sql
-- default CI collation: WRONG (replaces both cases)
replace('ABCabc', 'abc', 'X')                                              => 'XX'
-- force a BINARY collation on the two MATCH operands: JS-faithful (case + accent + code-point exact)
replace('ABCabc' collate Latin1_General_BIN2, 'abc' collate Latin1_General_BIN2, 'X')  => 'ABCX'
replace(N'CAFÉcafé' collate Latin1_General_BIN2, N'café' collate Latin1_General_BIN2, N'X') => 'CAFÉX'
replace(N'日本日本' collate Latin1_General_BIN2, N'日本' collate Latin1_General_BIN2, N'X')  => 'XX'   -- Unicode/CJK OK
```

Two facts established:

1. **`Latin1_General_BIN2` is code-point comparison regardless of the culture prefix** — it works for
   nvarchar/Unicode/CJK, not just Latin1. The name misleads.
2. **The result carries the forced collation, which leaks downstream.** `replace(x collate BIN2, …)`
   makes a chained `.equals('abcx')` case-sensitive. Resetting the result with an outer
   `collate DATABASE_DEFAULT` restores the prior behaviour while keeping the match case-sensitive:

   ```sql
   replace(x collate Latin1_General_BIN2, find collate Latin1_General_BIN2, repl) collate DATABASE_DEFAULT
   -- value = 'ABCX' (case-sensitive match)  AND  downstream `= 'abcx'` still matches (CI restored)
   ```

That is a clean, native, schema-non-invasive fix for the worst case. **Your job is to determine
whether the same approach generalises across the surface and across dialects, and what the right
default/opt-in shape is** — not to assume it does.

## The surface to sweep

Every operation whose **correctness depends on the collation of its operands**. For each, line up
the six dialects' emission (lens 2 of the runbook) and ask whether it is JS-faithful (case-sensitive)
under each engine's **default** collation:

- **Value transform**: `_replaceAll` (the sharpest — silently wrong value).
- **Sensitive matching**: `_equals` / `_notEquals`, `_like` / `_notLike`, `_contains` /
  `_notContains`, `_startsWith` / `_notStartsWith`, `_endsWith` / `_notEndsWith` — the variants
  *without* `Insensitive`.
- **Insensitive matching** (the existing `insensitiveCollation` path): confirm it still does what it
  claims on each engine, and interacts sanely with any sensitive-side change.
- **Ordering / grouping / distinct**: `orderBy(col)` (default), `groupBy`, `selectDistinct`, and
  `min`/`max` **on string columns** — all resolve ties / equality by collation.
- **`_in` / `_notIn`** on strings.

For each, the concrete question: on an engine whose default collation is CI/AI, does the operation
behave as JavaScript would (case-sensitive), or does it silently fold case?

## The questions to answer

1. **Per dialect, what is the default matching behaviour?** Map it precisely, by probe, not by
   assumption. Known starting points to VERIFY: PostgreSQL and Oracle are case-sensitive by default;
   MySQL (`utf8mb4_0900_ai_ci`), MariaDB, and SQL Server (`SQL_Latin1_General_CP1_CI_AS`) default to
   CI/AI; SQLite's `=` is `BINARY` (case-sensitive) but `LIKE` is ASCII-CI. Confirm each, and note
   accent-insensitivity separately from case-insensitivity.
2. **Which operations diverge from JS, and on which engines?** Produce the 6×N table.
3. **Does the `BIN2`-style force generalise?** For each affected operation and engine, is there a
   native binary/CS collation that yields JS-faithful behaviour without owning the schema? Get the
   per-dialect collation names (SQL Server `Latin1_General_BIN2`; MySQL/MariaDB `utf8mb4_bin` /
   `utf8mb4_0900_bin`; etc.) and probe. Note the result-collation-leak side effect per operation and
   whether a `DATABASE_DEFAULT`-style reset exists on that engine.
4. **What can the library NOT fix natively**, and must stay a documented limitation (e.g. SQLite
   without ICU for non-ASCII folding — already ruled)? Keep that boundary crisp.

## The design forks to develop

Bring these to the maintainer **with the measurement attached**, per the runbook. The maintainer's
standing principle governs: **what the database provides natively wins over an opt-in; an opt-in is
the last resort.** Options to develop (not necessarily exclusive):

1. **Documentation reinforcement (the maintainer explicitly wants this).** The library already
   supports specifying a collation (`insensitiveCollation`); reinforce the docs to guide users to
   configure collation for the **sensitive** direction too — i.e. how to get JS-faithful
   case-sensitive matching on a CI-default engine (column/DB collation, or a future config). Identify
   every doc page that should carry this guidance (`docs/configuration/connection.md`, each
   `supported-databases/*.md`, the string-operations reference).
2. **A `sensitiveCollation` config**, symmetric to `insensitiveCollation`: when set, sensitive string
   operations force `… collate <value>` so the user pins a CS/binary collation once per connection.
   Evaluate default (off = today's behaviour) vs. the leak/reset handling.
3. **A native default fix for `_replaceAll`** specifically (the probed `BIN2` + `DATABASE_DEFAULT`
   reset) — the cleanest case because it is a value transform, and the silent corruption is the worst
   symptom. Weigh making it the default vs. gating it behind config.
4. **Per-value `.collate(...)`** on string value sources — the most general lever, but the biggest
   surface. Assess whether it is worth it or overkill.

For each fork: the emission, the probe transcript, the blast radius (which dialects), the side
effects (result-collation leak, accent-sensitivity, performance/index usage — a forced collation can
defeat an index), and whether it should be default or opt-in.

## The evidence bar

**PROBE, never reason** — the runbook's rule. Every claim about what an engine does under its default
collation, and every proposed fix, must have a real-engine transcript. Docker containers are managed
by `npm run tests -- --docker`; container names rotate, so resolve them at probe time
(`docker ps --format '{{.Names}} {{.Image}}'`). Credentials: postgres `test`/`test` :55000 · mariadb
`root`/`mariadb-test-pass` :55001 · mysql `root`/`mysql-test-pass` :55002 · oracle
`system`/`OracleTestPass1!` :55003/FREEPDB1 · sqlserver `sa`/`StrongPass1!Sqlsrv` :55004.

Two traps specific to this surface:
- **The container's collation is the test's collation, not the universe's.** Probe the *default*
  behaviour, then probe with an explicit collation forced — and state which collation the container
  runs so a reader knows what the default result depended on.
- **A forced collation can defeat an index** (a `col collate X = …` predicate may stop using an index
  on `col`). Note this per proposed fix — it is a real cost of the sensitive-side force, and part of
  why it should likely be opt-in, not silent.

## Out of scope — the extreme cases we live with

Do not re-litigate these; they are genuine engine/environment boundaries the maintainer has accepted
(name them in the report as explicitly out of scope so nobody re-files them):

- **SQLite `lower()`/`upper()` and `NOCASE` are ASCII-only** — non-ASCII case folding needs an ICU
  build the library can't assume. (`LIMITATIONS.md`.)
- **SQL Server `.length()` at a column's exact maximum length** — the sentinel edge, with the
  `excludeTrailingBlanksInLength` opt-out. (`LIMITATIONS.md`.)
- **Host↔engine timezone** for `localDateTime` epoch — a deployment-configuration matter, unfixable
  in SQL.
- **`.length()` astral characters** (code points vs UTF-16) — a uniform divergence from JS shared by
  all six dialects, not a per-dialect inconsistency.

`replace()` and the sensitive-matching family are **in** scope precisely because, unlike these, the
engine *does* provide a native lever (a binary/CS collation) — so the divergence is a library choice,
not an engine boundary.

## The deliverable

Write the findings to `SEMANTIC_AUDIT_COLLATION_REPORT.md` (transient), ranked by user impact, per the
runbook's report format. Per operation:

- **The promise** (the JS semantics / documented contract) and **the request** (emitted SQL per
  dialect, verbatim).
- **The engine transcript** under the default collation, and under the proposed forced collation —
  copy-pasteable, with the container's collation stated.
- **The blast radius** — which dialects diverge (lens 2, all six lined up).
- **The proposed adjustment** — doc reinforcement / `sensitiveCollation` config / `replaceAll` native
  fix / `.collate()` — with default-vs-opt-in recommendation, the side effects (leak, index, accents),
  and why.
- **Refutations count too** — an operation that is genuinely homogeneous under default collations, or
  a dialect with no native CS collation for some operation, is a result; record it so the next round
  doesn't re-derive it.

End with a **consolidated proposal**: the doc changes to make, the config/API to add (if any), and
the one-or-two operations worth a native default fix — for the maintainer to rule on before any `src/`
change.
