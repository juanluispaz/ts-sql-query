# Missing-tests audit — ROUND 23

**Method**: type-driven, multi-agent. 15 discovery agents (runbook §6 decomposition),
waves of ≤10, **led by the parity sweep and two deep seam critics** (mutation / select-CTE).
Every agent carried **both** learned oracles so neither prior mistake could recur:
- **`*When` soundness** (round 21): a `*When` whose key-tracking type differs from its
  unconditional sibling is not a bug unless the sibling is monotonic — oracle is soundness
  under `when === false`.
- **drop≠defect** (round 22): a probed hook/fragment drop is a bug only if the customized
  clause still exists in the composed output; if the composition removes/replaces that clause,
  it's a NOT-APPLICABLE boundary.

The coordinator verified every load-bearing claim itself (runtime probes for both seam
candidates; source reads for delegation questions).

**Degeneracy bar**: narrow (§4). **Pre-flight**: N=23. Matrix `bun run tests:audit` → **17
cells, 233 files, 2124 tests/cell** (36 108 total), symmetric, audit clean (up from 232/2024 —
round-22 implementations landed). Reference cell `postgres/newest/pg/`. `test/BUGS.md` empty at
start. Index refreshed. Domain re-read: round-22 §B fixtures all present now
(`releaseTagSeqOffset`, `tLedgerEntry.discount`, and 7 new `vReleaseOverview` per-kind columns).
Notably commit `c3f64158` (recursive `orderBy`/`limit`/`offset` now order the FINAL result)
landed from round-22's SELECT-A1 finding — a real behavior fix.

---

## Headline counts

| Bucket | Count |
|---|---|
| **Confirmed `src/` bugs** | **0** |
| Seam candidates coordinator-adjudicated | 2 (1 REFUTED by probe; 1 real drop → bug-vs-boundary, maintainer call) |
| **§A** missing tests (existing cells + existing fixtures) | ~15 clusters |
| **§B** missing tests (needs a fixture / fixture-free extension) | 2 |
| **Genuinely saturated** surfaces (0/0) | 9 |

**The round is a saturating one.** Nine single-surface agents came back 0/0. The value again
concentrated at the seams — and the round's focal area is the **freshly-changed recursive-result
ordering/paging surface** (commit `c3f64158`), where both the biggest §A cluster and the one
live candidate live.

---

## Seam candidates — both coordinator-verified

### SEAM-A #1 — REFUTED by my own runtime probe (a plausible structural root-cause that didn't reproduce)

The mutation seam critic reported a **nested-object RETURNING sub-projection silently drops
FROM-table registration** in `update(t).from(aux)` + oldValues, predicting invalid SQL
("missing FROM-clause entry for table organization"), with a detailed root-cause
(`_extractAdditionalRequired{Tables,Columns}ForUpdate` iterate top-level `__columns` with
non-recursive register fns).

**I probed it on `postgres/oldest/pg` (compat 17M, where `_useUpdateOldValueInFrom()===true`).
It does NOT reproduce — both arms emit correct SQL:**
- flat `orgName: tOrganization.name` → `… from (select _old_.*, organization.name as organization__name …) … returning …, _old_.organization__name as "orgName"`
- nested `org: { name: tOrganization.name }` → `… from (select _old_.*, organization.name as organization__name …) … returning …, _old_.organization__name as "org.name"`

The nested case **correctly registers `organization`, projects `organization__name`, and
references `_old_.organization__name`** — not the out-of-scope `organization.name` the agent
predicted. The recursive table-registration path (`__registerTableOrViewOfColumns`) *does* fire
during query building; the agent's structural reasoning was plausible but wrong. **Not a bug.**
(Exactly the §7.4 lesson: probe it, don't reason about it — a plausible emission claim is often
wrong until the mock prints the string.) Reduced to a §A missing-test (nested-object returning
+ oldValues + from is untested, and *works*).

### SEAM-B C1 — real drop, but **bug-vs-boundary (maintainer's semantic call)** — NOT filed as a bug

`recursiveUnion*(...).orderBy/limit/offset.forUseInQueryAs(...)` **silently drops** the
ordering/paging. Root cause: c3f64158 routes `orderBy/limit/offset` onto `__recursiveSelect`
(the outer `select … from <cte>`), but `forUseInQueryAs` discards `__recursiveSelect` and
re-homes only the 4 allow-listed customization hooks — not `__orderBy/__limit/__offset`.

**Coordinator runtime probe (mock, `ctx.lastSql`), 4 arms:**
- **recursive + `.orderBy/.limit/.offset` + `forUseInQueryAs`** → `with recursive t as (…) select id from t` — **all dropped**.
- same, **direct `executeSelectMany`** → `… select … from recursive_select_1 order by id limit $2 offset $3` (c3f64158: order the FINAL result).
- **recursive + `customizeQuery(beforeOrderByItems)` + `forUseInQueryAs`** → `order by id asc` renders *inside* the CTE body (a distinct feature explicitly targeting that slot).
- **plain (non-recursive) + `.orderBy/.limit` + `forUseInQueryAs`** → renders inside the CTE body.

**Adjudication (drop≠defect oracle, both readings):**
- *Boundary reading (leans this way):* c3f64158 defines fluent `.orderBy()` on a recursive
  select as "order the **final result**" (the outer select). Consumed as a CTE, that outer
  projection is **replaced by the consuming query** — the clause's target is removed → a
  NOT-APPLICABLE boundary, same shape as the (closed) recursive-CTE projection-only-hooks
  boundary. Correct artifact would be a *documented boundary test*, not a bug fix.
- *Defect wrinkle:* the drop is **silent** (typed + callable + ignored), and `.limit()`/
  `.offset()` do have a meaningful CTE-body render site (top-N), so the maintainer may prefer
  to render or type-forbid rather than silently drop.

Per the oracle, a drop whose target clause is replaced by the composition is **not asserted as
a bug**. Presented here as a CANDIDATE for the maintainer's semantic decision (render inside the
CTE body / type-forbid `forUseInQueryAs` after ordering a recursive result / document as a
boundary + boundary test). `BUGS.md` left empty. This is the 4th recursive-CTE-consumption
"hook drop" in the ledger's lineage — the stable pattern: **consuming a recursive select as a
CTE replaces its outer projection, so anything targeting that projection has no render site.**

---

## §A — missing tests (existing cells + existing fixtures), by theme

### Tier 1 — the freshly-changed recursive-result surface (c3f64158) — found by PARITY *and* F3-SELECT independently

- **The recursive result's own re-homed ordering/paging arms** (`OrderByExecutableSelectExpression`
  returned by `recursiveUnion*`). Only `.orderBy('id')` (bare string) + `.limit/.offset` are
  tested on a recursive result; the rest route through `__orderingAndPagingTarget()` and are
  untested: `orderBy('col', mode)`, `orderBy(ValueSource)`, `orderBy(IRawFragment)`,
  `orderByFromString`/`…IfValue`/`…Array`/`…ArrayIfValue` (validate-on-anchor / order-on-outer
  split), `limitIfValue`/`offsetIfValue`, and a **bare `executeSelectPage()` without ordering**
  (count-wraps-CTE path). All real-DB-validatable on the existing `tIssue` hierarchy. *(Whichever
  way SEAM-B C1 resolves, the direct-execute forms of these are unambiguously §A.)*
- **Compound-into-CTE / inline** positive coverage: `.union(...).orderBy(...).forUseInQueryAs(...)`
  and the two `forUseAsInline*` compound variants — runtime-verified CORRECT, just untested (SEAM-B A2).

### Tier 1 — projection classification/precedence in the aggregate projector (theme 5)

- **PROJ A1** — aggregate-ELEMENT rule-1 with an *originallyRequired left-join sibling* (the
  reqInOptObj-stays vs originallyRequired-demotes divergence) — the plain-select twin is covered;
  the aggregate projector is a separate code path.
- **PROJ A2** — aggregate-ELEMENT rule-2 DISCARD → rule-4 (same-left-join object, all leaves
  genuinely optional, no originallyRequired). Plain twin covered; aggregate twin not.

### Tier 2 — distinct overloads / branches (existing fixtures)

- **INSERT A1** — plain `setWhen` on the **unshaped** on-conflict update-set node
  (`InsertOnConflictSetsExpression.setWhen`, insert.ts:793) — 19/20 of that node's `*When`
  octet is covered; only plain `setWhen` is missing (the file that claims completeness).
- **INSERT A2** — a **positive** runtime test for `disallowIfNoValue`'s sound MISSING_KEYS fold
  (currently only a compile-only control in `types.negative`).
- **UPDDEL A1** — the `disallow*` / `disallow*When` **Error-instance overload** — never
  exercised in any cell (only the `string` overload); behaviorally distinct (the `Error` is
  thrown as-is with `disallowedProperty` mutated on, vs wrapped in `DISALLOWED_BY_QUERY_RULE`).
- **BOOLIF A1/A2/A3** — elision-asymmetry: `IfValue.and(IfValue)` left-elides direction (only
  right-elides tested), `IfValue.or(IfValue)` mixed-elide (untested entirely for `or`),
  `AlwaysIf.valueWhenNoValue` keeps-seed branch (only substitute-on-empty tested) — distinct
  `_and`/`_or` `!sql`/`!sql2` SqlBuilder branches.
- **VALVIEW A1** — the **Values** `column`/`optionalColumn` custom-kind + trailing-TypeAdapter
  (`adapter2`) branch (`Values.ts:96-98`/`:130-132`) — the symmetric twin of the now-covered
  View `releaseOrdinal`; reachable via the exported `plusOffsetAdapter`/`ReleaseTag`.
- **PARITY A2/A3** — the lone un-reached `WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable.projectingOptionalValuesAsNullable()` (groupBy-before-select shape); on-conflict optional-returning `executeInsertMany`.
- **SEAM-A §A** — computed-expression in a mutation RETURNING; nested-object RETURNING (non-oldValues, plain); on-conflict × from-select × object-form `returning({…})`; on-conflict × from-select × `projectingOptionalValuesAsNullable`.

### Tier 3 — marginal

- UPDDEL A2/A3 (`returningOneColumn`/`returning` with a computed expression — shared with SELECT);
  the recursive `orderBy(mode)` arm (mode dispatch covered elsewhere).

---

## §B — needs a fixture / fixture-free extension

- **PROJ B1** — depth-4 / depth-5 nested-object projection (the recursion has 5 explicit levels;
  max tested is depth-3), including the level-5 `never`-truncation boundary. Both projectors. No
  new fixtures (existing `tIssue` columns).
- **PROJ B2** — an INNER object (level 2/3) firing its OWN rule-1/rule-2 under an outer object of
  a different rule (each level re-runs the 4-way rule switch). Both projectors. Existing tables.

*(No domain-connection changes needed this round — all round-22 §B fixture additions already
landed.)*

---

## Per-surface verdicts

| Agent | Result |
|---|---|
| SEAM-B (select/CTE) | 1 candidate (C1, bug-vs-boundary → not filed) + 2 §A |
| SEAM-A (mutation) | 1 candidate **REFUTED by probe** + 4 §A |
| PARITY | 3 §A (recursive ordering family, GroupBy-ProjectableAsNullable, on-conflict optional Many); twin surface clean; both oracles held |
| F3-SELECT | recursive-result overload arms (A1-A6) — converges with PARITY |
| F3-PROJ | 2 §A (aggregate-element classification twins) + 2 §B (deep nesting) |
| F4-INSERT | 2 §A (unshaped on-conflict `setWhen`, positive disallowIfNoValue fold); both round-22 items closed |
| F4-UPDDEL | 1 §A (disallow Error-overload) + 2 marginal; both round-22 items closed |
| F1-BOOLIF | 3 §A (elision-asymmetry branches) |
| F2-VALVIEW | 1 §A (Values custom-kind adapter2); View per-kind reads saturated |
| **F1-EQCMP** | **SATURATED 0/0** (round-22 ~70-cell tail implemented) |
| **F5-CONN** | **SATURATED 0/0** (transaction/isolation/deferring surface complete) |
| **F2-COL** | **SATURATED 0/0** (Table + View factories) |
| **F6-DYN** | **SATURATED 0/0** (the one new arm `notEqualsInsensitive` shipped with tests) |
| **F1-NUM / CUSTOMNUM / STR / TEMP** | **SATURATED 0/0** (re-verified against 2124-test suite) |
| **F7-EXTRAS** | **SATURATED 0/0** (no new/regressed in-scope path) |

Round-22 findings implemented and closed (verified by fresh re-derivation): the EQCMP
direct-fluent tail (~70 cells), delete-using aux-column returning, shaped-executable `*When`
octet, shaped single-row `*When` octet (now 20/20), `values([oneRow])`, recursive
orderBy/limit/offset (the direct-execute path — c3f64158), View per-kind read columns, sequence
custom-kind `adapter2`, Table optionalColumn adapter, the plain classification boundaries.

---

## Coordinator verification notes

1. **SEAM-A #1** — runtime probe on `postgres/oldest/pg` (compat 17M); both flat and nested
   arms emit correct SQL → REFUTED (agent's non-recursive-registration root-cause was wrong).
2. **SEAM-B C1** — runtime probe (4 arms) confirmed the drop; drop≠defect oracle → target
   clause (outer projection) is replaced by the CTE consumer → leans boundary → NOT asserted as
   a bug; presented as a maintainer-decision candidate.
3. **`*When` soundness** — every agent that met a `*When` divergence (PARITY, INSERT, UPDDEL)
   applied the oracle and declined to re-file `disallowIfNoValueWhen` (INSERT even added the
   *positive* fold test as §A). No sound-violating divergence found.
4. **update.ts:530-vs-532** — re-confirmed latent/OUT (sqlite `oldValues()` is `never`), not
   re-filed.
5. Tree confirmed clean after every probe (both deleted).

---

## Recommended implementation order

1. **SEAM-B C1** — maintainer decides render / type-forbid / documented-boundary; the direct-
   execute recursive ordering/paging arms (Tier-1 §A) are unambiguously testable regardless.
2. **Tier-1 §A**: the recursive-result overload arms (PARITY A1 / SELECT A1-A6); compound-into-CTE
   (SEAM-B A2); the aggregate-element classification twins (PROJ A1/A2).
3. **Tier-2 §A**: INSERT unshaped on-conflict `setWhen` + positive disallowIfNoValue fold;
   UPDDEL disallow Error-overload; BOOLIF elision-asymmetry; VALVIEW Values `adapter2`;
   PARITY GroupBy-ProjectableAsNullable; SEAM-A §A (computed/nested/on-conflict-from-select returning).
4. **§B**: PROJ depth-4/5 + inner-object rule precedence.

---

## Verdict

**A saturating round with zero confirmed bugs — and that is an honest, healthy result at this
maturity.** Nine surfaces are genuinely 0/0; the two seam critics did their job (surfaced two
untested compositions), and the coordinator's own probes did theirs: one candidate **refuted**
(correct SQL vs a plausible-but-wrong structural claim), one a **real drop that leans
NOT-APPLICABLE boundary** and was *not* asserted as a bug (the drop≠defect oracle working as
intended, one round after it was learned). The §A/§B tail is concentrated where it should be —
the freshly-changed recursive-result ordering/paging surface (the round's focal area), the
aggregate-projector classification twins, and a handful of distinct-overload/elision-branch
gaps. `src/` was not touched; `BUGS.md` stays empty pending the maintainer's C1 decision.
