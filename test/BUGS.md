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

## `dynamicPickPaths` drops branches whose picked leaf is found via deep recursion

**Where**: `src/dynamicCondition.ts:142`, inside `internalDynamicPickPaths`.
The line is a bare `hasContent` expression statement where it must be
`hasContent = true`. When a level's only content comes from a *recursive*
call (a path nested ≥2 levels, e.g. `'group.sub.priority'`), `hasContent`
stays `false`, the level returns `undefined`, and the parent discards the
whole branch. The direct-leaf case (`(prefix + '.' + prop) in required`,
L136-138) sets the flag correctly, so 1- and 2-level paths work — only
deeper recursion is affected. `internalDynamicPick` (the `dynamicPick`
sibling, L82) sets `hasContent = true` correctly, so nested `dynamicPick`
is NOT affected.
**Reproduction**: `test/db/*/*/*/dynamic-condition.pick.test.ts` →
`pick/nested-dynamic-pick-paths-depth-3`. `dynamicPickPaths(availableFields,
['group.sub.priority'], ['id'])` over a 3-level `availableFields` emits
`select id as id from issue where id = $1` — the `group.sub.priority`
column is silently absent; only the mandatory `id` survives.
**Current workaround in the suite**: that test is marked `// TODO[BUG]`
and its SQL/params/value snapshots pin the buggy output (the type assertion
still describes the intended shape). Remove the marker and re-bake once
L142 is fixed.

## `dynamicConditionFor` silently ignores a column-level object-valued extension rule

**Where**: `src/queryBuilders/DynamicConditionBuilder.ts:137-144` /
`processAdditionalColumnFilter` (L193-235). When a column (value source) is
filtered with a key whose extension entry is an *object* (not a function),
`processColumnFilter` forwards to `processAdditionalColumnFilter` passing
the column's whole `filter` again (not the inner `value`), so the inner
rule keys never line up and nothing is dispatched — the rule is dropped
with no error and no predicate.
**Reproduction** (probe, not committed): `selectFields = { id: tIssue.id }`,
`extension = { meta: { byRange: (v) => tIssue.id.greaterThan(v) } }`,
`filter = { id: { meta: { byRange: 5 } } }` → emitted SQL is
`select id as id from issue` (no WHERE). The whole
`processAdditionalColumnFilter` body is unreachable in any meaningful way
through the public API.
**Current workaround in the suite**: none — no committed test exercises
this path (it cannot assert a meaningful outcome). Documented here so the
fixing agent can decide whether the rule should dispatch (pass `value`
instead of `filter`) or the path should be removed.

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
