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

## MySQL/MariaDB `_notEndsWith` emits `like` instead of `not like`

**Where**: [`src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts`](../src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts) — the `_notEndsWith` override (around L398) copies the body of `_endsWith` and forgets to flip `like` to `not like`. All other not-prefixed string operators (`_notStartsWith`, `_notContains`, `_notStartsWithInsensitive`, `_notEndsWithInsensitive`, `_notContainsInsensitive`) emit `not like` correctly, only `_notEndsWith` is wrong.

**Reproduction**: in [`test/db/mariadb/newest/mariadb/select.where.operators-negative.test.ts`](db/mariadb/newest/mariadb/select.where.operators-negative.test.ts) and [`test/db/mysql/newest/mysql2/select.where.operators-negative.test.ts`](db/mysql/newest/mysql2/select.where.operators-negative.test.ts), the `not-ends-with` test:

```ts
.where(tAppUser.email.notEndsWith('@acme.test'))
```

emits `select id as id from app_user where email like concat('%', ?) order by id` (note the missing `not`). The correct rendering — matching every other dialect and the sibling `_notStartsWith` override one method up — would be `email not like concat('%', ?)`.

**Current workaround in the suite**: both `not-ends-with` tests have a `TODO[BUG]` block. The SQL snapshot is left intentionally pinned to the buggy output (so the fix breaks it and alerts the agent), and the `expect(result).toEqual(expected)` value assertion is guarded behind `if (!ctx.realDbEnabled)` because the buggy SQL returns the wrong rows on a real DB.

---

## SqliteSqlBuilder / SqlServerSqlBuilder `_asDouble` missing space before `as`

**Where**: [`src/sqlBuilders/SqliteSqlBuilder.ts:279`](../src/sqlBuilders/SqliteSqlBuilder.ts#L279) and [`src/sqlBuilders/SqlServerSqlBuilder.ts`](../src/sqlBuilders/SqlServerSqlBuilder.ts) (search `_asDouble`). Both return `'cast(' + this._appendSql(...) + 'as real)'` / `'as float)'` — note the missing space between the column expression and `as`. Oracle's override is correct (`+ ' as float)'`). PostgreSQL uses `::float` so it isn't affected; MySQL/MariaDB use `* 1.0` so they aren't either.

**Reproduction**: in [`test/db/sqlite/newest/bun_sqlite/select.numeric-ops.test.ts`](db/sqlite/newest/bun_sqlite/select.numeric-ops.test.ts) and [`test/db/sqlserver/newest/mssql/select.numeric-ops.test.ts`](db/sqlserver/newest/mssql/select.numeric-ops.test.ts), the `asDouble` test:

```ts
.select({ id: tIssue.id, d: tIssue.priority.asDouble() })
```

emits `select id as id, cast(priorityas real) as "d" from issue where id = ?` on SQLite (and the equivalent `cast(priorityas float)` on SqlServer). The engines reject it with `SQLITE_ERROR: near "real": syntax error` / the SqlServer equivalent. Correct rendering would be `cast(priority as real)` / `cast(priority as float)`.

**Current workaround in the suite**: every `asDouble` test wraps `executeSelectMany()` in `try { … } catch (e) { if (!ctx.realDbEnabled) throw e }` so the SQL snapshot is still asserted after the runner errors on real engines. The SQLite and SqlServer snapshots are intentionally pinned to the buggy `cast(priorityas real)` / `cast(priorityas float)` so the fix breaks them. Non-affected dialects (Postgres, Oracle, MySQL, MariaDB) bake their correct SQL and keep the same try/catch for symmetry.

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
