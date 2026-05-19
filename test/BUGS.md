# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
[`MAINTAINING.md` § If a new test surfaces a bug in `src/`](./MAINTAINING.md#if-a-new-test-surfaces-a-bug-in-src).

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

## `.in([])` / `.notIn([])` emit non-portable `in ()` on SQLite instead of short-circuiting

**Where**: [`src/sqlBuilders/SqliteSqlBuilder.ts`](../src/sqlBuilders/SqliteSqlBuilder.ts) — SQLite is the only dialect that does NOT override `_in` / `_notIn` from `AbstractSqlBuilder.ts`. The other dialects detect an empty array and short-circuit to a constant predicate: `where false` (PostgreSqlSqlBuilder, AbstractMySqlMariaBDSqlBuilder), `where (0=1)` (SqlServerSqlBuilder, OracleSqlBuilder), with the symmetric `true` / `(1=1)` for `_notIn`.
**Reproduction**: `tIssue.id.in([])` emits `where id in ()`, and `tIssue.id.notIn([])` emits `where id not in ()`. SQLite 3.51 (bun:sqlite) and 3.52 (sqlite3 npm) both *accept* this syntax (empty-list `in` / `not in` is a SQLite extension, not standard SQL), so the canonical `bun_sqlite` cell passes — but the SQL is non-portable (any dialect parser that follows the standard rejects it) and emits a parameterless `in ()` instead of the constant predicate the rest of the library produces. The library's consistency contract is broken for SQLite alone.
**Current workaround in the suite**: the two snapshot tests in `select.where.empty-in.test.ts` (every sqlite cell) wrap the `executeSelectMany()` call in `try { … } catch (e) { if (!ctx.realDbEnabled) throw e }` defensively in case a future SQLite build tightens the rule, and the SQL snapshot is marked with a `TODO[BUG]` so it gets regenerated to a constant predicate when SQLite adopts the short-circuit.

## `stringConcatDistinct(col, separator)` emits SQL that SQLite always rejects

**Where**: [`src/sqlBuilders/SqliteSqlBuilder.ts`](../src/sqlBuilders/SqliteSqlBuilder.ts), `_stringConcatDistinct` (around lines 484–492). The method emits `group_concat(distinct <col>, <sep>)` for any non-`undefined` separator argument.
**Reproduction**: `connection.stringConcatDistinct(tIssue.status, '|')` and `connection.stringConcatDistinct(tIssue.status, '')` both raise `SQLITE_ERROR: DISTINCT aggregates must have exactly one argument` against the real DB. Confirmed on SQLite 3.51.0 (bun:sqlite) and 3.52.0 (sqlite3 npm) — it is a fundamental SQLite restriction (see [SQLite aggregate functions docs](https://www.sqlite.org/lang_aggfunc.html#groupconcat)), not a version-bundled quirk. The `separator: undefined` form (`stringConcatDistinct(col)`) works fine and emits `group_concat(distinct col)`. There is a precedent for this kind of dialect note in [`docs/configuration/supported-databases/oracle.md`](../docs/configuration/supported-databases/oracle.md) (the `LISTAGG(DISTINCT …)` requires-19c info block) — the SQLite analogue is missing both from the docs and from the type surface; the fixing agent decides whether the right fix is a doc note, a runtime guard, a type-level rejection of the separator overload on SQLite, or a SQL rewrite (e.g. wrap in a `SELECT DISTINCT` subquery before applying `group_concat(col, sep)`).
**Current workaround in the suite**: in every sqlite cell, `string-concat-distinct-string-separator` and `string-concat-distinct-empty-separator` in `select.string-concat-aggregate.test.ts` wrap the `executeSelectOne()` call in `try { … } catch (e) { if (!ctx.realDbEnabled) throw e }` so the SQL snapshot still asserts.

## `stringConcatDistinct` drops `distinct` on MySQL/MariaDB when separator is `''`

**Where**: [`src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts`](../src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts), `_stringConcatDistinct`, the `separator === ''` branch (around lines 549–557).
**Reproduction**: `conn.stringConcatDistinct(col, '')` emits `group_concat(col separator '')` — the `distinct` keyword is missing. Compare the same branch above it (separator `undefined`) which correctly emits `group_concat(distinct col)`, and the `else` below it which correctly emits `group_concat(distinct col separator ?)`. The empty-string branch was clearly meant to read `group_concat(distinct col separator '')`.
**Current workaround in the suite**: snapshot test `string-concat-distinct-empty-separator` in `select.string-concat-aggregate.test.ts` (mysql/mysql2 + mariadb/mariadb cells) captures the buggy SQL verbatim and is marked with a `TODO[BUG]` next to the inline snapshot so the snapshot gets updated when the keyword is restored.

## `docs/about/limimitations.md` is misspelled (should be `limitations.md`)

**Where**: [`docs/about/limimitations.md`](../docs/about/limimitations.md) — the filename has a duplicated `mi` (`limimitations` instead of `limitations`). Every cross-link in the repository carries the typo verbatim (e.g. [`test/LIMITATIONS.md`](./LIMITATIONS.md) references it, the page's own anchor URLs propagate it).
**Reproduction**: `ls docs/about/` lists `limimitations.md`. `grep -r limimitations docs/ test/` returns multiple hits — the typo has propagated through the repo because every link was copy-pasted from the original filename.
**Current workaround in the suite**: none — purely a documentation/file-naming bug. The fixing agent must rename the file (`git mv`) and update every relative link in `docs/`, `test/` and `README.md`. The `mkdocs` build also needs to be checked (the file is served from `docs/`, so the public URL changes and a redirect or release note may be appropriate).

---

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

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
3. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or rewrite the
   comment-out reason to its final form — e.g. "Not applicable on
   `<DB>`: <reason>; see `test/db/<db>/types.negative/<file>.ts` for
   the compile-time negative".
4. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
