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

## `__isAllowed` recursion has no top-level entry point — entire `__isAllowed` web is dead code

**Where**: cross-cutting; the methods themselves live at [SelectQueryBuilder.ts:1122-1232](../src/queryBuilders/SelectQueryBuilder.ts#L1122-L1232) (`PlainSelectQueryBuilder.__isAllowed`), [SelectQueryBuilder.ts:1330-1396](../src/queryBuilders/SelectQueryBuilder.ts#L1330-L1396) (`CompoundSelectQueryBuilder.__isAllowed`), [DeleteQueryBuilder.ts:408-465](../src/queryBuilders/DeleteQueryBuilder.ts#L408-L465), [UpdateQueryBuilder.ts:988-1059](../src/queryBuilders/UpdateQueryBuilder.ts#L988-L1059), [InsertQueryBuilder.ts:1933+](../src/queryBuilders/InsertQueryBuilder.ts#L1933) and the dispatcher [utils/ITableOrView.ts:94-102](../src/utils/ITableOrView.ts#L94-L102). `grep -rn '\.__isAllowed(' src/ | wc -l` returns ~30 lines; every single one is *another* `__isAllowed` method calling its peers. The recursion has no seed: no `execute*` / `query()` / `_build*` ever calls `__isAllowed` at the top, only the leaf `AllowWhenValueSource.__toSql` throws when it actually has to render.

**Reproduction**: `grep -rn "\\.__isAllowed(\\|isAllowedQueryColumns(" src/ --include="*.ts" | grep -v "// "` — every match is inside another `__isAllowed` body or inside `isAllowedQueryColumns` which is only called from `__isAllowed`. Disallow gating today works only because the leaf `AllowWhenValueSource.__toSql` throws when the column is actually appended; the `__isAllowed` short-circuit was presumably intended to let parent shapes (compound selects, raw fragments embedding gated columns) refuse early without rendering, but no entry point ever asks. Net effect: `__isAllowed` propagation in `PlainSelectQueryBuilder` / `CompoundSelectQueryBuilder` / `DeleteQueryBuilder` / `UpdateQueryBuilder` / `InsertQueryBuilder` reports 0% coverage in `bun run tests --use-vitest --coverage` even though every public allow/disallow surface is exercised. Either wire `__isAllowed` from `query()` (so disallowed gates throw before any SQL renders) or delete the dead web.

**Current workaround in the suite**: none needed — user-visible behaviour is unaffected (the throw still fires from `__toSql`). Tests focus on the throw path. Not blocking; reported here so the dead code surfaces during cleanup.

## `FragmentValueSource.__isAllowed` calls the wrong inner method (`__getValuesForInsert` instead of `__isAllowed`)

**Where**: [src/internal/ValueSourceImpl.ts:1616-1626](../src/internal/ValueSourceImpl.ts#L1616-L1626). The `__isAllowed` override on `FragmentValueSource` iterates `__sqlParams` and asks each param `value.__getValuesForInsert(sqlBuilder)` — almost certainly a copy-paste from the immediately preceding `__getValuesForInsert` override (L1605-1614). Should call `value.__isAllowed(sqlBuilder)`.

**Reproduction**: synthetic, because the recursive `__isAllowed` web has no top-level entry today (see preceding entry). Once the entry-point lands, a typed fragment built via `connection.fragmentWithType('boolean','required').sql\`${tIssue.title.allowWhen(false, 'gate')} is not null\`` will be reported as `__isAllowed === true` regardless of the gate state, because the loop asks for the wrong piece of metadata. Even today the bug is observable as a coverage artifact: every iteration of the loop will execute `__getValuesForInsert` on the param (a no-op for non-insert contexts), masking the intended `__isAllowed` check.

**Current workaround in the suite**: none — bug doesn't surface user-visibly today (the `__toSql` throw fires from the leaf `AllowWhenValueSource.__toSql` independently of `__isAllowed`). Reported here so the fix lands when the `__isAllowed` web is wired up.

_No further open entries._

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
