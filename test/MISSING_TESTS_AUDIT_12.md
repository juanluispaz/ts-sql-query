# Missing-tests audit (Round 12) — convergence verification: is the without-new-cells ceiling reached?

**Question.** Round 11 predicted that, once its §A1–§A9 shipped, *total type-coverage achievable without
adding matrix cells or fixtures* would be reached. This round verifies that — fresh, independent, 12
enumeration-matrix discovery agents re-deriving from the types against the current files, each sectioning
findings into **(A) closeable with existing cells+fixtures**, **(B) out-of-target (needs a new cell/fixture)**,
**(C) degenerate/refuted**, with a convergence verdict.

**Answer: YES — convergence is confirmed.** Of the 12 surfaces, **all twelve report fully covered / converged**
once one cross-agent discrepancy is resolved (below). The remaining residual is a **final tiny batch of 3
existing-fixture LOW one-liners — and no behavior source bug**. Round-11's §A1–§A9 are all **verified landed**.

> **Correction (post-aggregation, coordinator-verified by direct read).** The projector deep-dive (F9) reported a
> MEDIUM gap — "aggregate element-level rule-2 same-left-join twin missing for both projectors." The SELECT agent
> (F3) contradicted it. Direct read settles it in F3's favour: the twin **is covered for BOTH projectors** —
> default at `select.aggregate-as-array.modifiers.test.ts:309` (`{ id: number; body?: string }`, both leaves from
> `tIssue.forUseInLeftJoin()`, `'body' in element === false`) and AsNull at `:171`
> (`{ id: number; body: string | null }`, runtime `body: null`). F9 misclassified those two tests as rule-3. So the
> one MEDIUM item is a **false positive (covered)**; only the 3 LOW one-liners below remain.

**Operational note.** This session blocked subagent scratchpad writes, so agents delivered findings inline and
a few flailed/over-delegated; the borderline write-surface items were therefore verified directly by the
coordinator with targeted grep + src reads (cited below). Several sub-agent "ABSENT" claims were narrow-scope
false-positives and were refuted on direct inspection.

Scope rules unchanged (negatives + `queryRunners/` + contrived-`as any` + new-cell/new-fixture items
out-of-target; reference cell `postgres/newest/pg`, matrix symmetric; date/time `TZ=UTC`).

---

## 📍 Section A — the final batch (genuine, existing cells+fixtures — all LOW one-liners)

- **§A1 · INSERT `dynamicSet()` ZERO-arg → `MissingKeysInsertExpression` · LOW** · `src/expressions/insert.ts:610`.
  Verified directly: zero `dynamicSet()` (no-arg) call exists in any `insert.*.test.ts`. The one-arg form
  `dynamicSet(columns)` is covered (round-11 §A1, `insert.conditional-sets.test.ts:709`) and the UPDATE zero-arg form
  is covered (`update.allowing-no-where`/`execute-variants`), so the INSERT zero-arg→MissingKeys path is an
  unexercised asymmetry — start from `insertInto(t).dynamicSet()` then fill required columns via `.set(...)`,
  asserting the now-executable SQL. Existing fixtures.

- **§A2 · `UpdatableValues<T>` `assertType<Exact>` (currently `Extends`-only) · LOW** ·
  `docs.advanced.utility-types.test.ts:113/:378` pin it with `Extends`, while its siblings `UpdatableValuesShapedAs`
  (full Exact :251) and `InsertableValues` (full Exact :366) are Exact-anchored. One-line strengthening mirroring the
  `InsertableValues` Exact (all-writable-optional). — *F7; every leaf is already Exact-pinned on the Insert side.*

- **§A3 · SELECT `dynamicOn().or()` · LOW** · `src/expressions/select.ts` (the SELECT `DynamicOnExpression`).
  SELECT exercises `leftJoin(...).dynamicOn().and(...)` only (`select.join.test.ts:131`); the `.or()` arm of the
  SELECT join's dynamic-ON predicate is untested (it's covered on the DELETE/UPDATE builders, which are distinct
  interfaces). Trivially closeable on the existing `select.join` fixture. — *F3; SELECT-specific, not "missing
  everywhere".*

## ❓ Borderline (verify reachability before acting; likely out-of-target)

- **`ShapedInsertOnConflictSetsExpression`** (`insert.ts:825-842+`) — a real, large typed interface, untested. But
  `ShapedInsertExpression` (what `shapedAs()` returns, `insert.ts:622-636`) exposes **no `onConflict*` method**, and
  bare `onConflictDoUpdateSet` is already contract-impossible on PG. Its reachability on an existing PG cell is
  unconfirmed; if it's only reachable on other dialects / via a chain that doesn't exist, it's out-of-target. Resolve
  the reachability before treating it as a gap. (Coordinator-verified `shapedAs` has no on-conflict entry; not
  pursued further this round.)

## ❌ Refuted / out-of-target (verified — do NOT chase)

- **Aggregate element-level rule-2 same-left-join twin (both projectors)** — COVERED (F9's MEDIUM was a
  misclassification): default at `modifiers.test.ts:309`, AsNull at `:171` (both leaves from `tIssue.forUseInLeftJoin()`,
  required `id` + optional `body`). F3 flagged the contradiction; coordinator confirmed by direct read.
- **SELECT `ExecutableSelect.query()` / `.params()`** — degenerate (the emitted SQL/params of every SELECT are already
  asserted via `ctx.lastSql`/`ctx.lastParams`; the bare methods are exercised on Insert/Update). Not gaps.
- **Aggregate element-level rule-3 under the AsNull projector** — borderline-degenerate (the optional-leaf-`| null`
  behavior is already proven by the rule-1/rule-2 AsNull aggregate twins; default rule-3 covered at
  `value-type-coverage.test.ts:267`). Not pursued.

Sub-agents in this degraded session produced several narrow-scope "ABSENT" claims; all were refuted on direct
inspection:
- **INSERT `returning(...) × customizeQuery()`** — COVERED (`customize-query.insert.test.ts:140/172/208/237/265` —
  object, on-conflict do-nothing, one-column, lastInsertedId, on-conflict do-update). The sub-agent stopped reading at
  ~line 104.
- **INSERT on-conflict × `customizeQuery`** — COVERED (`customize-query.insert.test.ts:186/277/307/345`).
- **DELETE `returning × customizeQuery`** — COVERED (`customize-query.delete.test.ts:90/117`).
- **`returningOneColumn` "missing on INSERT"** — COVERED 7× (`insert.execute-variants`, `insert.on-conflict`,
  `insert.custom-columns:189`).
- **`leftOuterJoin` "missing"** — COVERED (`select.outer-join-variants.test.ts`, distinct `left outer join` vs `left
  join` snapshots + Exact).
- **`fromRef` left-join overload, `dynamicOn().or()`, `NO_PRIMARY_KEY_FOUND`, the `Cents`/`Money` branded-read, uuid
  `is/isNot`, the boolean from-model arm, `OpaqueValues`/`Pickable` barrel exports** — all re-refuted (covered, or
  degenerate, or out-of-target) consistent with rounds 10–11.
- **Round-11 §A1–§A9 — all verified landed:** §A1 `dynamicSet(columns)` one-arg (`insert.conditional-sets.test.ts:709`);
  §A4 `deleteAllowingNoWhere`+`using` (`delete.using.variants.test.ts:153`); the numeric `nullIfValue`/`valueWhenNull`
  + `conn.min/max` bigint/custom leaves (`custom-numeric`/`aggregation`); §A7 `aggregateFragmentWithType`+adapter
  (`fragments.type-coverage.test.ts:270`); the §A8 wrapper-alias `Exact` strengthenings + §A9 `reasonOf` tightenings
  (`utility-types.test.ts` 28 Exact pins + 14 reasonOf files).
- **Out-of-target (need a new cell/fixture, by the project's own no-new-cells decision):** MySQL-5 `UNSUPPORTED_QUERY`,
  `NO_PRIMARY_KEY_FOUND`/`MAPPED_SHAPED_COLUMN_NOT_IN_TABLE`/`UNKNOWN_DATA_TYPE`/`INVALID_SQL_FRAGMENT_RETURN_TYPE`
  (contrived/impossible-state), depth-≥5 nested projection, per-driver marshalling, runtime 0-row-aggregate `undefined`
  value, the createTableOrViewCustomization P1/P3/P4/P5 + higher-arity `subSelectUsing`/`dynamicBooleanExpressionUsing`
  fan-out (shared-dispatcher tail). All correctly excluded.

---

## ⚡ Quick-win order (the last batch — all existing cells+fixtures, all LOW one-liners)

1. **§A1** INSERT `dynamicSet()` zero-arg (one small test).
2. **§A2** `UpdatableValues<T>` Extends→Exact (one line).
3. **§A3** SELECT `dynamicOn().or()` (one test on the existing `select.join` fixture).
4. (Optional) resolve **`ShapedInsertOnConflict`** reachability; only act if reachable on an existing PG cell.

## Convergence verdict

**The without-new-cells ceiling is reached (modulo three LOW one-liners).** All twelve surfaces verified converged;
round-11's batch is confirmed landed; the meta-critic re-derived ~30 cross-cutting classes and found **no genuine
existing-cell gap**. The only MEDIUM candidate this round (F9's aggregate rule-2 same-left-join twin) was a
**misclassification — covered for both projectors** (caught by F3's contradiction + a coordinator direct read; exactly
the cross-verification the two-wave method exists for). What remains is **three LOW one-liners** (§A1 INSERT
`dynamicSet()` zero-arg; §A2 `UpdatableValues` Extends→Exact; §A3 SELECT `dynamicOn().or()`), all closeable on the
existing matrix with existing fixtures, plus one borderline item (`ShapedInsertOnConflict`) whose PG reachability is
unconfirmed. **No behavior source bug surfaced** (round 7's bugs stay fixed). After §A1–§A3 ship, a round 13 run the
same way should return "fully covered — evidence" across all twelve matrices — the residual beyond that is, by
definition, only reachable by adding cells/fixtures the project has deliberately chosen not to add. **This is the
floor.**
