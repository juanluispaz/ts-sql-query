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

## `Values.as(alias)` / `forUseInLeftJoinAs(alias)` emit unnamed columns

**Where**: [src/Values.ts:47-65](../src/Values.ts#L47-L65) — `as` and
`forUseInLeftJoinAs` clone the values view by invoking the user's
constructor (`new ((this as any).constructor)(this.__name, this.__values)`),
which produces a fresh instance whose `column(...)` initialisers
write `''` as the column name (L96-98 / L130-132). Both methods then
call `result.__setColumnsName(this as any, '')` — passing `this` (the
ORIGINAL source) instead of `result`, so the helper iterates the
source's columns and rewrites their already-correct names. The
result's own columns stay unnamed.

**Reproduction**: see canonical Wave 90 test
`values-aliased-via-as-keeps-original-with-name` (and
`values-for-use-in-left-join-as-emits-left-join`). The baked SQL
contains `pp.""` qualifiers because the alias's columns have empty
names. Compare with `Values.create(type, name, values)` at L272-278
which correctly passes `result` to `__setColumnsName`, yielding
properly named columns.

The fix is almost certainly to swap the argument:
`result.__setColumnsName(result as any, '')` in both `.as(alias)` and
`.forUseInLeftJoinAs(alias)`.

**Current workaround in the suite**: the snapshots in
`with-values.advanced.test.ts` pin the current broken `pp.""` SQL
under a `TODO[BUG]` comment on the assertion (the tests stay green
in mock mode; the real-DB branch wraps execution in a try/catch
because the engines reject `""` as a column name).

---

## `getInnerObjetRuleToApply` Rule 4 is unreachable (dead branch)

**Where**: [src/internal/DBColumnImpl.ts:216-298](../src/internal/DBColumnImpl.ts#L216-L298) — `getInnerObjetRuleToApply`. Lines 219, 241, 293-297.

**Reproduction**: `innerObjectsAreRequired` is initialised to `true`
at L219 and the only write inside the loop (L241) sets it back to
`true`. There is no path that sets it to `false`. The final check at
L293 is therefore `containsRequired || true` → always truthy, so the
function never reaches `return 4` at L297. The matching `case 4`
branch inside `createColumnsFromInnerObject` at L193-198 is dead by
construction.

The same wave (`select.complex-projection.inner-rules.test.ts`)
shows Rule 1 / Rule 2 / Rule 3 firing as expected — it's only Rule 4
that's unreachable. Suggested fix is probably either to flip the
initial value to `false` (so "no inner objects" means "we don't
require them") or to mirror the `innerObjectsAreRequired = innerObjectsAreRequired && (…)`
pattern. Both belong to the fixing agent.

**Current workaround in the suite**: the canonical Wave 86 test
`select-cte-nested-object-default-rule-falls-through-to-rule-3`
documents that "default → expected Rule 4, current behaviour folds
to Rule 3" with a `TODO[BUG]` on the assertion (the snapshot pins
the Rule-3 behaviour the lib currently produces so the suite stays
green).

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
