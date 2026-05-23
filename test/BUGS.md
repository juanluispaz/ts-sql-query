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

## `doUpdateDynamicSet(columns)` / `onConflictDoUpdateDynamicSet(columns)` throw `Illegal state` when invoked with the documented initial-columns argument

**Where**: [src/queryBuilders/InsertQueryBuilder.ts:1763-1775](../src/queryBuilders/InsertQueryBuilder.ts#L1763-L1775) (`doUpdateDynamicSet`) and the twin at [L1662-1674](../src/queryBuilders/InsertQueryBuilder.ts#L1662-L1674) (`onConflictDoUpdateDynamicSet`). The optional-arg overload is documented in [docs/api/insert.md:313-334](../docs/api/insert.md#L313-L334) (`doUpdateDynamicSet(columns: UpdateSets): this`).
**Reproduction**: `insert.on-conflict.dynamic-set.test.ts` `do-update-dynamic-set-with-initial-columns-then-set-if-value` (TODO[BUG]-wrapped). Any non-empty argument triggers the throw — the method first delegates to `doUpdateSet(columns)` (which assigns `this.__onConflictUpdateSets = {…}`) and then immediately asserts `if (this.__onConflictUpdateSets) throw 'Illegal state'`. The bug exists on all dialects that type either overload; the no-arg form `.doUpdateDynamicSet().set({…})` still works.
**Current workaround in the suite**: the targeted test is wrapped in a `/* */` block with a `TODO[BUG]` reason. The active twin `do-update-dynamic-set-then-set-if-value-skips-undefined-incremental` covers the no-arg path. Once fixed, uncomment the wrapped test and remove this entry.

## Stray `console.log('b')` in `InsertQueryBuilder.disallowAnyOtherSet` multi-row allowed branch

**Where**: [src/queryBuilders/InsertQueryBuilder.ts:1363](../src/queryBuilders/InsertQueryBuilder.ts#L1363) — inside the multi-row branch of `disallowAnyOtherSet(...)`, the `else` arm that runs when the staged property IS in the allow-list executes `console.log('b')`. Debug leak left after the surrounding logic was finished.
**Reproduction**: `insert.multi-row.set-rules.test.ts` `disallow-any-other-set-permits-rows-when-every-set-is-allowed` — a 2-row insert with 3 allowed properties prints `b` six times to stdout.
**Current workaround in the suite**: the test installs a `console.log` spy, asserts on the six `'b'` calls and pins the intended SQL via inline snapshot. Marked `// TODO[BUG]` on the test. Once removed in `src/`, drop the spy + the `expect(bCalls).toHaveLength(6)` assertion and the `TODO[BUG]` comment.

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
