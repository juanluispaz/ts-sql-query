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

## PostgreSqlSqlBuilder: `aggregateAsArrayDistinct` emits `json_agg(distinct json_build_object(...))` which PG rejects

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts` `_appendAggragateArrayColumns`
(L3105). PostgreSqlSqlBuilder inherits the abstract default which emits
`json_agg(distinct json_build_object(...))`. PostgreSQL has no
equality operator for the `json` type, so DISTINCT rejects with
`could not identify an equality operator for type json`. `jsonb_agg`
(or `json_agg(distinct ... )` over a `jsonb` payload) would be valid.

**Reproduction**: `test/db/postgres/newest/pg/select.aggregate.array-empty-coercion.test.ts`
test `aggregateAsArrayDistinct-on-object-shape`. SQL emitted:
`select organization.id as id, ..., json_agg(distinct json_build_object('id', project.id, 'name', project.name)) as projects from organization left join project on project.organization_id = organization.id where organization.id = $1 group by organization.id, organization.name`.
The same call with `aggregateAsArrayOfOneColumnDistinct(singleColumn)`
(not the object form) works because PG defines equality for the
column's underlying scalar type.

**Current workaround in the suite**: the test is **commented-out** in
every postgres cell (8 cells) per DESIGN.md §4.1 with the reason line
above the block. The non-distinct sibling tests still run end-to-end.
SQLite/MariaDB cells keep the test active because their JSON aggregates
DO support DISTINCT.

## PostgreSqlSqlBuilder: ORDER BY ... COLLATE emits unquoted collation name

**Where**: `src/sqlBuilders/PostgreSqlSqlBuilder.ts` — no override of
`_appendOrderByColumnAliasInsensitive`. The value-source insensitive
ops (`_equalsInsensitive`, `_likeInsensitive`, etc.) DO quote the
collation in PostgreSqlSqlBuilder with `'... collate "' + collation + '"'`
(e.g. L248), but the ORDER BY path inherits the abstract default at
[AbstractSqlBuilder.ts L1115](../src/sqlBuilders/AbstractSqlBuilder.ts#L1115)
which emits `' collate ' + collation` without quoting.

**Reproduction**: `test/db/postgres/newest/pg/select.order-by.insensitive.test.ts`
test `collation-set: order-by-insensitive` (and its asc/desc variants).
With `insensitiveCollation: 'C'`, the builder emits
`order by app_user.full_name collate C`; PostgreSQL lowercases the
unquoted identifier and rejects with `collation "c" for encoding "UTF8"
does not exist`. The equivalent value-source op (e.g. `.equalsInsensitive`)
correctly emits `... collate "C"` and runs.

**Current workaround in the suite**: the three `collation-set: order-by-*`
tests gate their assertion with `if (ctx.realDbEnabled) return` and
carry a `// TODO[BUG]` comment naming this entry. The mock-mode SQL
snapshot still pins the (broken) emission so the fix is visible as a
snapshot diff.

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
