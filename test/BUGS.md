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

## `averageDistinct(intCol)` keeps the int result type, every dialect except SQL Server returns a decimal

**Where**: [`src/connections/AbstractConnection.ts:995-1002`](../src/connections/AbstractConnection.ts#L995-L1002).

**Reproduction**: `conn.averageDistinct(tIssue.priority)` (where `priority` is `INTEGER`) emits `select avg(distinct priority) as ... from issue` and the lib types the resulting column as `NumberValueSource<int>`. PostgreSQL `avg(int)` is `numeric` (string `"2.0000000000000000"`), MariaDB/MySQL `avg(int)` is `decimal`, Oracle is `NUMBER`, SQLite is `real`, all of which the int deserializer then rejects with `INVALID_VALUE_RECEIVED_FROM_DATABASE: Invalid int value received from the db: 2.0000000000000000`. SQL Server is the only dialect where the test happens to pass — `STRING_AGG` truncates `AVG(int)` to int. The same issue applies to plain `average(intCol)` even though no test covers that path yet.

**Current workaround in the suite**: every `select.aggregate-distinct.test.ts` cell wraps the real-DB execution under `if (ctx.realDbEnabled) return` with a `TODO[BUG]` comment so the mock pass still validates SQL emission.

## `UPDATE ... RETURNING` is emitted on `MariaDBConnection` regardless of `compatibilityVersion`

**Where**: [`src/sqlBuilders/MariaDBSqlBuilder.ts`](../src/sqlBuilders/MariaDBSqlBuilder.ts) — no `_buildUpdateReturning` override, so the abstract emission runs unconditionally.

**Reproduction**: `conn.update(tIssue).set({...}).where(...).returning({...}).executeUpdateOne()` on a `MariaDBConnection` emits `update issue set ... where ... returning id as id, ...`. `INSERT ... RETURNING` is gated by `compatibilityVersion >= 10_005_000` already; `UPDATE ... RETURNING` (added in MariaDB 13.0.1 via [MDEV-5092](https://jira.mariadb.org/browse/MDEV-5092)) is not gated, so the lib emits it on 12.x containers and the server rejects it with `ER_PARSE_ERROR (1064): syntax error near 'returning ...'`. The fix is to gate emission by `compatibilityVersion >= 13_000_001` (and decide what to fall back to — e.g. an explicit error, since there is no portable rewrite without `RETURNING`).

**Current workaround in the suite**: [`test/db/mariadb/newest/mariadb/update.returning.test.ts`](db/mariadb/newest/mariadb/update.returning.test.ts) wraps each test body under `if (ctx.realDbEnabled) return` with a `TODO[BUG]` block so the mock pass still validates SQL emission. The MySQL cell already has the test commented out (the dialect has no `RETURNING` at all).

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
