# MISSING_TESTS_AUDIT — Round 36 (MAXIMAL generosity — re-audit of the post-Round-35 surface)

**Mandate:** same maximal per-variant standard as Round 35, re-run against the current tree to find what remains after Round 35's implementations. A representative lowers a variant's tier, it does not remove it; only genuinely compile-only (byte-identical SQL **and** value **and** type), as-any/impossible-state, driver-layer, or new-matrix-cell is OUT. Long report accepted — but the honest finding is a **short** remainder (below).

**Method:** 14 read-only enumeration agents (Wave 1 ×10 + Wave 2 ×4), each re-deriving its surface against the current files, seeded with what Round 35 landed. Coordinator verified the load-bearing claims (compile-repro / source-trace / wide-grep).

## Headline

1. **Round 35's audit caught a real bug.** Its VALVIEW finding (the missing `Values` negative-type file) exposed a **v2 regression: `Values.create(...)` validated nothing** — the row parameter resolved to `{}`, so a missing required column, a wrong value type, an undeclared key, even a non-object row all compiled. Filed in `BUGS.md`, now **fixed** in `78b7930a` (src/Values.ts +117, src/utils/Column.ts +49, src/extras/utils.ts +28: `Values` columns carry the column marker again, so `Values.create` enforces the row shape and the writable-column extractors return a `Values` view's real columns). This is the maximalist method working exactly as designed — a maximal pass surfaced a real defect via its finding.
2. **Round 35's ~1,900-cell list was largely implemented.** connection.ts grew +136 lines (all 26 `executeFunction` return-kind wrappers, the custom-kind+adapter Table battery on `tReleaseDraft`, the req/View localDateTime columns, the optional-custom columns). Re-deriving each surface: **the great majority of R35's list is now individually covered.**
3. **~40 genuine cells remain**, concentrated in a few surfaces (PROJ asNull twins, BOOLIF literal-on-column, STR substr/optional-receiver, the 3 new write-through-adapter shapes, a handful of §B fixtures). **0 new src bugs. 0 candidate-defects.**
4. **Round 36 also corrected two Round-35 over-counts** under the source-traced R-P7 discriminator: the ~540-cell EQCMP `·OPT` tail and the ~120-cell VALVIEW tuple tail both **close as degenerate** (leaf-invariant type / non-round-trippable value). The §7-item-5 discipline working in the *closing* direction.

`BUGS.md` is empty and stays empty.

---

## The remaining genuine list (tiered, by surface). ~40 cells, all on existing fixtures unless marked §B.

### PROJ — 5 asNull-projector twins + ~4 Tier-3 *(7 of the 12 R35 twins landed)*
Both projectors are separate code; these default cells still lack their `projectingOptionalValuesAsNullable()` twin. Each needs a boundary-row runtime probe (`'k' in obj` / `=== null`).
- **Tier-1 (3):** asLeftJoin-over-CTE for a **plain** rule-2/3 object (join-miss → `proj: {…}|null`) [`inner-rules:849` default]; sole-optional-chain **depth-4 collapse** asNull (issue 3 → `w: null` present-key) [`:2223` default]; rule-2-wrapper-of-sole-rule-2-inner-with-const-required-leaf asNull (join-miss → `wrapper.inner.iid === null`) [`:2614` default].
- **Tier-2 (2):** sole-optional-chain depth-4 **present** asNull [`:2194` default]; CTE-re-projection rule-2 asNull with a join-miss [`:58` default].
- **Tier-3 (~4):** `ColumnsForWithView` one-column `{result}` branch (both projectors, `asWithView.ts:16`); compound rule-3 asNull with an optional leaf; CTE rule-3 asNull with an optional leaf; compound depth-2 / deep-3-level nesting.
- **OUT:** `ContainsRequired5` — compile-only (both projectors `never`-truncate at level 5, so the assumed-required arm is unreachable by any realizable value). Re-confirmed.

### BOOLIF — 10 literal-operand-on-a-column cells (Tier-3 §A)
`{billable, verified, published, approved, invoiced} × {.and(true), .or(false)}` — the `and(value: boolean)` / `or(value: boolean)` literal overload composed with a **remapping (custom-boolean) or plain-column** receiver, a receiver class the existing literal-overload tests (`priority.equals(2).and(true)`) never touch. Distinct remapped SQL + bound param each (`verified = 'Y' and $1`, param `[true]`). Zero coverage anywhere. Home: `select.custom-boolean-remap.test.ts` (custom) / `select.bool-ops.test.ts` (plain). *(The 8 combinator-elide cells R35 tentatively listed → OUT: they emit a bare-table select byte-identical to already-covered tests.)*

### STR — ~8 cells (Tier-1 §A)
- `substrToEnd(n)` on the 3 bracket-adapter columns (`versionBracketed`, `channelBracketed`, `reviewerCode`) — the substr-family enumeration has substr/substring 2-arg but omits the single-boundary ToEnd shape (distinct SQL + bracketed value).
- `tIssue.body` (optional receiver) into `trim()` / `substr(0,3)` / `substrToEnd(n)` / `replaceAll(c,c)` — the optional-`?:` leaf on transforms not yet covered on `body`.
- The optional-receiver **NULL-row-through-transform → absent VALUE** (`body.toUpperCase()` @ a NULL row; `channelBracketed.toUpperCase()` @ a NULL row) — every current transform test reads a present row.
- **Adjacent flag (virtual-column agent territory):** the virtual/computed string+bracket columns (`versionTagged`, `versionUpperTagged`, `versionTag`, `activityTagged`, `tagLabel`, `tagLabelOptional`, `tag`) are never fed into a string transform — `versionTagged.toUpperCase()` → bracketed result is a parallel uncovered family.

### COL — 3 cells (Tier-2 §B) — the one value-distinct gap
Adapter over the **uuid / localDate / localTime base marshaller** — these are the only 3 marshallers no column of any factory adapter-wraps anywhere (a real docker-observable value round-trip the mock can't cover). **§B fixture:** extend `tReleaseDraft` with `customUuid + bracketAdapter`, `customLocalDate + shiftHourAdapter`, `customLocalTime + shiftHourAdapter` reading a DB DEFAULT — one fixture set that simultaneously fills the 3 kinds still absent from `columnWithDefaultValue`'s `[a2]` set. *(The [a2] custom-kind trailing-adapter arm on the other 12 factories → Tier-3 §B, value-identical to each factory's plain+adapter sibling → mostly R-P7 CLOSE.)*

### MUT / NEW-FIX-COL — 2 write-through-adapter shapes (Tier-1 §A) *(two agents converged)*
The `tReleaseDraft` adapter columns are read-only in the suite (they read a DB DEFAULT through the adapter's *read* path); their **write** path is exercised nowhere, and 2 adapters have **no write site anywhere**:
- `shiftedStamp` write-through `shiftHourAdapter` (−1h) — the only Date-value-transforming adapter.
- `shiftedCount` write-through `plusThousandBigintAdapter` (−1000n) — the only bigint-value-transforming adapter.
Realize via INSERT/UPDATE `.set({...})` → bound param `value − offset`, read-back `+ offset`. Economical: **one combined INSERT…RETURNING round-trip writing all 8 adapter columns + one representative UPDATE** (the numeric ones — scaledCost/shiftedAmount/shiftedRating — are byte-identical to `tLedgerEntry.amount`/`entryNo` writes, so they ride along as homogenization; the 2 above are the genuinely-novel shapes).

### TEMP — 2 cells (Tier-3 §A)
`targetDay` (optional customLocalDate) getters `getFullYear/getMonth/getDate/getDay` + `cutoff` (optional customLocalTime) getters `getHours/getMinutes/getSeconds/getMilliseconds` — a 2-row projection realizes the **`undefined` inhabitant of the optional-custom-temporal getter leaf**, which no existing getter test does (all covered optional-custom getters use `.asOptional()` on a never-NULL column). *(`shiftedStamp` getters → CLOSE: the +1h adapter is provably not observable on a numeric getter leaf, only on the whole-Date read, which is covered.)*

### F-RECENT-VALUES — 5 cells (the Values.create fix's remaining arms)
- **§B negative-type locks (3):** non-object-row rejected; a `virtualColumnFromFragment` Values column rejected as a row key (needs a Values class carrying a virtual column); wrong value type for the **optional** column. Home: `types.negative/with-values.test.ts`.
- **§A extractor assertions (2):** `assertType<Exact>` on the Values-view `extractWritableShapeFrom`/`…NamesFrom` return type (runtime `toEqual` landed but no type-lock — the table twin has one); a runtime assertion of the `extractWritableColumnsFrom(valuesView)` columns-object variant (minor).

### CONN — 2 §B + 1 negative-lock
- **§B (2):** sequence `bigint + adapter` (`auditTagSeqOffset` — a bigint sequence read through a bigint adapter `+1000n`, an observation no sequence test makes) × {nextValue, currentValue}.
- **negative-lock (1):** `valueArg('…','required')` — **coordinator compile-repro confirmed** it compiles and **rejects null/undefined** (distinct compile-time contract from the optional valueArg), but the runtime SQL is identical when a value is present → the artifact is a `types.negative` lock (a required valueArg rejects null), not a runtime test.

### EQCMP — 1 cell (Tier-2 §A)
`tProjectRelease.version.greaterThanIfValue` — the single asymmetric hole (the sibling `lessThanIfValue`/`lessOrEqualIfValue`/`greaterOrEqualIfValue` on the same customComparable column exist; `greaterThanIfValue` is missing).

### NULLABLE — 1 cell (Tier-2 §A) + 4 free-riders
- **§A (1):** `NumberValueSource.nullIfValue(value-source overload)` — every plain-number `nullIfValue` in the matrix uses a literal probe; the value-source arm (`nullif(priority, assignee_id)`) is never exercised on the base Number leaf (covered on bigint/customInt/customDouble/string/temporals). Distinct SQL + distinct overload.
- **Close-leaning (4):** `asOptional` on boolean/localDate/localTime/localDateTime — distinct-type-only (`col as alias`, value unchanged); add as 1-line free-riders to the existing per-leaf tests or close per R-P7.

### SELECT — 1 §A (verify-first) + 4 §B branch-reach *(R35's ~47 essentially landed)*
- **§A verify-first (1):** `orderBy(rawFragment, <insensitive-family or nulls mode>)` — the one unproven orderBy render arm (only `rawFragment, 'desc'` on the compound overload is pinned). Whether an insensitive mode wraps the fragment as `lower(<fragment>)` / a nulls mode triggers the CASE-fallback is unproven — **probe the SqlBuilder before locking.**
- **§B branch-reach (4):** `orderBy(rawFragment, 'desc')` on the plain overload; `innerJoin().dynamicOn().or()` first-arm in SELECT; `dynamicHaving().or()` seeding-arm; bare `optionalJoin().on()` dedicated snapshot. *(R35's "bare-`.join`-after-comma-from" — non-existent API; `.from()` returns a builder with no join methods → OUT.)*

### SEAM / DYN / EXTRAS / NUM / VALVIEW — SATURATED (0 genuine)
- **SEAM:** both R35 §A items landed (compound-as-CTE `beforeWithQuery` at the exact predicted snapshot; compound inline-aggregated-array customize); 6 §B routing-identical compositions warrant no test; 0 candidate-defects.
- **VALVIEW:** the entire R35 tuple tail closes (the "custom-temporal present-position casts" flag was a **misfire** — source-traced: a present custom-temporal column emits no cast, identical to the null form already pinned, and a Date doesn't round-trip → no distinct value). 0 genuine.
- **DYN / EXTRAS / NUM:** R35-saturated, no new fixtures touch them — re-confirmed saturated (not re-fanned this round).

---

## Round-35 over-counts corrected (the §7-item-5 discriminator, closing direction)

Round 35 filed these as Tier-3 §A; the source-traced R-P7 boundary closes them:
- **EQCMP `·OPT` optional-receiver→optional-boolean projection (~540 cells) → DEGENERATE.** The projected type is **leaf-invariant** (`{key?: boolean}` regardless of leaf); the SQL differs only by column name (already pinned); the `undefined` inhabitant is uniform. The merge branch is proven once, generically — no per-leaf×method cell adds SQL, value, or type.
- **VALVIEW tuple tail (~120 cells) → DEGENERATE**, including R35's "custom-temporal present-position cast" headline (disproved by source-trace).
- **EQCMP ordered-`*IfValue` (33 cells) → thin** (fire-SQL already pinned per-leaf by the direct ordered comparisons; elide is leaf-agnostic) — only `version.greaterThanIfValue` promoted.
- **COL `[a2]` on 12 factories, NULLABLE asOptional ×4, BOOLIF combinator-elide ×8 → close-leaning / OUT** as detailed above.

These are recorded so a future round doesn't re-promote them.

---

## Per-surface status

| Surface | R35 → R36 | Genuine remaining |
|---|---|---|
| PROJ | 12+8 → 5+4 | 3 Tier-1 + 2 Tier-2 asNull twins + ~4 Tier-3 |
| BOOLIF | 18 → 10 | 10 literal-on-column (Tier-3 §A); 8 elide → OUT |
| STR | ~190 → ~8 | substrToEnd ×3, body ×4, NULL-through-transform |
| COL | ~469 → 3 | uuid/localDate/localTime adapter marshaller (§B) |
| MUT/NEW-FIX-COL | (new) → 2 | shiftedStamp/shiftedCount write-through |
| TEMP | 48 → 2 | targetDay/cutoff optional-custom getters |
| F-RECENT-VALUES | (new) → 5 | 3 neg-locks + 2 extractor assertions |
| CONN | ~120 → 3 | sequence bigint+adapter ×2 + valueArg neg-lock |
| EQCMP | ~620 → 1 | version.greaterThanIfValue (·OPT tail → degenerate) |
| NULLABLE | 44 → 1 | NumberValueSource.nullIfValue-vs (+4 free-riders) |
| SELECT | ~47 → 1+4 | orderBy(rawFragment,mode) verify + branch-reach |
| SEAM | 8 → 0 | SATURATED |
| VALVIEW | ~120 → 0 | SATURATED (Tier-3 tail closes) |
| DYN / EXTRAS / NUM | 0 → 0 | SATURATED (re-confirmed) |

---

## Coordinator verification notes

1. **`valueArg('…','required')`** — subclass compile-repro (`buildFragmentWithArgsIfValue` etc. are protected, only reachable as connection fields): compiles, and a required valueArg rejects `null` (the `@ts-expect-error` held) while the optional accepts+elides → distinct compile-time contract, identical runtime SQL → **negative-type lock**. Probe deleted; tree clean.
2. **EQCMP `·OPT` re-classification** — the optional→optional-boolean projection type is leaf-invariant; the merge is generic, proven once. Not a per-leaf fan-out. Closes.
3. **VALVIEW custom-temporal-present misfire** — source-traced `PostgreSqlConnection.transformPlaceholder`: a present custom-temporal value (`type='ReleaseDay'`, `valueSentToDB` a Date/string) misses the base-type switch and the numeric heuristic → `return placeholder` (no cast), identical to null. No unasserted present-position cast.
4. **MUT/NEW-FIX-COL convergence** — two agents independently isolated the same 2 genuinely-novel write-transform shapes (temporal-Date, bigint); the numeric adapter writes are byte-identical to existing `tLedgerEntry` writes.
5. **0 candidate-defects** across all 14 agents; **0 src bugs**.

Working tree ends **clean** (both compile-repros deleted; `git status --porcelain` shows only the pre-existing untracked reports + `.gitignore` + this file).

---

## Recommended implementation order

1. **PROJ 5 asNull twins** (Tier-1/2, existing fixtures, each with a boundary-row probe) — highest genuine value.
2. **The 2 write-through-adapter shapes** (one combined INSERT/UPDATE round-trip test on `tReleaseDraft`).
3. **BOOLIF 10 literal-on-column** + **STR ~8** + **TEMP 2** + **EQCMP 1** + **NULLABLE 1** — cheap, existing fixtures, one file each.
4. **§B fixtures:** COL 3 (uuid/localDate/localTime adapter marshaller — one `tReleaseDraft` extension), CONN sequence bigint+adapter.
5. **Negative-type locks** (types.negative): F-RECENT-VALUES 3, CONN valueArg-required.
6. **SELECT P1** after a SqlBuilder probe of the rawFragment-insensitive render.

## Verdict

Round 36 is the healthy convergence of Round 35's maximal push: **its ~1,900-cell list was largely implemented, one real bug was caught and fixed (`Values.create`), and the honest remainder is ~40 genuine cells** — plus the correct *closing* of two large R35 Tier-3 over-counts (`·OPT`, VALVIEW) under a source-traced discriminator. **0 new src bugs. 0 candidate-defects.** Six surfaces are now genuinely saturated (SEAM, VALVIEW, DYN, EXTRAS, NUM, and effectively EQCMP/NULLABLE/SELECT). The report is shorter than Round 35's not because the standard relaxed but because the surface is now near-total coverage — exactly the intended trajectory.

**Runbook:** no edit warranted — 0 new defects, no new failure mode or fingerprint. (The `Values.create` regression git records; it matches no new fingerprint pattern — it was a marker-consolidation regression the negative-type-lock finding surfaced, i.e. the existing "a just-changed src type surface ships the negative side but leaves the positive/reachable arm untested" theme in reverse: the *negative* lock was missing and its absence hid a real gap.)
