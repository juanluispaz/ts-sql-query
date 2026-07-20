# Semantic audit — round 5

Per [`SEMANTIC_AUDIT_RUNBOOK.md`](./SEMANTIC_AUDIT_RUNBOOK.md). Transient — not kept in the repo.

**Why round 5**: after round 4 concluded the silent-wrong-value family was exhausted, several more missing-tests
audits landed a large batch of "Sql generation tests" plus two new `src/` features. This round **validates
everything that entered since round 4** and, at the maintainer's explicit request, hunts **false
`NOT-APPLICABLE` markers** — *"cuidado con falsas acusaciones de que algo no aplica a una base de datos"* — in
**both directions** (never accept a false "doesn't apply", never false-accuse a genuine one; probe the real
engine before ruling).

**What entered since round 4** (`git log 3b10a89c..HEAD`): (1) **SQL Server uuid-as-string** — the
`_appendSqlMaybeUuid` family (`convert(nvarchar(36), <uniqueidentifier>)`) extended to more string ops + the
collate / insensitive-comparison / insensitive-orderBy paths; (2) **Oracle temporal through RETURNING** — a
column's value type recorded as non-enumerable params metadata so `OracleDBQueryRunner` declares the oracledb
`DbType` (a temporal RETURNING column comes back a `Date`, not a string); (3) a large batch of SQL-generation
snapshot tests; (4) many new `NOT-APPLICABLE` markers.

**Method**: three read-only discovery agents (re-validate the two new src features; the false-NA marker audit;
the new-snapshot + LIMITATION sweep) + the coordinator's own real-engine probes.

**Engines**: PostgreSQL 18.4 · Oracle 26ai · MySQL 9.7.1 · MariaDB 12.3.2 · SQL Server 2025 · SQLite. Container
names/ports rotate — resolved at probe time.

**Result**: **the new src re-validates CLEAN** (uuid + temporal, confirmed by reading + 83 real-engine tests +
targeted probes), **the new snapshots are CLEAN** (no baked-wrong emission), and **the LIMITATION markers are
all genuine**. Two findings: **(1) a class of ~90 mis-categorised `NOT-APPLICABLE` markers that are actually
`TODO[LIMITATION]`** — the maintainer's headline concern, confirmed with real-engine + within-dialect evidence;
**(2) A-1, a low-severity latent inconsistency** where a uuid receiver's *affix*-insensitive predicates drop the
configured collation. No new silent-wrong-value in the reachable value-expression surface. No `src/` touched.

---

## New src validation — CLEAN

**SQL Server uuid-as-string.** Every angle re-derived sound: `convert(nvarchar(36), …)` yields exactly 36 chars
(so `.length()` = 36); the four **direct** insensitive comparisons convert the uuid *value* operand and apply
`collate` (and `=` is inherently case-insensitive on a `uniqueidentifier` regardless — **probed**:
`@uuid = convert(nvarchar(36),'<lowercase>') collate Latin1_General_BIN2` → `EQUAL`, the RHS binary collate made
inert by `uniqueidentifier` data-type precedence); `_isUuidOrderByColumn` is gated by `_isStringOrderByColumn`
so a non-uuid is never wrongly converted and a missed uuid fails **loud**, never silent. The SQL Server uuid
uppercase (`sqlserver.md:176`) is documented, per-cell tested (`.toUpperCase()` on `realDbEnabled`), and
real-DB-validated — a documented dialect boundary, not a silent divergence. **Doc nuance (maintainer's call):**
the `transformValueFromDB` lowercase workaround keys on `type === 'uuid'`, so it reaches only projection
marshalling, not a **server-computed derived** uuid string (`.reverse()`, `.substring()`, `.replaceAll()` of a
uuid), which stays uppercase on SQL Server — worth a doc line, not a value bug.

**Oracle temporal through RETURNING.** The `:<index>`-keyed non-enumerable metadata is off-by-one-free
(`addOutParam` returns `':' + params.length` and pushes at that index; `resolveOutBindTypes` reads `:i` for the
BIND_OUT at `params[i]`), collision-free, does not leak into the params snapshot, and types only the six
temporal kinds (non-temporal binds left as the driver default). Value fidelity is locked as **RETURNING ==
SELECT** for all six temporal kinds (`insert.returning.test.ts:651/702`), so a `localDate`/`localTime`/
`localDateTime` (+ custom variants) returned via RETURNING is the same instant a plain SELECT yields.

**Real-engine confirmation**: `oracle/newest/oracledb/insert.returning*` + `sqlserver/newest/mssql/{uuid-cast,
collation}` under `--docker` → **83 tests pass**. Both features hold up under adversarial re-reading.

---

## Finding 1 — a class of `NOT-APPLICABLE` markers that are actually `TODO[LIMITATION]` (the false-NA concern)

**The discriminator** (from `LIMITATIONS.md`'s own taxonomy): a `NOT-APPLICABLE` is genuine only when the API is
**typed `never`** on the marked connection (compile-time narrowed, with a paired `types.negative/` assertion). If
the API is **callable** there (typechecks, no `@ts-expect-error`) and only a **runtime function / runner
capability / environment** is missing, that is the `TODO[LIMITATION]` fingerprint — *the library emits SQL / calls
a function the engine rejects, closeable if the environment changes* — **not** a permanent dialect frontier. The
sharpest proof is **within-dialect divergence**: a marker that is LIVE on one runner of a dialect and NA on
another runner of the **same** dialect cannot be a dialect frontier.

**The confirmed mis-categorised families** (each: callable API + a runtime/runner/env limitation → should be
`TODO[LIMITATION]`, and the reason reworded away from "doesn't apply"):

| # | Marker family (count) | Why it is a LIMITATION, not a frontier | Evidence |
|---|---|---|---|
| 1 | `reverse()` on SQLite (~30) | public `StringValueSource.reverse()`, callable, **no `types.negative`**; the SQLite build lacks the function | probed `select reverse('abc')` → *no such function: reverse*. Runs live on the other 5 dialects. Closeable via a registered UDF (better-sqlite3 / node_sqlite / sqlite-wasm expose one). |
| 2 | `cot()` on SQLite (~30) | public `NumberValueSource.cot()`, callable; its `cot` neg-types reject the **wrong column type**, not a SQLite boundary | probed `select cot(1.0)` → *no such function: cot*. Its trig siblings run live on SQLite; **Oracle already emulates `cot` as `1/tan(...)`** — SQLite could too (closeable). |
| 3 | `allowNestedTransactions` (13) | **within-dialect divergence** — LIVE on `postgres/pg` + `postgres/pglite`, NA on `postgres/postgres` + `postgres/bun_sql_postgres` (same dialect) | `nestedTransactionsSupported()` is a **runner** capability (base `false`; only `PgPool`/`PgLite`/`Noop` override). The reason text itself says "connector's query runner." Closeable via `SAVEPOINT` on the other runners. |
| 4 | SQLite RETURNING a FROM-joined column (~15) | the body typechecks on `SqliteConnection` (full `assertType`, **no `@ts-expect-error`**); runs live on PG | probed `UPDATE project … FROM organization … RETURNING organization.name` → **rejected**: *no such column: organization.name*. Library emits it → engine rejects = LIMITATION. |
| 5 | `ci_replace` UDF on `bun_sqlite` / `sqlite3` (2, **new** this batch) | within-dialect divergence — LIVE on better-sqlite3 / node_sqlite / sqlite-wasm, NA only on the two runners with no UDF-registration API | per-runner capability, not a dialect frontier. *(Maintainer's call vs the prior `uuid_str`/`uuid_blob` platform-dependent-NA precedent; the difference is this UDF is the library's own and 3 sibling runners register it.)* |
| 6 | `replaceAllInsensitive` not honouring `insensitiveCollation` on PG / SQLite (~15) | both `replaceAllInsensitive` and the `insensitiveCollation` config are callable/typed there — it is a behavioural gap (PG's fixed `regexp_replace(…, 'gi')` can't take a collation), not a typed narrowing | reword away from `NOT-APPLICABLE`: a documented LIMITATION (PG's `'gi'` is case-only). |

**Impact**: these tests are *correctly skipped* on those runners/builds — this is a **taxonomy** correction, not
lost coverage or a silent value. But `NOT-APPLICABLE` falsely asserts a permanent "doesn't apply to this
database", and it hides that several are **closeable** (reverse/cot/ci_replace via a UDF; nested transactions via
`SAVEPOINT`; cot via `1/tan`). Reclassify to `TODO[LIMITATION]` with matching `LIMITATIONS.md` entries.

**Genuine `NOT-APPLICABLE` families — checked and CLEARED (the caution, applied the other way — do NOT touch)**:
`connection.default()` on SQLite (`@ts-expect-error` typed-absent), `replaceCollation` on PG/MySQL/MariaDB/SQLite
(a `protected` config declared **only** on `OracleConnection`/`SqlServerConnection` — probed), the "Unix-epoch
date format" (a `SqliteDateTimeFormat`-typed option that **only** exists on `SqliteConnection` — confirmed),
`aggregateAsArrayDistinct` / `stringConcatDistinct` / `intersectAll`·`exceptAll`·`minusAll` /
`startWith`·`connectBy` / INSERT…ON CONFLICT→MERGE / MySQL-no-RETURNING / sequences / snapshot isolation — all
typed `never` with paired `types.negative` assertions. **These are real frontiers; leaving them as
`NOT-APPLICABLE` is correct.**

*(Separate taxonomy note, not a false-NA: ~30+ "a real sqlite engine never returns X, so this defensive guard is
only mock-reachable" markers use `NOT-APPLICABLE` for a mock-only-reachability reason — the opposite of a
false-NA, but not a typed frontier either; arguably its own category. Low priority.)*

## Finding 2 — A-1: SQL Server uuid *receiver* affix-insensitive predicates drop the configured collation

**The promise**: `uuid.asString().containsInsensitive(x)` (and `startsWith`/`endsWith` + their `not` forms)
matches **case-insensitively**, and honours a configured `insensitiveCollation`, like every other string
receiver.

**The request** — `SqlServerSqlBuilder.ts` `_startsWithInsensitive:914` / `_notStartsWithInsensitive:927` /
`_endsWithInsensitive:940` / `_notEndsWithInsensitive:953` / `_containsInsensitive:966` /
`_notContainsInsensitive:979` each have an `if (this._isUuid(valueSource))` **early return** (branches
915–917 / 928–929 / 941–943 / 954–955 / 967–969 / 980–982) that emits a **bare** `<uuid> like ('%' + <term> +
'%')` — **no `collate`, no `lower()`, and *before* the `insensitiveCollation` check**. The non-uuid arm of the
same method appends `collate <insensitiveCollation>` (e.g. `:920`), and the four **direct** insensitive
comparisons convert+collate the uuid — so the affix path is the one gap.

**The engine transcript** (a `uniqueidentifier` renders **uppercase**):

```
@uuid like '%c733%'                                           -> MATCH        (default CI database — correct)
convert(nvarchar(36),@uuid) collate Latin1_General_CS_AS
                            like '%c733%'                      -> NO MATCH     (CS database — SILENTLY case-sensitive)
```

So on a **case-sensitive** SQL Server database — **or** whenever the user sets `insensitiveCollation` precisely to
force folding — a uuid receiver's `containsInsensitive('<lowercase-hex>')` silently matches **fewer rows**
(the uppercase-rendered uuid doesn't match the lowercase pattern), and the `insensitiveCollation` config that
exists to fix it is **ignored** (the `_isUuid` branch short-circuits before reading it). It is **not** a loud
failure — `uniqueidentifier LIKE nvarchar` implicitly converts.

**Blast radius**: SQL Server only, and only under a CS database collation or a set `insensitiveCollation`.
**Why the suite can't see it**: the affix-uuid tests run on the container's **default CI** collation (where the
bare `like` is correct), and the collation test only covers the uuid-as-**value** case (string receiver, where
the collate **is** applied) — no test exercises a uuid **receiver** affix predicate under
`withInsensitiveCollation(...)`. **Verdict: DEFECT (silent wrong value), low severity, pre-existing** (the
`_isUuid` affix branch predates this batch; the new direct-comparison code sharpened the inconsistency by now
handling the collation the affix path still drops). Fix: in the uuid affix branch, when `insensitiveCollation`
is set, emit `convert(nvarchar(36), <receiver>) like (…) collate <insensitiveCollation>` — mirroring the four
direct comparisons.

---

## Refutations / clean results

- **New SQL-generation snapshots — CLEAN.** A drift-lens + fingerprint sweep of the whole batch
  (`git diff 3b10a89c..HEAD -- test/db`): date-part getters, `greatest`/`least` NULL wrapping, custom-numeric
  (`cbrt` = the full-precision `sign(x)*power(abs(x),1.0/3.0)` form, `ln`/`log10`, `asInt`/`asBigint` =
  round-then-cast), enum `is`/`isNot`, `avg`-casts-operand, HAVING, recursive-union, the uuid string ops, and the
  Oracle temporal RETURNING all line up across dialects with only known-necessary differences. **No baked-wrong
  emission**; no `Number()`/`BigInt()` laundering, no `toBeCloseTo(x, ≤5)`, no string-`expected` for a numeric
  leaf.
- **`TODO[LIMITATION]` markers — all genuine.** Every distinct family maps to a real lib-emits-server-rejects /
  environment boundary in `LIMITATIONS.md` (SQLite no-UDF-DDL, the `attachRollbackError` harness gap, the PG
  fractional-literal bind, SQLite `%` float truncation, the SQL Server bare-param ORDER BY, SNAPSHOT isolation,
  …). The **MariaDB `UPDATE…RETURNING` needs 13.0.1+** gate (the one family this batch expanded, ~67 markers) was
  re-probed: `mariadb:latest` still resolves to **12.3.2**, so the gate is **still genuine** — no coverage to
  reactivate. Nothing stale or mis-filed.

## Verdict

**The target level holds, and everything that entered since round 4 validates.** The two new src features are
sound and real-engine-confirmed; the new snapshots bake no wrong emission; the LIMITATION markers are genuine.
The maintainer's false-NA concern surfaced a real, coherent class — **~90 `NOT-APPLICABLE` markers that are
callable-API + runtime/runner/env limitations and should be `TODO[LIMITATION]`** (with the genuine typed
frontiers correctly left alone). The only value-level item is **A-1**, a low-severity, pre-existing, niche
uuid-affix-insensitive inconsistency. Two actionable outcomes, both the maintainer's call: **reclassify the
false-NA families** (Finding 1) and, optionally, **close A-1** (Finding 2).
