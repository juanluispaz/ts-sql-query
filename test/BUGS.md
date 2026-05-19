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

## `setForAllIfValue` (and sibling `setForAllIf*` methods) missing on the post-`values([...])` builder type

**Where**: [`docs/queries/insert.md` § Manipulating values to insert (multiple)](../docs/queries/insert.md#manipulating-values-to-insert-multiple). The interface listed on the page advertises `setForAll`, `setForAllIfValue`, `setForAllIfSet`, `setForAllIfNotSet`, …, `setForAllIfHasValue`, `setForAllIfHasNoValue`, plus `When` variants. The builder type returned by `.values([...])` — `CustomizableExecutableMultipleInsert<TABLE, USING, undefined>` from [`src/expressions/insert.ts:121`](../src/expressions/insert.ts) — does NOT expose them. Only the shaped (`shapedAs`) variants and the missing-keys (`dynamicValues`) variants reach a builder type that surfaces them (`ShapedExecutableMultipleInsertExpression` at line 432, `MissingKeysMultipleInsertExpression` at line 491).
**Reproduction**: `connection.insertInto(tProject).values([{...}, {...}]).setForAllIfValue({ archivedAt: null })` errors with `TS2339: Property 'setForAllIfValue' does not exist on type 'CustomizableExecutableMultipleInsert<…>'`. The same chain works at runtime — the underlying object has the methods, the type surface just hides them.
**Current workaround in the suite**: `docs-extra:insert/set-for-all-if-value-multi` in `test/db/sqlite/newest/bun_sqlite/docs.insert.test.ts` (mirrored to every cell) is commented out per the symmetry rule with a `TODO[BUG]: see BUGS.md` reason. Uncomment when the typed surface on `CustomizableExecutableMultipleInsert` is widened to match the prose.

## Docs prose for deferred-hook registrations says "have no effect" — runtime throws `NOT_IN_TRANSACTION`

**Where**: [`docs/queries/transaction.md` § Deferring logic during a transaction](../docs/queries/transaction.md#deferring-logic-during-a-transaction) — the page note states "They have no effect if called when there is no active transaction." for `executeBeforeNextCommit` / `executeAfterNextCommit` / `executeAfterNextRollback`. The runtime on a real-DB connection throws `TsSqlProcessingError { reason: 'NOT_IN_TRANSACTION' }` from [`src/connections/AbstractConnection.ts`](../src/connections/AbstractConnection.ts) (~line 148 and the matching sibling entry points). Throwing is plausibly the intended behaviour — registering a deferred hook with no transaction to defer to has no meaningful semantics — so the most likely fix is to **rewrite the docs prose** rather than soften the runtime check. A reviewer should still confirm: is `NOT_IN_TRANSACTION` the documented contract, or is "no effect" load-bearing somewhere else?
**Reproduction**: call `connection.executeBeforeNextCommit(() => {})` (or either sibling) outside any open transaction on a real-DB connection — it throws synchronously. The check is also short-circuited for mocked runners by `if (!this.queryRunner.isMocked() && !this.isTransactionActive())`, so a mock connection silently accepts the registration and never fires the hook. That mock/real divergence is a second, smaller question worth resolving with the same review.
**Current workaround in the suite**: `docs-extra:transaction/hooks-no-effect-without-transaction` in `test/db/sqlite/newest/bun_sqlite/docs.transaction.test.ts` (mirrored to every cell) branches on `ctx.realDbEnabled` — asserts the throw in real-DB mode, asserts no-throw in mock mode — and carries a `// TODO[BUG]` note pointing here so it surfaces when the docs page is rewritten (or, less likely, the runtime check is dropped).

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
