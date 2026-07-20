# Missing-tests audit — ROUND 24

**Method**: type-driven, multi-agent. 15 discovery agents (runbook §6 decomposition + a
new **F9-TYPEVAR** type-level-relationships agent), waves of ≤10, led by the parity sweep
and two deep seam critics. Every agent carried **both** learned oracles (`*When` soundness;
drop≠defect boundary). The coordinator adjudicated every load-bearing claim itself.

**Pre-flight**: N=24. Matrix `bun run tests:audit` → **17 cells, 233 files, 2157 tests/cell**
(36 669 total), symmetric, audit clean (grew to 2190/238 mid-round — the user was landing
round-23 tests concurrently). Reference cell `postgres/newest/pg/`. `test/BUGS.md` empty.
Index refreshed. Domain unchanged (759 lines).

**Focal change**: commit `df9d0838` "More work type-safety on order by in recursive queries"
resolved round-23's SEAM-B C1 candidate — via **type-safety**, not a silent behavior change:
`orderBy(valueSource)`/`orderBy(rawFragment)` on a recursive result now route through new
`OrderByRecursiveAwareValueSource`/`OrderByRecursiveAwareRawFragment` aliases that, when
`'recursive' ∈ FEATURES`, accept only **no-table** expressions (a table-bound `orderBy(tIssue.id)`
on a recursive result is now a compile error, locked in every `types.negative/select.test.ts`).
A just-changed type surface is the round's highest-value target.

---

## Headline counts

| Bucket | Count |
|---|---|
| **Confirmed `src/` bugs** | **0** |
| Seam candidate defects | 0 survived (SEAM-A traced+cleared 2 suspects; SEAM-B empirically verified all candidates emit valid SQL) |
| **§A** missing tests (existing cells + existing fixtures) | ~14 clusters |
| **§B** missing tests (needs a fixture) | 1 |
| **Genuinely saturated** surfaces (0/0) | 10 |

**A saturating round with zero bugs — an honest, healthy result at this maturity.** Ten
surfaces are 0/0. The two seam critics did their job (surfaced untested compositions) and the
coordinator's oracles did theirs (no manufactured emission claims; the two closed recursive-CTE
boundaries were *not* re-filed). The headline is a clean §A: the `df9d0838` positive-arm gap,
found by **three agents independently**.

---

## No confirmed bugs — how both seam candidates were cleared

- **SEAM-A** suspected two drops and **traced both to sound code** (applying round-23's
  "probe/trace, don't assert emission" lesson): (1) an old-value column wrapped in a computed
  RETURNING expression on the update-FROM-subquery path — the binary-op `__registerRequiredColumn`
  recurses into **both** operands (`ValueSourceImpl.ts:1018-1021`), so the `_old_` subquery
  pre-projects it → sound (→ a §A coverage gap, not a defect); (2) `disallow*` guards on the
  on-conflict do-update-set — every impl branches on `__onConflictUpdateSets` consistently and is
  already covered (`insert.on-conflict.dynamic-set.test.ts:519`). No emission assertion manufactured.
- **SEAM-B** empirically verified every candidate composition with scratchpad repros against a
  mock `PostgreSqlConnection` (observed emitted SQL + values) and type-checked the fresh
  positive path under tsgo — **all emit valid SQL / correct values; no drop, misplace, or throw**.
  The two closed recursive-CTE boundaries (projection-only customizeQuery hooks; table-bound
  recursive orderBy — now the `df9d0838` compile error) were correctly **not** re-filed.

---

## §A — missing tests (existing cells + existing fixtures), by theme

### Tier 1 — the freshly-changed `df9d0838` positive arms (found by PARITY + F3-SELECT + SEAM-B independently)

- **`orderBy(<no-table valueSource>)` on a recursive result** — e.g.
  `recursiveUnionAll(fn).orderBy(conn.const(1,'int'))` → `… from recursive_select_1 order by $2`.
  Type-checks (tsgo, zero errors), routes to the outer select via `__orderingAndPagingTarget()`,
  emits valid SQL — but **untested in all 17 recursive cells** (the only value-source orderBy on a
  recursive result was the table-bound one, now the compile-error case). The identical compound
  twin (`compound-order-by-value-source-secondary`) is real-DB-validated everywhere. Ready-made
  template in `select.compound.test.ts:503`. Home: `cte.recursive-union-variants.test.ts`.
- **`orderBy(<no-table rawFragment>)` on a recursive result** — e.g.
  `recursiveUnionAll(fn).orderBy(conn.rawFragment\`title\`, 'desc')` → `… order by title desc`
  (resolves to the output column — the real-DB-value-assertable case). Same story; untested.

### Tier 1/2 — SELECT/CTE compositions (SEAM-B A3-A7, all empirically verified valid)

- recursive **multi-column** `forUseAsInlineAggregatedArrayValue()` (only the one-column scalar
  form is tested; multi-column emits `json_agg(json_build_object(...))`).
- recursive select consumed via `forUseInQueryAs('tree')` inside an outer query **as executable
  code** (only referenced in a comment today; `customizeQuery`-hook survival on the path is tested,
  but not a plain outer-query consumption asserting the result).
- an adapter/value-transforming column projected as a **field inside an `aggregateAsArray({…})`
  object element** — verified the per-element read transform fires (`score`÷10 per element); no
  such object-element adapter test exists (only the scalar-array case). Fixture `tProjectReview`.
- compound × `customizeQuery` × `forUseAsInlineAggregatedArrayValue` (the hook survives inside the
  derived table; untested).
- `rawFragment` embedding a **recursive or compound** select (the `__addWiths` forwarder bubbles
  the `with recursive` CTE to the outer statement — verified; untested).

### Tier 1 — deep projection nesting + rule precedence (F3-PROJ)

- **rule-1-outer × rule-3-inner** missing the `projectingOptionalValuesAsNullable()` twin (A1).
- **L4 / L5 optional-container arms** (A2/A3) — the projector recursion reaches depth-5, but every
  deepest container in the current tests carries a required leaf, so the `| undefined` / `| null`
  container suffix at levels 4 and 5 is never asserted. Both projectors.
- **outer×inner rule-precedence matrix** (A4) — 7 reachable combos untested (1×1, 1×2, 1×4, 2×1,
  2×3, 2×4, 3×2), each a distinct classification path (theme 5). ~19 test cells.
- (round-23's aggregate-element rule-1 demotion + rule-2 discard twins, and depth-4 rule-3, all
  **landed** this round.)

### Tier 2 — distinct interfaces / branches

- **multi-row MISSING_KEYS folding family** (F4-INSERT A1) — `MissingKeysMultipleInsertExpression`
  + its shaped twin are reachable via `dynamicValues([partial rows])` but untested; the multi-row
  analogue of the (now-covered) single-row `MissingKeys` folds (`setForAll`/`keepOnly`/`ignoreIfSet`/
  `disallowIfNoValue`).
- **`conn.true()`/`conn.false()` neutral-constant reduction in `_and`/`_or`** (F1-BOOLIF A1) — 4
  SqlBuilder sub-branches with zero tests; distinct from both the JS-literal-operand path and the
  elided-IfValue path, sharpest on Oracle/SQL Server (`(1=1)`/`(0=1)`).
- **DELETE nested-object + computed-expression returning** (F4-UPDDEL A1/A2) — UPDATE has both;
  DELETE tests only the one-column computed form and no nested-object form.
- shaped on-conflict `setWhen(false)` arm (F4-INSERT A2, 19/20 covered); IfValue.and right-elide
  symmetry fill (F1-BOOLIF A2).

### Tier 3 — borderline / value-only

- **INSERT returning-EXPRESSION** (computed value-source, not a bare column) — SEAM-A flags it §A
  (insert tests only bare columns while update/delete test expressions); F4-INSERT argues degenerate
  (the returning-expression emission machinery — `DataToProject` + `_buildQueryReturning` — is shared
  with update/delete, which have a representative). **Coordinator verdict**: a distinct reachable
  insert node but output-coincident through shared, provably-generic machinery → low-priority §A
  (worth one test for the node; not high-value).
- **UPDATE returning a value-source expression *over an old column*** (F4-UPDDEL A3) — impl verified
  correct (recurses to find `_old_`); overlaps the already-covered fragment-over-old-column case.
- **scalar `T | null` NULL inhabitant** (F9-TYPEVAR A1) — the one-column optional scalar type is
  Exact-locked, but every optional-scalar test returns non-null, so the `| null` value in a
  value-present `executeSelectOne`/`Many` position is never realized (only the no-row
  `executeSelectNoneOrOne` null is). A value-side completion, existing fixtures.
- **optional custom-kind + trailing-adapter (`adapter2`)** — the required arm is covered on all
  three source-shapes (Table/View/Values, incl. `releaseOrdinal`); the *optional* twin is unpinned
  (Values §A / View §B).

---

## §B — needs a fixture

- **View `optionalColumn` custom-kind + trailing-adapter** — the optional twin of `releaseOrdinal`;
  needs a nullable DDL column on `release_overview` + mapping across the 7 dialect domains. (The
  Values counterpart is §A — inline `Values` class, no domain change.) Borderline-degenerate.

---

## Per-surface verdicts

| Agent | Result |
|---|---|
| PARITY | 2 §A (df9d0838 positive arms); twin surface clean; both oracles held |
| SEAM-A (mutation) | 0 defects (2 suspects traced+cleared) + 4 §A multi-feature stacks |
| SEAM-B (select/CTE) | 0 defects (all candidates empirically verified valid) + 7 §A (df9d0838 + 5 compositions) |
| F3-SELECT | df9d0838 positive arms (converges); round-23 recursive findings all landed |
| F4-INSERT | 2 §A (multi-row MISSING_KEYS, shaped on-conflict setWhen-false); both round-23 items closed |
| F4-UPDDEL | 3 §A (DELETE nested/computed returning, update old-value expr); round-23 Error-overload landed |
| F3-PROJ | 4 §A (rule-1×3 nullable, L4/L5 optional containers, precedence matrix); round-23 twins landed |
| F1-BOOLIF | 2 §A (conn.true/false reduction, and-right-elide); round-23 elision gaps all landed |
| F2-VALVIEW | 1 §A + 1 §B (optional custom+adapter2); round-23 Values adapter2 landed |
| F9-TYPEVAR (new) | near-saturated (1479 Exact vs 27 legit Extends); 1 value-only §A |
| **F1-EQCMP** | **SATURATED 0/0** |
| **F5-CONN** | **SATURATED 0/0** (transaction/isolation surface complete) |
| **F2-COL** | **SATURATED 0/0** |
| **F6-DYN** | **SATURATED 0/0** |
| **F7-EXTRAS** | **SATURATED 0/0** |
| **F1-NUM / CUSTOMNUM / STR / TEMP** | **SATURATED 0/0** (re-verified) |

Round-23 findings that landed and closed this round (verified by fresh re-derivation): the
recursive-result execute-shapes + limitIfValue/offsetIfValue + orderByFromString*, the disallow
`Error`-instance overload (`disallowIfValue` family), the Values customInt `adapter2`, the unshaped
on-conflict `setWhen`, the positive `disallowIfNoValue` fold, the two aggregate-element rule twins,
depth-4 rule-3, the boolean elision-asymmetry trio, and the EQCMP direct-fluent tail.

---

## Coordinator verification notes

1. **No candidate defect survived.** SEAM-A traced its two suspects to sound code (both-operand
   recursion; consistent `__onConflictUpdateSets` branching) and did **not** manufacture an emission
   assertion. SEAM-B empirically verified all its candidates emit valid SQL. Neither re-filed the two
   closed recursive-CTE boundaries. So there was nothing for me to runtime-probe this round — the
   right outcome when the seam agents apply the oracles correctly.
2. **df9d0838 is sound** (PARITY): the no-table restriction on the recursive/compound
   `select … from <cte>` matches SQL scoping; the negative rationale in `types.negative` is correct.
   The gap is purely the untested positive arms.
3. **`*When` soundness** held across INSERT/UPDDEL/PARITY — no re-file of `disallowIfNoValueWhen`.
4. **INSERT returning-expression** degeneracy dispute (SEAM-A vs F4-INSERT) adjudicated → low-tier §A.
5. Tree confirmed clean (no stray agent files; SEAM-B's repros stayed in the scratchpad).

---

## Recommended implementation order

1. **Tier-1 df9d0838 positive arms** (PARITY/SELECT/SEAM-B A1/A2) — highest value, ready-made
   compound templates, no fixtures.
2. **Tier-1 SELECT/CTE compositions** (SEAM-B A3-A7, esp. the adapter-in-aggregateAsArray-element
   value test) and **deep-projection** (PROJ A1-A4).
3. **Tier-2**: multi-row MISSING_KEYS folding (INSERT A1); conn.true/false `_and`/`_or` reduction
   (BOOLIF A1); DELETE nested/computed returning (UPDDEL A1/A2).
4. **Tier-3 / §B**: the borderline value-only + optional-`adapter2` items last.

---

## Verdict

**A saturating round with zero confirmed bugs — and that is the correct result at this maturity.**
Ten surfaces are genuinely 0/0 (including the new type-variance/result-type angle, which found the
type-level surface essentially Exact-locked throughout). Both seam critics surfaced real untested
compositions and — crucially — cleared their own candidates by tracing/probing rather than asserting,
so no false bug reached the coordinator. The §A/§B tail is concentrated exactly where it should be:
the freshly-changed `df9d0838` positive arms (3-agent convergence), the deep-projection recursion
and rule-precedence matrix, the recursive/compound composition seams, the multi-row MISSING_KEYS
family, and the boolean neutral-constant reduction. `src/` was not touched; `BUGS.md` stays empty.
