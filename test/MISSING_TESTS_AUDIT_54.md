# MISSING_TESTS_AUDIT_54 — type-driven missing-tests audit (Round 54)

**Family:** TYPE_AUDIT (missing-tests). Runbook: [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md).
**Matrix:** 17 cells / 249 files / **4072 tests per cell** (symmetric — `tests:audit` green).
**Method:** **maximal depth on the NON-EXCLUDED surfaces only** (user directive: "saca tanto como sea
posible, aunque sea inconexo" — but do NOT re-open the pruned EXCLUDE surfaces; exhaust the in-scope ones
first). 6 agents, one wave. Coordinator owned every `--docker`/probe serially (no index rebuild during
fan-out). Reference cell `test/db/postgres/newest/pg/` (uuid → `sqlserver/newest/mssql`; temporal-RETURNING
→ `oracle/newest/oracledb`).

## Headline

- **1 confirmed `src` defect → [`BUGS.md`](./BUGS.md): a SECOND incomplete-fix in the C1 family.** The
  R53 C1 fix (`8b14165a`) converted the uuid receiver/match operand before `collate` in
  `replaceAll`/`replaceAllInsensitive`, **but `collate` on a bare `uniqueidentifier` still rejects at
  three other forced-collate sites** the fix didn't cover. **All three `--docker`-confirmed** on real
  SQL Server (*"Expression type uniqueidentifier is invalid for COLLATE clause"*):
  - **C1a — `uuid.asString().collate('X')`** (base `_collate`, no SqlServer override). **Default-reachable, always fails.**
  - **C1b — insensitive `orderBy` on a projected `uuid.asString()` alias** (base `_appendOrderByColumnAliasInsensitive`). Latent (set `insensitiveCollation`).
  - **C3 — `equalsInsensitive`/`likeInsensitive` with a uuid VALUE operand** (base `_equalsInsensitive`/`_likeInsensitive`). Latent (set `insensitiveCollation`).
- **1 candidate REFUTED by probe (C2):** `replaceAll(find, uuidReplaceWith)` leaves the replacement
  operand bare in `replace(…, …, external_ref)`; real SQL Server **accepts** it (`replace()` implicitly
  converts a bare uniqueidentifier arg). The fix leaving `value2` bare is correct.
- **The R53 backlog (+21 → 4072) landed CLEAN and effectively COMPLETE.** Baked-in scan: 0 type-vs-value
  contradictions; all 7 items (INS-1, STR-UUID-1..6, COLL-53-A, SEL-53-A, AGG-53-A, RET-ORA×10,
  PARITY-53-A) correct with correct NA mirrors; only 2 redundant RET-ORA shapes remain (behavior already
  covered by the custom/object variants).
- **Every permanent seam came back 0 src defects** (PARITY, SEL-SEAM, MUT-SEAM, F9-TYPEVAR); their value
  this round was confirming saturation + corroborating the uuid finding lived at the re-armed src, exactly
  the mature-phase seam-agent role.
- **The R53 F9-53-A §B deferral is RETIRED (refuted):** the alleged rule-2→rule-4 flip is impossible (an
  optional leaf contributes `never`, not `false`, to the rule-2 union) and the behavior is already covered
  at `inner-rules:491` — no fixture needed.
- **§A tail** (all real-validatable): the uuid×collate tests (blocked on the fix), `returningLastInsertedId`
  INVALID_VALUE twins, one inline-value with-hook boundary, one T4 projection-emission completeness, two
  positive returning-nullability locks, plus a large **negative-type-lock** backlog (enumerated per the
  maximal directive; `types.negative`, OUT of the strict real-validatable §A scope).

Verdict up front: **total coverage NOT yet reached** — the re-armed SqlServer-uuid src surfaced a real
defect (as the runbook predicts each maximalist pass does). After this fix + the small §A tail, the
uuid surface saturates. See Part VIII.

---

## Part I — the uuid×forced-collate defect, the C1 fix, and the +21 backlog

The only `src` change since R53 (HEAD `3e268558`) is `8b14165a` ("More work on UUID as string in SQL
Server") — the C1 fix. It touched ONLY `SqlServerSqlBuilder.ts` (+22/-2): added
`_appendSqlMaybeUuidParenthesis` (receiver) + `_appendValueMaybeUuidParenthesis` (match operand) and
routed BOTH `_replaceAll` and `_replaceAllInsensitive` collate branches through them. (`8eb80d07` +
`4227d528` = the R53 backlog +21, test-only.)

### I.1 — The fix is correct for `replaceAll`, but the uuid×forced-collate CLASS is still open (BUG)

RECENT-SRC enumerated every SqlServer path that applies a forced `collate` to a possibly-uuid
expression; the coordinator `--docker`-probed each. `collate` on a bare `uniqueidentifier` is rejected
by SQL Server, so any site that reaches it without a `convert(nvarchar(36), …)` is a defect:

| Site | Emission | Real SQL Server | Reach |
|---|---|---|---|
| `_collate` (no SS override) — `uuid.asString().collate('X')` | `external_ref collate Latin1_General_BIN2` | **REJECT** | **default (C1a)** |
| `_appendOrderByColumnAliasInsensitive` — insensitive orderBy on a uuid alias | `order by external_ref collate Latin1_General_CI_AI` | **REJECT** | set `insensitiveCollation` (C1b) |
| `_equalsInsensitive`/`_likeInsensitive` (+not) — uuid VALUE operand | `@0 = external_ref collate Latin1_General_CI_AI` | **REJECT** | set `insensitiveCollation` (C3) |
| `_replaceAll(find, uuidReplaceWith)` — `value2` bare 3rd arg | `replace(convert(…) collate X, convert(…) collate X, external_ref)` | **OK** (implicit convert) | default (C2 — refuted) |

Root cause: these base methods emit the collated expression via `_appendSql` /
`_appendValueParenthesis` / `_appendOrderByColumnExpression` with no uuid convert; the C1 fix added the
convert only to `_replaceAll`/`_replaceAllInsensitive`. **Filed to `BUGS.md`.** Under the DEFAULT (unset)
`insensitiveCollation`, C1b/C3 instead emit `lower(external_ref)`, which SQL Server ACCEPTS (R53 proved
this — a string *function* implicitly converts a uniqueidentifier arg), so they are latent; C1a always
fails. Fix scope: extend the existing helpers to a SqlServer `_collate` override + the two insensitive
collate paths.

### I.2 — The +21 R53 backlog: clean + effectively complete (BAKED-VERIFY)

0 baked-in type-vs-value contradictions. Per-item: **INS-1a/b** (mock-only INVALID/MANDATORY gates,
byte-mirror of the UPDATE/DELETE twins, mysql-NA correct); **STR-UUID-1..6** (landed in
`select.value-source.uuid-cast.test.ts`, each converts the uuid, reverse-NA-on-sqlite correct);
**COLL-53-A** (landed in `select.compound.test.ts` as a secondary compound ORDER BY collate term);
**SEL-53-A** (`recursiveUnionAll` adapter round-trip, value-asserted 850→85); **AGG-53-A**
(`count(id) as "stats.total", max(assignee_id) as "stats.hi"`, `'hi' in stats === false` boundary);
**RET-ORA×10** (INSERT/UPDATE/DELETE × object/scalar, oracle OUT-bind `dir:3003` pinned, mysql/mariadb
NA correct); **PARITY-53-A** (`@ts-expect-error` on the bare `extendShape().executeInsert()`). Residual:
only 2 redundant RET-ORA shapes (plain-localDateTime object on INSERT/UPDATE; non-localTime scalar) whose
OUT-bind path is already proven by the custom/object variants.

### I.3 — Re-confirmed NON-bugs / retirements (NOT re-filed)

- **F9-53-A (R53 §B) — RETIRED as refuted.** The rule-2→rule-4 flip is impossible (`IsOriginallyRequired<'optional'> = never`, not `false`, so an optional sibling can't disqualify rule-2); already covered at `select.complex-projection.inner-rules.test.ts:491`. No fixture needed.
- **MUT-SEAM cosmetic** — the multi-row `returningLastInsertedId` non-`TsSqlError` INVALID_VALUE wrap builds `value: undefined` (should be the raw row); reachable only when a TypeAdapter throws a raw JS `Error` (the normal `TsSqlError` path carries the correct `value`). Cosmetic → leave as-is, not filed.
- **SEL-SEAM C-1**, **CAND-A** (`update.ts:532`), **CAND-F** (`values.ts:253`), **`disallowIfNoValueWhen`** divergence, **`extendShape` drops `& NEXT`** (by-design) — all held.

---

## Part II — the enumerated §A backlog (by surface; each real-validatable, coordinator-probed)

### II.1 — SqlServer uuid × forced-collate (cell `sqlserver/newest/mssql`) — BLOCKED on the BUGS.md fix

Each is the bug reproduction; write wrapped `// TODO[BUG]` until the fix lands, then unwrap:
- **CS-1 · T2** — `tIssue.externalRef.asString().collate('Latin1_General_BIN2')` (C1a). Post-fix emits `… (convert(nvarchar(36), external_ref)) collate Latin1_General_BIN2 …`. Default conn.
- **CS-2 · T2** — insensitive `orderBy` on a projected `uuid.asString()` alias under a set `insensitiveCollation` (C1b).
- **CS-3 · T2** — `equalsInsensitive`/`notEqualsInsensitive`/`likeInsensitive`/`notLikeInsensitive` with a uuid VALUE operand under a set `insensitiveCollation` (C3) — one canonical + the not-twins.
- **CS-4 · T3 (GREEN, coverage-only)** — `uuid.asString().replaceAll(find, uuidReplaceWith)` (C2): a value-source uuid `replaceWith`. Probed OK (`replace(…, …, external_ref)` succeeds); pins that the fix correctly leaves `value2` bare.

### II.2 — `returningLastInsertedId` INVALID_VALUE twins (mutation seam)

Twins of the already-landed MANDATORY inhabitants (mock-only by construction, each a defined reason):
- **MUT-A.1 · T2** — single-row `.returningLastInsertedId().executeInsert()` + `mockNext(1.5)` → `INVALID_VALUE_RECEIVED_FROM_DATABASE`. **All dialects** (single-row last-id is universal). Home `errors.insert-guards.test.ts`.
- **MUT-A.2 · T2** — multi-row `.values([…]).returningLastInsertedId()` + `mockNext([1, 1.5])` → INVALID_VALUE decorated `rowIndex===1`. **mysql/mariadb NA** (multi-row last-id narrows to `never`).
- **MUT-A.3 · T3** — multi-row **adapter** branch (`tLedgerEntry`, `plusOffsetAdapter`) + `mockNext([1, <post-adapter-invalid>])` → INVALID_VALUE `rowIndex===1`. Same NA. (Injected value: coordinator to pick a non-integer whose post-offset form fails int validation.)

### II.3 — SELECT seam

- **SEL-54-1 · T3 (boundary)** — a PLAIN (non-recursive) select's `beforeWithQuery`/`afterWithQuery` are a silent no-op when consumed as an inline value (`forUseAsInlineQueryValue` / `forUseAsInlineAggregatedArrayValue`) — the inline path renders `beforeQuery`/`afterQuery` but never the two with-hooks (a plain inline select has no WITH clause). Reading A (boundary, likely correct) → a passing boundary pin asserting `beforeQuery`/`afterQuery` bracket the `(select …)` while the with-hooks leave no trace. Mock-verifiable.

### II.4 — projection result-type/value (F9)

- **F9-54-A · T4 (emission-completeness, output-coincident, LOW)** — a rule-2 nested object whose optional leaf is an **operator combining the same left-join's required + optional columns** (`grp: { idPlus: tIssueLeft.id.add(1), combo: tIssueLeft.id.add(tIssueLeft.assigneeId) }`), sibling to an originallyRequired operator leaf. Distinct emitted SQL (`issue.id + issue.assignee_id as "grp.combo"`), no snapshot pins it; type `grp?: { idPlus: number; combo?: number }` (compile-repro should confirm before baking, settling the R53 hypothesis for the record); realize `'grp' in miss === false` on the join miss + the as-nullable twin. Uses `tIssueLeft = tIssue.forUseInLeftJoin()` — existing fixtures.

### II.5 — returning nullability / optional-shape positive locks (PARITY, real-validatable)

- **RET-NULL-1 · T3** — `onConflictDoNothing().returningLastInsertedId()` → `T | null` (realize the `null` when do-nothing fires) vs `onConflictOn(c).doUpdateSet({…}).returningLastInsertedId()` → `T` (non-null). Assert both nullability arms in one place (pg/sqlite/mariadb).
- **RET-OPT-SHAPE-1 · T3** — the from-SELECT optional returning path `.from(sel).onConflictDoNothing().returning({…}).executeInsertNoneOrOne()` object-shape (the optional `executeInsert{NoneOrOne,Many}` object-copy mapping) — only the non-optional `*.returning.execute-shapes` cells exist today (pg/sqlite).

---

## Part III — OUT / refuted / negative-type-lock backlog

**Refuted (evidence recorded):** C2 (uuid `replaceWith` — `replace()` implicitly converts, `--docker` OK);
F9-53-A rule-flip (impossible + already covered); MUT-SEAM cosmetic `value:undefined` wrap (raw-JS-throw-only, leave-as-is).

**Negative-type-lock backlog (PARITY A–F) — `types.negative/`, OUT of the strict real-validatable §A
scope (runbook §5) but enumerated per the maximal directive so they are not re-chased.** These pin
DB-list `= never` exclusions currently only NOT-APPLICABLE-commented or unpinned:
- **A1** mysql insert-`returning`/`returningOneColumn` = never (only delete-returning-never is pinned on mysql);
  **A2** mysql `onConflictDoNothing().returningLastInsertedId()` = never (only a NA block today);
  **A3** mysql `.values([…]).returningLastInsertedId()` = never while single `.values({…})` is allowed (lock the split);
  **A4** oracle insert-FROM-SELECT `.returning*` = never (paired with the allowed plain-insert `.returning` control).
- **B1** oracle & sqlserver all `onConflict*` entries = never (no neg-lock in those `types.negative`);
  **B2** sqlite `onConflictOnConstraint` = never (pg-only); **B3** mysql/mariadb `dynamicWhere` after `onConflictDoUpdateSet` = never (only `.where` pinned).
- **C1** pg/sqlite/oracle/sqlserver `update/deleteFrom(t).join*()` = never (join is noop/mariaDB/mySql only);
  **C2** sqlite `update(t).from(t2)` allowed vs `deleteFrom(t).using(t2)` = never (co-locate the asymmetry).
- **D1** pg/sqlite from-SELECT optional `.executeInsertOne()` = never (`ExecutableInsertReturningOptional` drops it).
- **E1** compound `.orderBy(tTable.col)` = never; **E2** recursive `.orderBy(tTable.col)` = never; **E3** oracle/sqlserver `.recursiveUnion(On)` = never (need UNION ALL); **E4** sqlite/sqlserver `.intersectAll/exceptAll/minusAll` = never; **E5** non-oracle `.startWith/connectBy*` = never; **E6** `.orderingSiblingsOnly()` = never without `connectBy`.
- **F1** bare `update(t).set({…})` / `deleteFrom(t)` expose no `execute*` until `.where` vs the `*AllowingNoWhere` control.
- Out-of-scope pointer (separate file, future round): variadic `subSelect(Distinct)Using` arities 1-5 + fragment-builder optional-type-per-arity overloads live in `AbstractConnection*`/`fragment.ts`, not the builder type-surface files.

**Type-only / degenerate OUT (verified):** brand keep/erase remainder (byte-identical SQL+value → negative-type);
direct-leaf `MergeOptional` optional-collapse cells (output-coincident); left-joined bare-scalar (output-coincident);
NoneOrOne/Many one-column value-gates (same transform code as the covered One-path → CLOSE, R-P7).

---

## Part IV — per-surface saturation table

| Surface (this round's roster) | Result |
|---|---|
| RECENT-SRC (C1 fix, re-armed uuid) | **uuid×collate BUG (3 sites)** + CS-1..4 §A |
| BAKED-VERIFY (+21 R53 backlog) | 0 contradictions; clean + complete (2 redundant RET-ORA residuals) |
| PARITY (permanent) | 0 type-vs-impl bugs; RET-NULL-1/RET-OPT-SHAPE-1 §A + negative-type-lock backlog A–F |
| SEL-SEAM (permanent) | 0 defects; 1 §A boundary (SEL-54-1); very high saturation |
| MUT-SEAM (permanent) | 0 defects; MUT-A.1/2/3 §A; 1 cosmetic (not filed) |
| F9-TYPEVAR (permanent) | 0 defects; F9-53-A retired; 1 §A T4 (F9-54-A) |

---

## Part IV-b — EXCLUDE / KEEP / permanent roster (updated for R55)

Per the user directive this round, the EXCLUDE surfaces were NOT re-opened (exhaust the non-excluded
first). `8b14165a` touched only `SqlServerSqlBuilder` (uuid), re-arming F1-STR uuid — which surfaced the
bug above, so it **STAYS armed** (its src changes again with the fix).

**EXCLUDE (unchanged; re-arm only on their `src` path changing):** F5-CONN, F1-BOOLIF, F1-EQCMP,
F2-COLVAL, F6-DYN, F3-SELECT, F1-CUSTOMNUM base, **F-COLL/F-CONFIG, F-AGG, F-PROJ-NEW, F1-TEMP (plain),
TEMP+STR non-uuid** (all re-verified saturated in R53; no src change since).

**KEEP for R55 (re-verify implemented):** **F1-STR uuid arm** — the uuid×collate fix will change
`SqlServerSqlBuilder` again; verify CS-1/CS-2/CS-3 flip from `// TODO[BUG]` to green and the fix covers
`_collate` + both insensitive-collate paths. **F1-TEMP Oracle-RETURNING arm** — verify the 2 redundant
RET-ORA residuals (optional; likely close as covered).

**PERMANENT (never excluded):** PARITY, SEL-SEAM, MUT-SEAM, F9-TYPEVAR, recently-changed-src.

---

## Part V — coordinator verification (the probes, with exact results)

All probes `--docker sqlserver/newest/mssql`, deleted after; tree clean.
1. **C1a (confirm)** — `select external_ref collate Latin1_General_BIN2 …` → `Expression type uniqueidentifier is invalid for COLLATE clause`. BUG.
2. **C1b (confirm)** — `… order by external_ref collate Latin1_General_CI_AI` (InsCollConnection) → same rejection. BUG.
3. **C3 (confirm)** — `… @0 = external_ref collate Latin1_General_CI_AI …` (InsCollConnection) → same rejection. BUG.
4. **C2 (refute)** — `replace(convert(nvarchar(36), external_ref) collate X, convert(nvarchar(36), external_ref) collate X, external_ref)` → **ok**, returns the uuid. `value2` bare is correct.
5. **Root cause** — grep-confirmed `SqlServerSqlBuilder` has **no `_collate` override** (base-only).
6. Baked-in scan / saturation / reachability — grep + direct reads (no index rebuild during fan-out).

---

## Part VI — §B fixture additions

**None.** F9-53-A (the only prior §B) is retired — no fixture needed. Every §A closes on existing cells +
existing `domain/connection.ts`.

---

## Part VII — recommended implementation order

1. **Fix the uuid×collate defect** in `SqlServerSqlBuilder.ts` (add a `_collate` override + route the
   insensitive-comparison collate operands and the insensitive order-by-alias through the existing
   `_appendSqlMaybeUuidParenthesis`/`_appendValueMaybeUuidParenthesis`), then unwrap CS-1/CS-2/CS-3.
   *(Fixing agent's job; not this audit.)*
2. **T2** — CS-1..3 (post-fix); MUT-A.1/2 (returningLastInsertedId INVALID_VALUE); CS-4 (C2-positive, green).
3. **T3** — MUT-A.3; SEL-54-1 (boundary); RET-NULL-1 / RET-OPT-SHAPE-1; the 2 redundant RET-ORA residuals (optional).
4. **T4** — F9-54-A (compile-repro the type first).
5. **Negative-type-lock backlog (A–F)** — `types.negative/` completeness; batch per dialect. Maintainer's call whether to bake (OUT of the strict §A scope).

---

## Part VIII — verdict (honest)

**Total coverage NOT reached this round — because the re-armed SqlServer-uuid src surfaced a real,
`--docker`-confirmed defect** (three sites of `collate` on a bare `uniqueidentifier`), exactly the
runbook's expectation that "each maximalist pass surfaces more real `src/` bugs as its findings are
implemented." The C1 fix closed `replaceAll` but the uuid×forced-collate CLASS was only half-closed;
probe > trace earned its keep again — it **confirmed** C1a/C1b/C3 and **refuted** C2 (the `replace()`
implicit-convert that a trace would have miscalled) rather than guessing.

Everything else is saturated: the +21 R53 backlog landed clean and complete; the four permanent seams
found 0 defects of their own; F9-53-A retired. The §A tail is completeness (the uuid×collate tests
gated on the fix, three `returningLastInsertedId` INVALID_VALUE twins, one inline-value boundary, one
output-coincident projection test, two returning-nullability locks) plus a negative-type-lock backlog
that is OUT of the strict real-validatable scope. **After the uuid×collate fix lands and CS-1..3 turn
green, the F1-STR uuid arm saturates and folds into EXCLUDE** — at which point R55's fan-out reduces to
the permanent agents + whatever `src` changes next (the runbook's target-reached condition). We are one
fix away.
