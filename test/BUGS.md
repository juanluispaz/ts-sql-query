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

## Default keyword not supported by SQLite

**Where**: `src/sqlBuilders/SqliteSqlBuilder.ts` and `src/connections/SqliteConnection.ts`.
**Reproduction**: any insert/update that sets a `columnWithDefaultValue`
column to `connection.default()` typechecks on `SqliteConnection` but
SQLite rejects the resulting SQL at runtime:

```sql
insert into organization (name, "plan", created_at)
       values (?, ?, default)
-- → "near \"default\": syntax error"
```

SQLite's grammar does not allow `DEFAULT` as a value expression in
`INSERT VALUES`, `UPDATE SET`, or `ON CONFLICT DO UPDATE SET` —
unlike PostgreSQL / MySQL / MariaDB / Oracle / SQL Server which all
accept it. Fix is two-step: narrow the `T | Default` union on
`SqliteConnection` (so the type rejects `.default()` like it does for
columns without a DDL default), and add a `@ts-expect-error` rule
under `test/db/sqlite/types.negative/` to lock the contract.
**Current workaround in the suite**:
`test/db/sqlite/newest/<connector>/insert.default-keyword.test.ts`
keeps every test commented out with `TODO[BUG]` headers — the file
is still present in every sqlite cell for symmetry, but no SQL is
emitted. The other dialects exercise the keyword normally.

## Default keyword wrapped by CustomBooleanTypeAdapter remap

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts` — set-value emission
path for columns that use `CustomBooleanTypeAdapter` (or any adapter
that goes through `_appendCustomBooleanRemapForColumnIfRequired`).
**Reproduction**: setting a custom-boolean column to
`connection.default()` (typed as `T | Default`) emits the literal
keyword `default` *inside* the boolean remap case expression, e.g.

```sql
insert into organization (name, "plan", verified)
       values (?, ?, case when default then 'Y' else 'N' end)
```

`default` is not a boolean — every dialect rejects it as a syntax
error at execution time. The mock cells pass (no execution), so it
only surfaces with `--docker`. The emitter should detect that the
SET value is the `Default` sentinel and short-circuit the boolean
remap, emitting just `default` (the same path used for `localDateTime`
columns today).
**Current workaround in the suite**:
`test/db/<db>/<version>/<connector>/insert.default-keyword.test.ts`
targets `createdAt` (localDateTime, no remap) on every cell instead
of `verified` / `published`. There is no `TODO[BUG]`-tagged case
because the buggy combination is not exercised — the file header
notes the bug and points here.


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
