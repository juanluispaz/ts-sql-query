# Missing-tests audit (Round 10) — EXHAUSTIVE, fresh/independent type-coverage pass

**Mandate.** Discover tests the TYPES imply but the suite lacks — *total coverage in all casuistry*:
every union-input member, every overload, every return-type branch. Unit = type-branch; COVERED = a
`test/`-matrix test asserts the distinction via SQL+params and/or `assertType<Exact<…>>` and/or (where
the type promises a value) the value via `toEqual`/`toBe` (`void X` / `<any,any>` / signature-snapshot =
NOT covered). **Fresh and independent:** no prior round's gap list or conclusion (including "this is the
floor") taken on faith — every verdict re-derived against the actual current files.

**Method.** 11 discovery agents rebuilt explicit enumeration matrices over the whole public surface; 5
adversarial verifiers tried to *refute* every candidate (two of them with live tsgo/compile-repros).
Scope rules unchanged. Reference cell `postgres/newest/pg` (194 files), matrix symmetric.

**State of the field.** Very thin — **F1-BOOLIF and F2 (columns) verified 100% covered**; numeric, string,
temporal/uuid, and the Connection API near-full. **No source bug**, and the round-9 `ProxyTypeAdapter` fix
is verified covered (placeholder-forwarding + fall-through branches both tested). The genuine residual
concentrates in two places nine prior rounds missed — the **aggregate-array element-level projector arms**
(tsgo-proven type+value holes) and a **value-blind absent-key assertion** — plus several **write
`returning × execute-shape × flavour`** cells. All confirmed gaps use existing fixtures.

**Two cross-round contradictions resolved (both AGAINST this round's discovery agents — the prior rounds
were right):**
- **`fromRef` left-join overload (`FromRefBySourceLeftJoin`) IS covered.** F8 flagged it as the one miss
  (`grep "fromRef(" | grep -i leftjoin` → 0). A compile-repro settles it: `TableOrViewLeftJoinOf` resolves
  to `ForUseInLeftJoin`, which does **not** extend `ITableOrView`, so the ref can only bind overload #2 —
  exercised at `documentation/doc-code.generated.test.ts:3562/3580`, SQL pinned `:3671/3684`. The grep
  missed it because the left-join-ness lives in the generic constraint, not the variable name.
- **`NO_PRIMARY_KEY_FOUND` is OUT-OF-SCOPE.** F7 claimed it reachable via `update(PK-less table).from(...)
  .returning({x: t.oldValues()...})`. But `oldValues()` is typed `never` on a PK-less table on every public
  dialect (PG via `Table.ts:59`, SQLite overload commented out, Oracle has none, MariaDB/SqlServer gated
  `false`); the only typed escape is `NoopDB`, which isn't in `exports` (no matrix cell). Untypeable without
  contrivance.

---

## 📍 Tier 1 — genuine type+value / behavior gaps (existing fixtures)

- **§1 · Aggregate-array RULE 1 at the ELEMENT level** · `resultWithOptionalsAsUndefined.ts:64` /
  `resultWithOptionalsAsNull.ts:64` (both projectors). `asRequiredInOptionalObject()` is only ever applied to
  the *whole* aggregate (gating an outer object), never to a column **inside** the array element. A
  tsgo-probe confirms `aggregateAsArray({ ref: col.asRequiredInOptionalObject(), assigneeId })` yields
  `{ ref: string; assigneeId?: number }` — `ref` becomes *required inside the array element*, an arm no test
  reaches. Genuine type **and** value gap, both projectors. Fix in `select.aggregate-as-array.*`.
- **§2 · Aggregate-array RULE 4 (fallthrough) at the ELEMENT level** · same files. No `aggregateAsArray`
  where every element column is genuinely optional and **not** from a left join (the existing closest site,
  `propagation.test.ts:37`, is actually Rule 3 — the inner-object key drives `ContainsRequired=true`, verified
  by tsgo). The all-optional-leaf element arm (`{ body?; assigneeId? }` undef / `{ body:…|null; assigneeId:…|null }`
  null) is untested in both projectors.
- **§3 · The default projector's absent-key is proven only by a VALUE-BLIND assertion** · the Rule-4 miss
  (`inner-rules.test.ts:184`, row 3) is pinned by `toEqual([…,{iid:3},…])` + a type-only `opt?:` assert —
  but `bun:test`'s `toEqual({iid:3})` **passes against `{iid:3, opt:undefined}`** (verified empirically), and
  **no `'k' in row` / `Object.keys` membership check exists anywhere in the cell**. The library genuinely omits
  the key (`AbstractQueryBuilder.__transformRootObject:88`), so a present-`undefined` regression would slip
  through. One-line hardening: `expect('opt' in row).toBe(false)`.
- **§4 · UPDATE `returningOneColumn(...) × executeUpdateMany()` → `Array<scalar>`** · the one empty cell in a
  2×3 matrix that DELETE (`delete.returning.execute-shapes.test.ts:117`) and INSERT
  (`insert.execute-variants.test.ts:248`) both fill. Verified absent tree-wide; reuses the existing
  update-returning-many fixture.
- **§5 · `returningOneColumn(...) × customizeQuery({...})` — absent on all three mutations** · every
  returning×customize test uses `returning({obj})`; the single-column RETURNING + customizeQuery composition
  (scalar result-type survives the hook) is never asserted. Three cheap adds.
- **§6 · INSERT `returningLastInsertedId() × customizeQuery({...})`** · `insert.ts:43` exposes a customizeQuery
  arm on the last-inserted-id builder; never chained (returningLastInsertedId is INSERT-only).
- **§7 · INSERT on-conflict **do-update** × `returning({obj})`** · the do-*nothing* arm is covered
  (`customize-query.insert.test.ts:172-206` — `{…}|null` object, F4 missed it); only the do-update non-null
  `{obj}` upsert-returning is genuinely missing.
- **§8 · `conn.min()` / `conn.max()` over a bigint / customInt / customDouble column** ·
  `RemapValueSourceTypeWithOptionalType` (`values.ts:1018-1029`) branches on the leaf — `Bigint→bigint?`,
  `CustomInt/CustomDouble→branded number?` — but only the number/customComparable/localDate arms are asserted
  (`aggregation.test.ts:68/156/174`). Existing fixtures (`viewCount`/`durationMs`, `costCents`, `billedAmount`);
  real-DB-validatable (`0n` ≠ `0`). (Contrast: `equals<VS>(stringCol)` was *refuted* — that overload has no
  per-leaf branch, so it's degenerate.)

## 📍 Tier 2 — genuine but low / zero-cost

- **§9 · UPDATE `returningOneColumn × executeUpdateNoneOrOne`** — SQL+value are asserted on the live path
  (`update.execute-variants.test.ts:84/106`) but the `string|null` `assertType` lives only on the no-sets
  short-circuit (`:187`). Zero-fixture: add `assertType<Exact<…, string|null>>` to the live test.
- **§10 · `executeFunction(..., adapter?)` trailing TypeAdapter arg** · the read-side
  `adapter2.transformValueFromDB(...)` branch (`AbstractConnection.ts:671`) + the `typeof adapter==='string'`
  position-shuffle are unasserted (the `customDouble`/`Money` wrappers pass a typeName *string*, not an
  adapter object). One wrapper passing `bracketAdapter` closes it. (`executeProcedure` has no adapter param.)
- **§11 · The AsUndefined default twin of the Rule-2 same-left-join + optional-leaf shape** lacks a dedicated
  `Exact`+VALUE test (the AsNull twin is complete at `inner-rules.test.ts:395`; existing default Rule-2 tests
  use all-required `org?:{id,name}`).
- **§12 · Compound completeness:** `customizeQuery({queryExecutionName/queryExecutionMetadata})` is never
  passed on a compound query; `offset`/`offsetIfValue`/`limitIfValue` are never chained *after* a compound;
  `intersectAll`/`exceptAll`/`minus`/`minusAll` assert SQL+value but lack `assertType<Exact>` (their
  `union`/`intersect` siblings have it). Low / type-only parity.
- **§13 · Low write cells:** INSERT on-conflict do-update × `returningOneColumn × executeInsertNoneOrOne`;
  upsert-from-select with RETURNING (SQL-shape only). (The rest of the on-conflict returning×execute matrix is
  *contract-wrong* — the optional/LastId builders simply don't expose those execute methods.)

## 📍 Tier 3 — symmetry-only (optional, near-zero real-DB value)

- **§14 · Dynamic descriptor↔VSM symmetry:** an un-annotated inline `withValues({...})` over `localDate`
  (`workDate`), `localTime` (`startedAt`), and `customUuid` (`signingKey`) — the existing tests annotate
  `const f: DynamicCondition<{...}>` (the descriptor path), so the value-source-map arm is never the
  validating mapping. Each emits SQL byte-identical to its covered descriptor sibling → closes strict type-arm
  symmetry only. Same for the descriptor `'localDateTime'` arm (`createdAt`), reached only inline.

---

## ❌ Refuted / out-of-scope (verified — do NOT chase)

- **`fromRef` left-join overload** — COVERED (compile-repro; `doc-code.generated.test.ts:3562/3580`).
- **`NO_PRIMARY_KEY_FOUND`** — OUT-OF-SCOPE (`oldValues()` typed `never` on PK-less tables on every public
  dialect; only reachable via the non-exported `NoopDB`).
- **`createTableOrViewCustomization` P1-P5** — P2 IS covered (`forSystemTimeBetween` `<Date,Date>` in the
  generated doc-code, SQL `for system_time between $1 and $2`, every dialect); P1/P3/P4/P5 are pure `...params`
  arity fan-out of the proven plumbing → degenerate.
- **`equals/notEquals/is/isNot <VS>(stringColumn)`** — degenerate: `equals<VALUE>` is a single generic overload
  with no per-leaf return branch; the numeric twin (`column-vs-column.test.ts:75/205/329`) already proves
  VS-arm resolution + `MergeOptional` + the always-required boolean leaf. (String-RHS rejection is types.negative.)
- **uuid/customUuid `.is()/.isNot()`** — degenerate: SqlServer's `_is/_isNot` delegate to the un-overridden
  `AbstractSqlBuilder._equals` (plain `= $1`, **no** uuid `convert`), and the optional `case when … = 1` form is
  already pinned on the mssql cell via `assigneeId`. (The discovery's "non-degenerate on SQL Server" rationale
  doesn't survive reading the delegation.)
- **`.dynamicOn().or()`** — covered (`mariadb`/`mysql` `delete.join.test.ts:137/154` via-or chains; correctly
  NOT-APPLICABLE on postgres).
- **Rule-2 same-left-join mixed-optional-leaf under AsNull** — covered (`inner-rules.test.ts:395`).
- **`expandType*` `|undefined` / null-array / null-page overload arms** — degenerate (R-P7): no public execute
  path yields a `|undefined` page/array (`executeSelectNoneOrOne→|null`, pages are plain); the helpers' runtime
  is a no-op passthrough, so these arms are type-only artifacts a real query never produces.
- **Write-side alias `Exact` gaps** (`InsertableRow`/`UpdatableRow`/`*ShapedAs`) and **`TableOrViewOf<T, any>`**
  arm — LOW/degenerate hardening: already assignability+runtime+SQL-validated; the `any` arm is byte-identical
  to the covered default arm. Optional `Exact`-tightening, not a behavior hole.

---

## ⚡ Quick-win order

1. **§3** the value-blind absent-key hardening (`expect('opt' in row).toBe(false)`) — one line, closes a real
   test-correctness gap that lets a present-`undefined` regression pass.
2. **§1 §2** the aggregate-array element-level Rule-1 / Rule-4 arms (both projectors) — the genuinely new ground.
3. **§4 §5 §6 §7** the write `returning × execute-shape × customizeQuery` cells.
4. **§8** min/max over bigint/customInt/customDouble (one test, existing fixtures).
5. **§9 §10 §11** the zero-cost/low items.
6. **§12 §13 §14** compound parity, low write cells, dynamic symmetry — only if pursuing literal totality.

## How close to TOTAL coverage?

The type-distinction matrix is **~98%** and *two more* whole surfaces verified at 100% this round. The pass
found **no source bug** and **no new systematic class** — and it *retired* two would-be regressions by
compile-repro (proving prior rounds right and this round's own critics wrong on `fromRef` and
`NO_PRIMARY_KEY_FOUND`). Yet it still surfaced genuinely new ground nine prior rounds missed: the
**aggregate-array element-level projector arms** (a real type+value hole, tsgo-proven) and the **value-blind
absent-key assertion** (a test-correctness gap, not just a coverage one). That pattern — an independent pass at
the floor still finding a few real items, mostly by going one level deeper into composition (here: a modifier
*inside* an aggregate element, and the difference between `toEqual`-omitted and `'in'`-absent) — is the
standing argument for keeping each pass fresh. Closing Tier 1 (~8 focused, existing-fixture additions) is the
high-value work; Tier 2/3 is hardening. The three highest-leverage closeouts: §3 (absent-key value),
§1+§2 (aggregate element projector), §4+§5 (write returning×execute/customize).
