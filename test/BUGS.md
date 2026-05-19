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

## Row-shape mismatch from a mock surfaces as MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE deep in the projector

**Where**: row transform in
[`src/queryBuilders/AbstractQueryBuilder.ts:59`](../src/queryBuilders/AbstractQueryBuilder.ts#L59)
(`__transformValueFromDB`), reached from every `execute*` path in
`SelectQueryBuilder.ts` etc. — surfaced via `MockQueryRunner` because
the runner just hands the queued value through unchanged.
**Reproduction**: in any mock-mode cell, queue a partial row and
select more columns than the mock provides:

```ts
ctx.mockNext([{ id: 1 }])            // missing `title`
await ctx.conn.selectFrom(tIssue)
    .select({ id: tIssue.id, title: tIssue.title })  // title required
    .executeSelectMany()
// throws:
// TsSqlProcessingError { reason: 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE',
//   columnPath: 'title', rowIndex: 0, ... }
```

The error message says "Expected a value as result of the column
`title` at index `0`, but null or undefined value was found" — true to
fact, but the only hint that the *mock* is the source is the
`MockQueryRunner` frame in the stack, which is easy to miss; nothing
in the message says "your mock did not return the requested shape".
The mock surface is part of the public API (per `CLAUDE.md`), so the
question is whether to:

1. Validate the mock-returned row shape against the projector at the
   mock-runner boundary, with a dedicated `INVALID_MOCKED_VALUE`
   reason naming the mock and the missing keys — symmetric with the
   `isPlainObject` validation already there.
2. Tighten the projector's error message to mention "or a mock that
   didn't return this column" — minimal change, no behaviour shift.
3. Leave it (defend the invariant "the data layer returns a complete
   row").

Not sure if it's a bug or a docs/UX gap. Flagging because the user
asked to review public-surface oddities in deeper detail.

**Current workaround in the suite**: tests that only assert SQL/params
seed the mock with `ctx.mockNext([])` so the projector skips
transformation entirely; tests that assert the result body provide a
mock row whose keys match the `select({...})` shape 1:1. The pattern
is documented in
[`MAINTAINING.md` § Test-context surface](./MAINTAINING.md#test-context-surface).

---

_No other open entries._

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
