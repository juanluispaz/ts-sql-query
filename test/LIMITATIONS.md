# `test/` — known library limitations that affect tests

Extends [`docs/about/limimitations.md`](../docs/about/limimitations.md)
with limitations that **only the project author can declare as such**.
These are deliberate gaps in the library — not bugs to fix, not docs to
update — that an agent writing tests needs to know about so it doesn't
waste cycles assuming the library will enforce or expose something it
won't.

Treat anything listed here as a **constraint**, not a TODO. If you
think one of these should change, ask first.

How a limitation differs from a bug:

|  | Limitation | Bug |
|---|---|---|
| Declared by | The project author | Anyone who runs into it |
| Lives in | This file, plus a one-line `// TODO[LIMITATION]` on affected tests | [`BUGS.md`](./BUGS.md) and a one-line `// TODO[BUG]` |
| Fix expected | Not on the near-term roadmap | Yes, once an agent picks it up |
| Test action | Skip or work around — see the entry for the recipe | Mark the assertion and keep the suite green per [`MAINTAINING.md`](./MAINTAINING.md#if-a-new-test-surfaces-a-bug-in-src) |

To find affected tests:

```bash
grep -rn "TODO\[LIMITATION\]" test/db/
```

---

## GROUP BY column requirements vary by dialect and the library doesn't enforce

**Engines split into two camps:**

- **Strict** — [SQL Server](../docs/configuration/supported-databases/sqlserver.md)
  and [Oracle](../docs/configuration/supported-databases/oracle.md)
  require **every** non-aggregated column that appears in the SELECT
  to also appear in the `GROUP BY`. Forgetting one is a runtime SQL
  error.
- **Permissive** — [PostgreSQL](../docs/configuration/supported-databases/postgresql.md)
  (since 9.1, when the PK is in the GROUP BY), [MySQL](../docs/configuration/supported-databases/mysql.md),
  [MariaDB](../docs/configuration/supported-databases/mariadb.md) and
  [SQLite](../docs/configuration/supported-databases/sqlite.md) accept
  forms where some non-aggregated columns are omitted from GROUP BY.

`ts-sql-query` **does not detect the difference**. A query that
compiles and runs fine on PostgreSQL may crash at execution time
against SQL Server or Oracle with a "column not in group by"
diagnostic. The type system has no way of telling.

**What this means for tests** — when you write a `docs:` /
`docs-extra:` test that uses `groupBy`, always include EVERY
non-aggregated column from the projection in the `groupBy` argument
list, even if your local sqlite/postgres canonical accepts the
shorter form. The conservative shape ports cleanly to every cell.

```ts
// Good — explicit, works on all six dialects:
.groupBy(tOrganization.id, tOrganization.name)
.select({
    organizationId:   tOrganization.id,
    organizationName: tOrganization.name,
    projectCount:     connection.count(tProject.id),
})

// Risky — SQL Server / Oracle will reject this at runtime:
.groupBy(tOrganization.id)
.select({
    organizationId:   tOrganization.id,
    organizationName: tOrganization.name, // <-- not in GROUP BY
    projectCount:     connection.count(tProject.id),
})
```

The existing `docs:select/aggregate-and-group-by` and
`docs:select/with-clause` tests follow the conservative shape; do the
same in any new aggregate test.

## Aggregate functions are not flagged as aggregates in the type system

The library exposes `count(...)`, `sum(...)`, `avg(...)`, etc., but
the TypeScript surface treats them as ordinary value expressions —
there is no separate "AggregateValueSource" type. Two consequences:

1. **An aggregate can land where it isn't legal.** The type system
   does NOT prevent you from putting `connection.count(tFoo.id)` in a
   `where(...)` clause; the engine will reject it at runtime ("aggregate
   functions are not allowed in WHERE", or the dialect's equivalent).
   The library has no way of knowing.
2. **The library cannot derive a `HAVING` requirement from the
   query shape.** You must place aggregate predicates in `.having(...)`
   yourself; `.where(...)` won't be rewritten for you.

**What this means for tests** — never put an aggregate in `where`,
even when the snippet you are porting from the docs page seems to. If
you need a predicate on an aggregate, use `.having(...)`. If the
runtime cell rejects something a mock cell accepted (because the mock
doesn't execute the SQL), it is almost always this case. Treat as
"test author error", not as a bug.

## pglite does not bundle the latest PostgreSQL — newest dialect features will fail there

[`pglite`](https://pglite.dev/) is a WASM build of PostgreSQL that
the suite uses for in-process real-DB coverage of postgres-dialect
cells. Today it ships PostgreSQL **17**. Several features the
`postgres` SqlBuilder emits at its newest `compatibilityVersion`
require **PostgreSQL 18+**:

- `RETURNING old.<col>` / `RETURNING new.<col>` (the `update
  returning old values` feature). The library emits `old.<col>` and
  PostgreSQL 17 rejects it with `missing FROM-clause entry for table
  "old"`.
- Future PG18+ syntax additions, as they are wired into the
  `postgres` SqlBuilder, will hit the same wall on pglite.

**What this means for tests** — the wrap is **per
`compatibilityVersion` cell**, not per pglite-cell. The `postgres`
SqlBuilder branches on `compatibilityVersion`:

- At `newest` (default, `Number.POSITIVE_INFINITY`) the SqlBuilder
  emits the newest syntax the dialect supports. For features that
  PostgreSQL only added in 18+, that is what reaches pglite — and
  pglite (PG17) rejects it. Wrap the test in
  `postgres/newest/pglite/` with `TODO[LIMITATION]: see LIMITATIONS.md`.
- At `oldest` (the `<` zone below the lowest documented breakpoint)
  the SqlBuilder emits the legacy emulation that PostgreSQL 17 and
  earlier accept. The test passes against pglite at `oldest`. Do
  **not** wrap it there.

Existing case today: `docs:update/update-returning-old-values`. The
SqlBuilder at `newest` emits `RETURNING old.<col>` (PG18+); at
`oldest` it emits a pre-PG18 emulation built on `for no key update of
_old_` that PG17 accepts. So the test is commented out **only** in
`test/db/postgres/newest/pglite/docs.update.test.ts`, not in the
`oldest/pglite` cell.

When pglite catches up with PostgreSQL 18+, walk
`grep -rn "TODO\[LIMITATION\]" test/db/postgres/*/pglite/` and
uncomment each match.

## Window functions are not supported through the fluent API

This is also documented in [`docs/about/limimitations.md` § Does ts-sql-query
support window functions?](../docs/about/limimitations.md#does-ts-sql-query-support-window-functions),
restated here because it affects test authoring:

- The library does not type `OVER (...)`, `PARTITION BY`, `ROW_NUMBER()`,
  `LAG()`, `LEAD()`, etc. as first-class operators.
- The only way to emit them is the `connection.fragmentWithType(...).sql\`…\``
  escape hatch (or `connection.rawFragment\`…\`` for the typeless
  variant) plus the `customWindow` extension point of `customizeQuery`
  for the `WINDOW` clause.

**What this means for tests** — there is no `docs:` test in the
suite today that exercises a window function (the docs pages don't
show any). If a future page introduces one, the test will look more
like a `docs.sql-fragments.test.ts` entry than a clean fluent-API
call. Keep it scoped to the SQL-fragments path and do not try to
build a wrapper that pretends window functions are part of the
typed surface.
