# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy (CLAUDE.md), the agent does NOT touch `src/` when
finding bugs — only documents them and marks the test so the suite
stays green.

---

## PostgreSqlConnection accepts `onConflictDoUpdateSet(...)` (bare form) but PostgreSQL requires a conflict target

**Kind**: TS too loose (typing gap).

**Where**:
- Lib: `src/connections/PostgreSqlConnection.ts` (and/or whatever class
  exposes the `onConflictDoUpdateSet` method on PostgreSQL).
- Docs: [`docs/queries/insert.md` § "Insert on conflict do update
  ('upsert')"](../docs/queries/insert.md) explicitly says: *"On
  **PostgreSQL** you must say which unique-key column or constraint
  triggers the update. Use `.onConflictOn(...)` (or
  `.onConflictOnConstraint(...)`) chained with
  `.doUpdateSet({...})`. On **MariaDB** and **MySQL** the update fires
  on any unique-key violation; you don't specify which one. Use the
  bare `.onConflictDoUpdateSet({...})`."*

**Reproduction**:

The test
`docs-extra:insert/insert-on-conflict-do-update-bare` in
`docs.insert.test.ts` calls `.onConflictDoUpdateSet({...})` (the bare
form). On PostgreSqlConnection the call **type-compiles** and the
SqlBuilder emits:

```sql
insert into organization (name, plan)
values ($1, $2)
on conflict do update set plan = $3
returning id as id, name as name, plan as plan
```

That SQL is invalid on real PostgreSQL — `pglite` rejects it with
"ON CONFLICT DO UPDATE requires inference specification or constraint
name". The other postgres cells (`pg`, `postgres`, `bun_sql_postgres`)
silently pass under mock mode because mock doesn't execute the SQL.

**Current workaround in the test suite**:

The test is wrapped `/* … */` in every postgres cell (newest + oldest,
all four connectors) with the reason: *"Not applicable on PostgreSQL:
PostgreSQL requires onConflictOn(column) — the bare
onConflictDoUpdateSet emits 'on conflict do update' without a target,
which postgres rejects."*

```bash
grep -l "the bare onConflictDoUpdateSet emits 'on conflict do update'" test/db/postgres/*/*/docs.insert.test.ts
```

**Expected fix**:

`PostgreSqlConnection` should NOT type `.onConflictDoUpdateSet({...})`
(no target). The method should be exposed only on MariaDBConnection,
MySqlConnection, and SqliteConnection (where the bare form is
documented as the supported shape). On PostgreSQL the user should be
required to use `.onConflictOn(col).doUpdateSet({...})` or
`.onConflictOnConstraint(name).doUpdateSet({...})`.

When this is fixed, also uncomment the test in all eight postgres
cells.
