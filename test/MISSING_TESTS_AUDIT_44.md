# MISSING_TESTS_AUDIT_44 — type-driven missing-tests audit, Round 44 (MAXIMAL-SATURATION dial)

> **Mandate (this round, per the user).** Collect **every writable test** needed
> to drive the typed surface to **total saturation** — *including* the
> output-coincident tails prior rounds CLOSED under R-P7 — so the implementer has
> the longest possible work-list and no future round has to re-discover the tail.
> **The dial is at maximum:** a cell that produces a real `ctx.conn` query with a
> distinct SQL / params / result-type / realized value is a **test TO WRITE**
> even when its output coincides with a covered test (a regression breaking only
> that path leaves covered tests green). Such cells are enumerated as **Tier T4**,
> one line per variant — never CLOSED. Only cells with **zero** SQL/params/value
> surface (pure compile-only → negative-type, `src/queryRunners/` driver-layer,
> impossible-state, or a new matrix cell) stay **OUT**. Every enumerated item is a
> DESIGN.md Principle-#1 test (SQL + params + result type + value, real-DB-validatable).

## Headline

- **Matrix at run:** 17 cells · 245 files · **3024 tests/cell** · symmetric · `tests:audit` 0 problems.
- **Method:** 20 discovery agents (maximal-enumeration brief), each re-derived its full surface matrix from scratch; coordinator-verified the one candidate bug (tsgo compile-repro) + the two highest-value fix-composition emissions (mock probe).
- **Confirmed `src/` bug → `BUGS.md`:** **1** — PARITY-1: shaped `setIfValue` (insert.ts:627) is over-restrictive, rejecting `null`/`undefined` values that non-shaped `setIfValue` accepts (compile-repro confirmed; corroborated by a provably-dead type branch). Matches the theme-2 "shaped continuation drops SHAPE" fingerprint — no new fingerprint.
- **Baked-in-bug scan of the R43 backlog+fix tests:** **CLEAN** (0 contradictions; both commented sqlserver blocks + the numeric-promotion LIMITATION block correctly isolated, swallow no live test).
- **R43-fix (`1f970132`) verification:** the A-1 (empty on-conflict → `do nothing`/`insert ignore`) and C1 (compound rawFragment-orderby wrap) fixes are **sound and complete** on the tested paths; their untested *compositions* are enumerated (F-RECENT / MUT-SEAM).
- **Enumerated writable backlog: ≈ 2,430 discrete tests** across 20 surfaces (see Part IV for the per-surface counts). The vast majority are **T4 output-coincident** (the whole point of the maximal dial); the **genuinely-distinct (T1–T3 / §B) core is ≈ 340 tests** (see Part VII order). This is the deliberately-long report the round asked for.

**A long report is the correct shape here.** Two prior maximal surfaces (EQCMP, DYN) alone yield 329 + ~500 T4; do not read the size as padding — every item is a real, runnable, distinct-reaching test.

---

## Part I — Bug, verification, limitations, notes

### CONFIRMED BUG (PARITY-1) → filed to `BUGS.md`

**Shaped `setIfValue` rejects `null`/`undefined` values that non-shaped `setIfValue` accepts.** `src/expressions/insert.ts:627` types `ShapedInsertExpression.setIfValue`'s param as `MandatoryInsertSets<TABLE,USING,SHAPE>` (identical to `.set` on line 626) instead of the optional twin `MandatoryOptionalInsertSets<TABLE,USING,SHAPE>` its non-shaped sibling (line 613) uses.

- **Coordinator compile-repro (tsgo, CONFIRMED):** on `tOrganization.verified` (defaulted, non-nullable, optional-on-insert), `insertInto(tOrganization).setIfValue({name:'x',plan:'y',verified:null})` **compiles**, while `insertInto(tOrganization).shapedAs({v:'verified',n:'name',p:'plan'}).setIfValue({n:'x',p:'y',v:null})` **errors** TS2322 on `v:null` (shaped value type `boolean | Default | IBooleanValueSource<…>`, no null/undefined).
- **Corroboration (dead branch):** `MandatoryOptionalInsertSets` is referenced at exactly one site (line 613, SHAPE=undefined), so `MandatoryOptionalInsertSetsContent`'s `SHAPE extends ResolvedShape` arm (insert.ts:1116-1123) is provably unreachable — that branch exists to type a *shaped* `setIfValue`, but line 627 calls the wrong type. Fingerprint of a copy-paste from line 626.
- **Both readings:** *bug (favored)* — shaped `setIfValue` should mirror the non-shaped twin; the shape only renames keys, not the null-skip value contract; the fix animates the dead branch and is sound (a null-skipped column stays in MISSING_KEYS → no unsound insert executes). *by-design (implausible)* — shaped `setIfValue` intentionally equals shaped `set`; contradicts `setIfValue`'s purpose and is undocumented.
- **Impact: low** — only bites a defaulted-non-nullable optional-in-shape column passing explicit `null`; a nullable column's value type already carries `undefined`, masking it (why `insert.shaped.test.ts:71` `archived: undefined` compiles). Fix = one-token change at line 627.
- **Regression test:** PARITY-1 (Part II, Surface INSERT) — gated on the fix; `// TODO[BUG]` until it lands.

### Baked-in-bug scan (F-RECENT PART 2): CLEAN

Every R43-backlog + fix characterization test's `assertType<Exact>` agrees with its `toEqual`/value/SQL (no key-required-but-omitted, no null-vs-undefined, no dropped-vs-kept container). Verified specifically sound: the empty-on-conflict `do nothing`/`insert ignore` snapshots; the compound-arm customWindow/afterSelectKeyword/beforeColumns; `default values returning` +1000 adapter id; the custom-boolean `isNull`/`isNotNull` (`(approved='A') is null` / `(invoiced=1) is null`); `centsFromIdOptionalTagged` present-value `1100` (⊆ optional type, sound). Block-swallowing gotcha verified: the sqlserver C1 sibling, the two sqlserver A1 blocks, and the numeric-promotion LIMITATION block are each correctly isolated in their own `/* */` and swallow no adjacent live test.

### Coordinator emission probes (mock, deleted, tree clean)

- **MUT-EMPTY-3 CONFIRMED:** `insertInto(tProject).values({…}).onConflictOn(cols).doUpdateDynamicSet({archivedAt:null}).ignoreAnySetWithNoValue().returning({id}).executeInsertNoneOrOne()` → `insert into project (…) values ($1,$2,$3) on conflict (organization_id, slug) do nothing returning id as id` — the `returning` clause **survives** the degrade (the `_setSafeTableOrView` leak fix's sole manifestation, currently untested).
- **SEL-C1-multiparam CONFIRMED:** compound `orderBy(rawFragment`${const(1)} + ${const(2)}`)` → `select * from (…) as o_1_ order by $1 + $2` (wraps with 2 params; `__params.length>0` gate confirmed).

### Limitations (by-design; NOT bugs)

- **L-1 — custom-temporal CONST getter** emits bare `extract(part from $1)` (PG-rejected untyped placeholder; user `transformPlaceholder` responsibility). 34 variants (`const`/`optionalConst` × customLocalDate/Time/DateTime × getters). Degenerate on all other dialects. OUT/LIMITATION. (F1-TEMP.)
- **L-2 — int-receiver fractional-const** (`priority.add(2.5)`) → `col + $1`, PG binds `$1::int4` and rejects `2.5` (22P02). Already `// TODO[LIMITATION]` in numeric-overloaded-promotion.test.ts:211; the result→double behavior is value-proven via the double-COLUMN promotion. (F1-NUM.)
- **L-3 — MariaDB `insert ignore … returning`** (MUT-SEAM candidate): the empty-on-conflict degrade on MariaDB emits `insert ignore … returning …`; whether MariaDB accepts RETURNING on INSERT IGNORE is a **real-DB question to resolve during propagation** (both readings). If the engine rejects it, mark the MariaDB cell's MUT-EMPTY-3 `// TODO[LIMITATION]` (like the existing MariaDB multi-table-RETURNING limitation) — **not** a src bug (the library emits shaped SQL the specific engine may reject).

### Inert / cosmetic src notes (OUT — carried, re-confirmed by PARITY; not a gap)

- **N-1 — `update.ts:532`** sqlite `ReturningOneColumnFnType` mis-brackets `| NOldValuesFrom<…>` outside `ValueSourceOf<…>`. Unreachable (`oldValues()` is `never` on SqliteConnection). Known inert.
- **N-2 — `CompoundableCustomizableExecutableSelectExpressionWitoutWhere`** ("Witout" typo, 5 sites in select.ts). Compiles; cosmetic.

### Doc-hygiene (report-only; not a test gap)

- **D-1 — stale `with-values` headers** (`with-values.test.ts:5-7`, `with-values.advanced.test.ts:28-30`, 34 cells) still claim some dialects block-comment the Values body — false since R40 (Values typed on all 6 dialects, live in all 17 cells; correct wording in `with-values.join-and-subquery.test.ts:18-21`). Two-header cleanup. Flagged unapplied since R41.

### Awareness-only (F7-EXTRAS; not a bug, not a test)

- IDEncrypter `decrypt` throws for values `> 2^64` despite `encrypt` producing the documented longer string — undocumented boundary; docs promise only "a longer string", not decryptability. Not filed, not baked.

### Negative-type top-up (F1-NUM; belongs to types.negative/, noted)

- bigint `cos`/`tan`/`acos`/`asin`/`atan`/`cot` and `asInt`/`asDouble`/`asBigint` are typed-never but not individually `@ts-expect-error`-locked (only `sin` stands in for trig at types.negative/select.test.ts:346-368). A negative-lock top-up is warranted (out of the positive-test backlog scope).

---

## Part II — The enumerated backlog (by surface)

Each surface reproduces its full to-write matrix (naming every variant per §8). Shared per-surface assertion templates are stated once; the grep proving absence is the named-column pattern each agent verified 0-hit. **T1** distinct code-path/bug-class · **T2** distinct overload/per-type emission/seam · **T3** per-variant completeness (may need §B) · **T4** output-coincident fan-out.

### Surface EQCMP (F1-EQCMP) — 329 T4 · Equalable/Comparable/Nullable × 16 leaves

Leaves (16 distinct): NumberValueSource(int/double), Bigint, String, Boolean, Uuid, LocalDate, LocalTime, LocalDateTime, CustomInt, CustomDouble, CustomComparable, Custom(eq-only), Enum, CustomUuid, CustomLocalDate, CustomLocalTime, CustomLocalDateTime. Template: `.where(colA.<method>(operand))` projecting `{id}`, inline SQL snapshot + params + `assertType<Exact>` + real-DB value; pair dynamic with direct. Fixtures: all exist (§B: none).

- **§V — value-source/column operand overload, per leaf (220 T4).** Distinct SQL `colA <op> colB` (vs `col <op> $1`). Enumerated by leaf × the specific missing methods:
  - Number(int): `lessThan, lessOrEqual, valueWhenNull` (3)
  - Number(double): `equals, notEquals, is, isNot, lessThan, greaterThan, lessOrEqual, greaterOrEqual, between, notBetween, in, notIn, inN, notInN, valueWhenNull, nullIfValue` (16)
  - Bigint: `equals, notEquals, is, isNot, lessThan, greaterThan, lessOrEqual, greaterOrEqual, between, notBetween, in, notIn, inN, notInN` (14)
  - String: `equals, notEquals, is, isNot, lessThan, greaterThan, greaterOrEqual, between, notBetween, in, notIn, inN, notInN` (13)
  - Boolean: `notEquals, is, isNot, in, notIn, inN, notInN, valueWhenNull, nullIfValue` (9)
  - Uuid: `equals, notEquals, is, isNot, lessThan, greaterThan, lessOrEqual, greaterOrEqual, between, notBetween, in, notIn, inN, notInN, nullIfValue` (15)
  - LocalDate: `equals, notEquals, is, isNot, lessThan, greaterThan, lessOrEqual, greaterOrEqual, between, notBetween, in, notIn, inN, notInN` (14)
  - LocalTime: same 14
  - LocalDateTime: the 14 + `nullIfValue` (15)
  - CustomInt: `equals, notEquals, is, isNot, lessThan, greaterThan, lessOrEqual, greaterOrEqual, between, notBetween, in, notIn, inN, notInN` (14)
  - CustomDouble: same 14
  - CustomComparable: the 14 + `valueWhenNull, nullIfValue` (16)
  - Custom(eq-only): `notEquals, isNot, in, notIn, inN, notInN` (6)
  - Enum: `notEquals, isNot, in, notIn, inN, notInN` (6)
  - CustomUuid: `equals, notEquals, isNot, lessThan, greaterThan, lessOrEqual, greaterOrEqual, between, notBetween, in, notIn, inN, notInN, nullIfValue` (14)
  - CustomLocalDate: `lessThan, greaterThan, lessOrEqual, greaterOrEqual, notBetween, in, notIn, inN, notInN` (9)
  - CustomLocalTime: `equals, notEquals, is, isNot, lessThan, greaterThan, lessOrEqual, greaterOrEqual, between, notBetween, in, notIn, inN, notInN` (14)
  - CustomLocalDateTime: same 14
- **§IfValue — IfValue-twin gaps, per leaf (101 T4).** Fire + elide control each. Systematic: `isIfValue` missing on 15 leaves, `isNotIfValue` on 16. By leaf:
  - Number(double): `equalsIfValue, notEqualsIfValue, isIfValue, isNotIfValue, inIfValue, notInIfValue` (6)
  - Bigint: `notEqualsIfValue, isIfValue, isNotIfValue, notInIfValue` (4)
  - String: `isIfValue, isNotIfValue, inIfValue` (3)
  - Boolean: `isNotIfValue, inIfValue, notInIfValue` (3)
  - Uuid: `lessThanIfValue, greaterThanIfValue, lessOrEqualIfValue, greaterOrEqualIfValue, isIfValue, isNotIfValue, inIfValue` (7)
  - LocalDate / LocalTime / LocalDateTime: all 10 each (`equalsIfValue, notEqualsIfValue, isIfValue, isNotIfValue, lessThanIfValue, greaterThanIfValue, lessOrEqualIfValue, greaterOrEqualIfValue, inIfValue, notInIfValue`) (30)
  - CustomInt / CustomDouble: 9 each (all except `equalsIfValue`) (18)
  - CustomComparable: `equalsIfValue, notEqualsIfValue, isIfValue, isNotIfValue, notInIfValue` (5)
  - Custom(eq-only) / Enum: `isIfValue, isNotIfValue` each (4)
  - CustomUuid: 9 (all except `equalsIfValue`) (9)
  - CustomLocalDate / CustomLocalTime: `isIfValue, isNotIfValue` each (4)
  - CustomLocalDateTime: `equalsIfValue, notEqualsIfValue, inIfValue, notInIfValue, lessThanIfValue, greaterThanIfValue, lessOrEqualIfValue, greaterOrEqualIfValue` (8)
- **§Q/§micro (8 T4):** String `in(Q)`, String `notIn(Q)`, Boolean `in(Q)`, Boolean `notIn(Q)`; LocalTime `inN(const)`; CustomComparable `minVersion.isNotNull`; Number(double) `onlyWhenOrNull`, `ignoreWhenAsNull`.

### Surface DYN (F6-DYN) — ~500 T4 · per operator × type × path

Template: `dynamicConditionFor(...).withValues(...)` paired with its direct non-dynamic equivalent (identical SQL+params) + inline snapshot + `assertType<Exact>` + real-DB value. Fixtures: all exist (§B: none). Each cell exists on **both** the `FilterTypeOf` descriptor path and the `MapValueSourceToFilter` inline path (path-doubling — B19); enumerate un-paired (op × path) cells separately. By type (covered ops in parens):

- **B1 bigint** (covered gt,le): `equals, notEquals, is, isNot, in, notIn, lessThan, greaterOrEqual, isNull, isNotNull` + `*IfValue`
- **B2 double** (covered gt, isNot(null)): `equals, notEquals, is, in, notIn, lessThan, lessOrEqual, greaterOrEqual, isNull, isNotNull` + `*IfValue`
- **B3 string raw-comparable** (covered like/affix/insensitive/equality): `lessThan, greaterThan, lessOrEqual, greaterOrEqual` + `*IfValue`; base `equalsIfValue, notEqualsIfValue`; `notIn` base
- **B4 uuid** (covered containsInsensitive, notEqualsInsensitive): `equals, notEquals, is, isNot, in, notIn, isNull, isNotNull, equalsInsensitive, like, notLike, likeInsensitive, notLikeInsensitive, startsWith, notStartsWith, endsWith, notEndsWith, contains, notContains, startsWithInsensitive, notStartsWithInsensitive, endsWithInsensitive, notEndsWithInsensitive, notContainsInsensitive`, + type-permitted `lessThan/greaterThan/lessOrEqual/greaterOrEqual` (also probes uuid dispatch) + `*IfValue`
- **B5 customUuid** (covered equals, contains, startsWith, equalsInsensitive, notEqualsInsensitive): `notEquals, is, isNot, in, notIn, isNull, isNotNull, lessThan, greaterThan, lessOrEqual, greaterOrEqual, like, notLike, likeInsensitive, notLikeInsensitive, notStartsWith, endsWith, notEndsWith, notContains, startsWithInsensitive, notStartsWithInsensitive, endsWithInsensitive, notEndsWithInsensitive, containsInsensitive, notContainsInsensitive` + `*IfValue`
- **B6 localDate / B7 localTime** (covered ge,lt): `equals, notEquals, is, isNot, in, notIn, lessOrEqual, greaterThan, isNull, isNotNull` + `*IfValue`
- **B8 localDateTime** (covered ge): `equals, notEquals, is, isNot, in, notIn, lessThan, lessOrEqual, greaterThan, isNull, isNotNull` + `*IfValue`
- **B9 customInt / B10 customDouble** (covered gt,lt): `equals, notEquals, is, isNot, in, notIn, lessOrEqual, greaterOrEqual, isNull, isNotNull` + `*IfValue`
- **B11 customComparable** (covered gt,lt,equals,lessOrEqualIfValue,inIfValue): `notEquals, is, isNot, in(base), notIn, lessOrEqual(base), greaterOrEqual, isNull, isNotNull` + remaining `*IfValue`
- **B12 custom eq-only** (covered notEquals, in, notEqualsIfValue, inIfValue): `equals(base), is, isNot, notIn, isNull, isNotNull, equalsIfValue, isIfValue, isNotIfValue, notInIfValue`
- **B13 customLocalDate / B14 customLocalTime / B15 customLocalDateTime** (covered ge,lt): `equals, notEquals, is, isNot, in, notIn, lessOrEqual, greaterThan, isNull, isNotNull` + `*IfValue`
- **B16 boolean** (covered equals, notEquals, in, is, isNull): `isNot, isNotNull, notIn` + all 6 equalable `*IfValue`
- **B17 enum** (covered equals, in, notEquals): `is, isNot, notIn, isNull, isNotNull` + `*IfValue`
- **B18 int residue:** `isNull`/`isNotNull` on an int column; `notIn:[]` empty-array
- **B19 path-dimension:** every un-paired (op × {descriptor, value-source-map}) cell = its own T4 line

### Surface STR (F1-STR) — ~290 T4 · affix-escape cross-product + adapter-into

Base method/overload/optionality surface (~66 leaves) is fully COVERED. To-write = the escape cross-product + theme-9 adapter-into:
- **21 T4 — `\[` combined needle (`'a\b[c'`) on the 21 affix methods** beyond the covered `contains/startsWith/endsWith` (sensitive): `notContains/notStartsWith/notEndsWith` (sensitive), all 6 `*Insensitive`, all 6 `*IfValue`, all 6 `*InsensitiveIfValue`. **Highest-value** (distinct SqlServer `[[]` param unpinned on these). Literal-param emission.
- **96 T4 — isolated single-char needles** (`%`/`_`/`\`/`[` alone) × 24 affix methods. Degenerate substring of the combined-needle param; lowest value.
- **141 T4 — real-DB MATCH cells** (row-selection): the affix × char × sensitivity grid minus the 19 covered; enumerated by (method × char × sensitivity). `[`-char cells carry real signal only in `sqlserver/*`. Priority subset: `startsWith×%`, `startsWith×[`, `endsWith×%`, `endsWith×[`, `contains×_`(literal); the `not*`/`*Insensitive`/`*IfValue`/`*InsensitiveIfValue` × {%,_,\,[} tail; and the column-operand match cells.
- **~32 T4 — adapter-string-into-method (theme 9)** on `tProjectReview.reviewerCode` (bracketAdapter): the string methods not yet fed it — `substringToEnd`, `concatIfValue`, `replaceAllIfValue`, `replaceAll(VS-operand-adapter)`; and the predicate methods `endsWith/contains/notStartsWith/notEndsWith/notContains/like/notLike/equalsInsensitive/notEqualsInsensitive/likeInsensitive/notLikeInsensitive`, all `*Insensitive` affixes, all `*IfValue` affixes, `startsWith`-in-top-level-WHERE.

### Surface COL (F2-COL) — ~129 §B (genuine) + ~250 T4 · column factories

The **headline actionable finding**: the four virtual-column factories are fixtured **only** with `string`/`customInt`/`enum` — every other plain+custom kind is a **distinct virtual-path leaf type never observed** (`ValueSourceFromBuilder`, a different read path from `DBColumnImpl`). **§B (needs fixture, ~129, T1/T3):**
- `virtualColumnFromFragment(kind, fn)` [required] Table + View, and `optionalVirtualColumnFromFragment(kind, fn)` [optional] Table + View, for the **plain** kinds `bigint, boolean, uuid, localDate, localTime, localDateTime, double, int(unbranded)` and the **custom** kinds `customDouble, customComparable, custom, customUuid, customLocalDate, customLocalTime, customLocalDateTime` — each producing a differently-typed leaf. Priority: **bigint, boolean, uuid, localDate, localTime, localDateTime + the branded custom-temporal/uuid/comparable** arms (genuinely distinct). §B fixture: add inline-computed virtual columns of each kind to `tIssueWorklog`/`tProjectRelease` (Table) + `vReleaseOverview` (View) — no schema/seed change. Plus the trailing-adapter twins (lower value).
- **~250 T4 — non-virtual factory per-kind fan-out** (`column`/`optionalColumn`/`columnWithDefaultValue`/`optionalColumnWithDefaultValue`/`primaryKey`/`computedColumn`/`optionalComputedColumn`/`autogeneratedPrimaryKey`(int/bigint only) + View `column`/`optionalColumn`) for the kinds not fixtured on that exact factory. The read marshalling is factory-invariant per kind (funnels through `DBColumnImpl` + `__as*`), so output-coincident → T4. Enumerated per (factory × kind × req/opt × adapter-slot × Table/View) — the per-factory tables in the F2-COL report name all 540 cells (97 covered, 129 §B, ~250 T4, ~64 OUT).

### Surface CONN (F5-CONN) — ~160 T4 (incl. ~30 §B) · Connection API

The no-adapter matrix + arity/overload structure is fully COVERED. To-write, one line per (method × kind × slot):
- **B1 (~36 T4) — `const`/`optionalConst` trailing-adapter slot:** `const(v, plainKind, adapter)` and `optionalConst(...)` for the 8 plain kinds (int,bigint,double,boolean,uuid,localDate,localTime,localDateTime; string covered); the `adapter2` slot `const<T,TN>(v, customKind, typeName, adapter)` / `optionalConst(...)` for the 9 custom kinds (none covered on `const`).
- **B2 (34 T4) — `executeFunction` trailing-adapter slot:** the 18 return kinds × {required, optional} minus string-req and customDouble-req. One domain `callRet*Adapter` wrapper each.
- **B3 (~34 T4) — `fragmentWithType`/`aggregateFragmentWithType` trailing-adapter slot:** the 16 remaining kinds each (+ optional siblings), on both.
- **B4 (~30 T4, §B) — `sequence` value-type fan-out:** the 15 remaining kinds (boolean/double/string/uuid/localDate/localTime/localDateTime/enum/custom/customComparable/customDouble/customUuid/customLocalDate/customLocalTime/customLocalDateTime) × {nextValue, currentValue}. **§B**: a `this.sequence(name, kind[, typeName])` declaration on `DBConnection` per kind (mock-only, no DDL). Distinct marshalled result type — the highest-value CONN block.
- **B5 (~11 T4) — aggregate `min`/`max` over remaining comparable leaves:** string, double, localTime, localDateTime, customLocalDate, customLocalTime, customLocalDateTime; + `sum(double col)`, `sumDistinct(int col)`, `average(double col)`, `averageDistinct(int col)`.
- **B6 (~15 T4, thin) — arity fan-out:** `executeProcedure` at 1/3/4/5 args; `rawFragment` at 1/2/3/4/6 interpolations; `arg`/`valueArg` `adapter2` slot for the remaining keywords; `isolationLevel(level, 'read only')`.

### Surface VALVIEW (F2-VALVIEW) — ~107 T4 · Values (inline VALUES)

Branch-complete (every `src/Values.ts` dispatch branch fires). To-write:
- **~36 T4 — per-kind column dispatch:** `column(kind)`/`optionalColumn(kind)` × {adapter, no-adapter} for the kinds not yet a Values-tuple member — customDouble-required, plain-optional-int, plain-optional-customInt, and the bigint/double/string/uuid/enum/custom/customComparable/customUuid across the adapter + optional axes. (Required-temporal cells are OUT — Date non-round-trip through the VALUES cast.)
- **~27 T4 — virtual-column dispatch:** `virtualColumnFromFragment`/`optionalVirtualColumnFromFragment` per kind not yet a Values-view virtual column (boolean/uuid/customInt/customDouble/customUuid/… + temporal caveat).
- **~34 T4 — virtual+adapter family:** the trailing-adapter arm × the 34 remaining kind×{req,opt} (the adapter slot itself is branch-covered by the two string cases).
- **~10 T4 uses (U1–U11):** Values as INTERSECT arm (U1), EXCEPT arm (U2), UNION ALL arm (U3), NON-seed trailing union arm (U4), LIMIT over `selectFrom(values)` (U5), OFFSET+limit (U6), count/aggregate over Values (U7), GROUP BY over Values (U8), Values-sourced scalar inline `.equals(...)` operand (U9), Values self-join (U11). **Highest-value: U1–U4, U9** (distinct WITH-hoist-through-compound / optionality / inline-operand seams).

### Surface NUM (F1-NUM) — 3 T3 + ~115 T4 · NumberValueSource/Bigint

- **B1 (3 T3, GENUINE distinct-SQL) — scalar-subquery operand:** `col.add(<scalar subquery>)` → `col + (select …)`, never fed to any numeric operator. Representatives: int-req (`priority.add(<int subquery>)`), bigint-req (`viewCount.add(<bigint subquery>)`), double-req (`priority.asDouble().add(<double subquery>)`). Fixtures exist (build via `selectFrom(...).selectOneColumn(...).forUseAsInlineQueryValue()`).
- **~25 T4 — subquery operand across the other operators** (int/double: `subtract/multiply/divide/modulo/power/logn/roundn/atan2/minValue/maxValue`; bigint: `subtract/modulo/minValue/maxValue`).
- **~90 T4 output-coincident** — double-opt unary/trig/f1 not yet on a double-opt receiver (`abs/ceil/floor/exp/ln/log10/cbrt/sign/acos/asin/atan/cos/cot/sin/tan/logn/roundn/atan2/asInt/asBigint/asDouble`); double-req via `.asDouble()` (unary/f1/trig/power/roundn/minValue/maxValue); int-opt receiver full method set; bigint-opt receiver (`ceil/floor/round/subtract-const/modulo-const/minValue/maxValue-const + VS operands`); direct `divide` value projection; int-receiver VS-operand `power/logn/roundn/atan2` with a double column (promotes). (Names per the F1-NUM report §B2.)

### Surface BOOLIF (F1-BOOLIF) — 40 · Boolean/If/AlwaysIf + CustomBoolean

- **Group 1 (4 T2 — R43 BOOL-B1 RESIDUAL, top priority):** `verified.isNull()`, `verified.isNotNull()`, `published.isNull()`, `published.isNotNull()` — the **required-string** custom-boolean adapters, left uncovered when R43 fixed only the nullable/numeric adapters (approved, invoiced). Distinct wrapped-remap SQL `(verified = 'Y') is null` / `(published = 't') is null`, absent from every cell.
- **Group 2 (6 T2) — valueWhenNull/nullIfValue as custom-boolean receiver, literal arg:** verified/published/invoiced × {valueWhenNull, nullIfValue} → `coalesce((verified='Y'),$1)` / `nullif(...)`.
- **Group 3 (17 T2/T4) — `*IfValue` on custom-boolean receiver** per uncovered adapter×op: `equalsIfValue`(verified/approved/invoiced), `isIfValue`(published/verified/approved), `notEqualsIfValue`(invoiced/verified/approved), `isNotIfValue`(published/verified/approved/invoiced) — fire + elide each.
- **Group 4 (3 T2) — modifier-trio on remaining adapters:** verified/approved/invoiced (`as req`, `null::bool as own/ign`).
- **Group 5 (6 T4) — elide branch per adapter:** published.onlyWhen(false)/ignoreWhen(true), approved.onlyWhen(false)/ignoreWhen(true), invoiced.onlyWhen(false), verified.ignoreWhen(true).
- **Group 6 (2 T2/T4) — paren branches:** `A and (B or C)` (right-operand `_or`); `not (A and B)`.
- **Group 7 (2 T4) — double-remap:** `approved.and(invoiced)` / `approved.or(invoiced)` (both operands remap).

### Surface PROJ (F3-PROJ) — ~24 T4 · complexProjections (both projectors)

Every T4 asserts BOTH `assertType<Exact>` AND the runtime boundary row (`'k' in obj` / `===null` / `.length`) — this surface produced the R40/R41 bugs. §B: none.
- **Pocket 1 (~8, largest) — aggregateAsArrayDistinct dropping element-top + nested rules:** distinct element-top rule-1 gate-null-drop (default+nullable), rule-2 all-left-join drop-on-miss (default+nullable), rule-3 own-required optional-leaf-drop (default), rule-4 all-optional drop (default+nullable), element-containing nested rule-1/rule-2-miss/rule-4 (default+nullable). Mechanical `aggregateAsArray`→`aggregateAsArrayDistinct` mirror (snapshot gains `distinct` + `jsonb_build_object`).
- **Pocket 2 (5) — picking:** picking × `aggregateAsArray` (default+nullable); rule-1 reqInOptObj gate leaf inside a picked object (default+nullable); rule-2 left-join originallyRequired leaf inside a pick (default+nullable); PickWitOthersAsOptionals all-optional through a real `.select(picked)` under nullable + drop probe.
- **Pocket 3 (~11) — missing default/nullable twins:** aggregate element-containing rule-3 required-inner NULLABLE; deep-nested (depth 3-4) inside aggregate element (default+nullable); inline compound-union rule1/rule2-leaf DEFAULT; compound union-of-rule-3 DEFAULT; compound-of-aggregate-arms NULLABLE; the 7 non-union before-op DEFAULT nested twins (low-value batch).

### Surface TEMP (F1-TEMP) — 18 T4 · temporal getters/Nullable

- **17 T4 — optional-const getters:** `optionalConst(d,'localDate').{getFullYear,getMonth,getDate,getDay}` (4); `optionalConst(t,'localTime').{getHours,getMinutes,getSeconds,getMilliseconds}` (4); `optionalConst(ts,'localDateTime').{getFullYear,getMonth,getDate,getDay,getHours,getMinutes,getSeconds,getMilliseconds,getTime}` (9). Identical SQL to the required-const twin, `?: number|undefined` leaves. 3 batch tests in const-temporal-getters.test.ts.
- **1 T4 — `customLocalDateTime.asOptional()` projected directly** (`tProjectRelease.publishedAt.asOptional()`) → `?: Date` (the required→optional overload never projected on its own).

### Surface SEL-SEAM (SEL-SEAM) — ~18 T4 · select/compound/recursive seam

C1 fix verified complete+sound across all 8 ops × 6 dialects. To-write (all output-coincident):
- **~7 T4 — AFTER-op `projectingOptionalValuesAsNullable()` on the 7 non-union ops** (unionAll/intersect/intersectAll/except/exceptAll/minus/minusAll); the grid pins AFTER-op only on union.
- **~7 T4 — C1 wrap on the 7 non-union ops** (rawFragment-embedding-value-source; wrap is op-independent).
- **~2 T4 — C1 reaching-forms:** rawFragment embedding a `valueArg`; rawFragment embedding multiple params (coordinator-confirmed wraps).
- **~2 T4 — `recursiveUnionAll(fn)` + projectingOptionals** (exec+inline).

### Surface INSERT (F4-INSERT) — ~17 + PARITY-1 · insert.ts

- **PARITY-1 · T1 (bug regression, GATED on the fix):** shaped `.shapedAs({k:'<defaulted-non-null col>'}).setIfValue({k:null,…})` → assert the column is omitted and takes its DB default (SQL/params snapshot + real-DB value). Not writable until the src fix lands; `// TODO[BUG]`.
- **8 T4 — disallow Error-instance overload** (4 methods × single+multi): `disallowIfSet/disallowIfNotSet/disallowIfNoValue/disallowAnyOtherSet` (`disallowIfValue` covered) — assert the `Error` instance is rethrown with `disallowedProperty` (+ `disallowedIndex` multi-row).
- **4 T4 — R43 empty-set no-op reaching forms:** literal `doUpdateSet({})`; bare `doUpdateDynamicSet()` unchained; top-level-bare on the without-target dialects (sqlite/mysql/mariadb); `keepOnly()`/`ignoreIfSet(all-cols)` emptying.
- **4 T4 (borderline as-any guard mirrors):** double `onConflictOnConstraint`; double do-update `where`; double partial-index `where`; double `doUpdateDynamicSet` — INTERNAL throws via `as any` (close OUT under a strict no-`as-any` reading).
- **1 T4 — `dynamicValues([])` empty-array** (marginal, output-coincident with `values([])`).

### Surface UPDDEL (F4-UPDDEL) — ~12 T4 · update/delete

- **~10 T4 — non-shaped Error-instance disallow overloads** (5 methods × their `*When` twins): the Error-instance overload is exercised only through the shaped interface; the non-shaped interfaces declare their own `disallowX(error: Error, …)` overload, untested (mock-only throw-before-SQL; near-degenerate).
- **2 T4 — one-column-many `undefined→null` per-element coercion:** `returningOneColumn(tIssue.body)` + `executeUpdateMany()`/`executeDeleteMany()` with `mockNext([undefined,'x'])` → `[null,'x']`. Value-realizing (the per-element null-coercion line is never hit).

### Surface MUT-SEAM (MUT-SEAM) — 9 · R43-fix composition tail

- **MUT-EMPTY-2 · T3 — from-select empty on-conflict → `do nothing`** (distinct builder path `OnConflictDoInsertFromSelect`).
- **MUT-EMPTY-3 · T3 — empty on-conflict + `returning` → `… do nothing returning …`** (coordinator-confirmed emission; the `_setSafeTableOrView` leak fix's sole manifestation; behavior change vs pre-fix). Two-sided guard: seeded conflict returns nothing vs fresh insert returns the id.
- **MUT-EMPTY-5 · T3 — bare no-target empty on MariaDB/MySQL/SQLite → `insert ignore`/`do nothing`** (canonical on a mariadb/mysql/sqlite cell; NOT-APPLICABLE on pg + a `types.negative` lock).
- **MUT-EMPTY-6 · T3 (characterization) — empty on-conflict + `where` → the update `where` is dropped** (`… do nothing` with no where; NOT a defect — `do nothing` has no WHERE slot).
- **MUT-EMPTY-1 · T4 — shaped-empty degrades** (exercises the shape branch of `_resolveInsertOnConflictUpdateSetColumns`).
- **MUT-EMPTY-4 · T4 — empty on-conflict + `customizeQuery` hooks.**
- **MUT-EMPTY-7 · T4 (4-way cluster) — alternate emptying reaching-overloads:** `keepOnly()` non-staged col; `ignoreIfSet(onlyStagedCol)`; `setIfValue({x:undefined})` sole set; `ignoreIfHasNoValue(onlyCol)`.
- **MUT-DV-1 · T4 — `defaultValues().returning({optional}).projectingOptionalValuesAsNullable()`.**
- **MUT-INS-NEST-1 · T4 — insert returning nested-object with the DEFAULT projector** (symmetric-sibling gap; update+delete have it, insert has only nullable).

### Surface F-RECENT (F-RECENT) — ~10 · fix positive-arm

- **T1 — executeInsertReturning + empty-set no-op** (`… do nothing returning <cols>`, correctly-prefixed columns) — the sole manifestation of the `_setSafeTableOrView` leak fix. pg + sqlite.
- **T1 — returningLastInsertedId + empty-set no-op** (`… do nothing returning id`) — also exercises the leak-restore. pg (+ sqlite if supported).
- **T1 — update-`where` DROPPED on empty set** (assert emitted SQL is `… do nothing` with NO `where`).
- **T2 — onConflictOnConstraint(name) + pruned empty** (`on conflict on constraint <name> do nothing`).
- **T2 — on-conflict-FROM-SELECT + pruned empty** (`insert into … select … do nothing`).
- **T2 — SHAPED update-set pruned empty** (exercises the shape branch of `_resolveInsertOnConflictUpdateSetColumns`).
- **T3 — value carries ONLY non-column properties → empty via `!column` skip** (needs a compile-repro first — the dynamic-set typing may reject extra props).
- **T4 — multiple nullable columns all pruned** (needs a 2nd nullable column on tProject else degenerate).
- **C-1 T2 — rawFragment embedding a scalar SUBQUERY** in a compound orderBy (wraps; **may un-block the mssql-1008 cell** — a subquery isn't a bare `@param`).
- **C-1 T3 — rawFragment embedding MULTIPLE params** (coordinator-confirmed `order by $1 + $2` wrap; may un-block mssql).
- **C-1 T4 — other 7 compound ops × the const-embedding rawFragment orderby** (per-op keyword, gated by per-dialect availability).

### Surface SELECT (F3-SELECT) — 7 T4 · select builder

- **T4-1/2/3 — compound `executeSelectOne` NO_RESULT throw; `executeSelectOne`/`executeSelectNoneOrOne` MORE_THAN_ONE_ROW throw** (shared runner, byte-identical to plain-select throws).
- **T4-4 — `subSelectUsing(t.forUseInLeftJoin())`/`subSelectDistinctUsing(...)` with a ForUseInLeftJoin arg** (the untried variadic arg-shape).
- **T4-5 — compound `executeSelectPage` extras `{data}`-only / `{count,data}` branches** (drives `CompoundSelectQueryBuilder.__buildSelectCount`).
- **T4-6 — one-column `.query()`/`.params()` accessors.**
- **T4-7 — plain row-shape `executeSelectNoneOrOne` PRESENT-object** (marginal).

### Surface CUSTOMNUM (F1-CUSTOMNUM) — 3 T4 · custom numeric (CustomInt saturated)

- **T4-1 — customDouble `add(number literal)` overload** (`billedAmount.add(2)` → `billed_amount + $1`, distinct typed overload from `add<VALUE>`).
- **T4-2 — customDouble adapter-through-arithmetic** (`tReleaseDraft.shiftedAmount.multiply(2)`, +1000 read-through — the customInt twin is covered).
- **T4-3 — optional customDouble receiver through a binary operator** (`tReleaseDraft.budget.multiply(2)` → `?: number`).

### Surface EXTRAS (F7-EXTRAS) — 2 T4 · extras/adapter/error/config

- **T4-1 — IDEncrypter unsigned-64-bit-range round-trip** (`enc.encrypt(18446744073709551615n)` → 16-char, `isValidEncryptedID` true, `decrypt` round-trips; + a prefixed variant) — the residual prior rounds missed (existing large-bigint test stops at ~2^53). No DB.
- **T4-2 — ForceTypeCast in INSERT-VALUES / UPDATE-SET position** (`insertInto(tProjectForcedCast).set({id,name})` → `values ($1::int4, $2::text)`; `update…set name = $1::text where id = $2::int4`) — output-coincident with the covered WHERE position.

### Surface TYPEVAR (F9-TYPEVAR) — 0 · result-type relationships

Saturated (see Part III OUT). Every optionality-combination / brand keep-erase / scalar-null edge is realized; the residue re-derives an already-realized result type + inhabitant on different columns (byte-identical type AND value; only the compile-time flag-origin differs) → genuinely compile-only, OUT.

---

## Part III — OUT (with reason; enumerated so R45 does not re-chase)

- **COL ~64 — `autogeneratedPrimaryKey`/`autogeneratedPrimaryKeyBySequence` for non-int/bigint kinds:** IDENTITY/SERIAL/sequence PKs are integer-only; no real-DB fixture realizes a uuid/date/boolean autogenerated PK → not real-validatable. (bigint autogen IS realizable → T4, not OUT.)
- **VALVIEW 12 — required-temporal / custom-temporal Values-tuple columns:** a Date does not round-trip through the per-dialect VALUES cast; the value-validatable form is optional+null (covered).
- **DYN — `INullableValueSource → NullableFilter` arm (unreachable):** every real column resolves to a more specific value-source interface before the bare `NullableFilter`; `IAggregatedArrayValueSource` operator cells (throw `UNKNOWN_OPERATION` / covered as no-op).
- **NUM — bigint typed-never** (`multiply/divide/power/logn/roundn/atan2/exp/ln/log10/sqrt/cbrt/trig`, the double overloads, `asInt/asDouble/asBigint`); the fractional-const-on-int LIMITATION (L-2).
- **CUSTOMNUM — customInt/customDouble typed-never method blocks** (compile-only `never`), `asOptional()` direct projection (byte-identical SQL+value), the `roundn(value:TYPE)` vs `roundn(value:number)` overload split (same SQL+value), redundant-type-branch adapter columns.
- **TEMP — custom-temporal CONST getters** (L-1); SQLite Unix-epoch const getters (already NOT-APPLICABLE in pg).
- **TYPEVAR — OUT-1/2/3:** `MergeOptional` combos re-deriving an already-realized result type; `requiredInOptionalObject` vs `originallyRequired` at a scalar top-level leaf (byte-identical; divergence manifests only inside a nested optional object — PROJ surface); "brand-is-erased" residual whose result coincides with the plain leaf.
- **F4-INSERT OUT** — `defaultValues().onConflict*` (typed-never; `CustomizableExecutableSimpleInsertOnConflict` has no `onConflict*` — also retracts **R43's MUT-A2a**, a name-collision misread); shaped `from(select)` (not typed); `returningLastInsertedId` on a no-autogen-PK table (typed-never); `returningLastInsertedId` NO_RESULT single-row (coerced to null first); the runner-layer adapter-transform happy arm.
- **EXTRAS ~45** — driver/runner-layer error reasons (`SQL_*`, `ONLY_ONE_COLUMN_EXPECTED`, `OUT_PARAMS_NOT_SUPPORTED`, `INVALID_MOCKED_VALUE`, transaction-level/access-mode, `UNSUPPORTED_DATABASE`, `FORBIDDEN_CONCURRENT_USAGE`); impossible-state (`TsSqlInternalErrorReason`×11, `UNKNOWN`, `UNKNOWN_DATA_TYPE` as-any-only); no-cell (`UNSUPPORTED_QUERY` needs compatibilityVersion<8M); non-exported type helpers; defensive `!obj`/falsy-`paths` as-any guards.
- **EQCMP — col-vs-col where a subquery operand tested the method(IValueSource) overload** is R-P7-degenerate at the overload level — but enumerated as T4 §V above because the col-operand emits distinct SQL (`colA op colB`).
- **Inert/cosmetic src:** N-1 (`update.ts:532`), N-2 (`Witout` typo).

---

## Part IV — Per-surface saturation table

| Surface | Confirmed bug | §B (genuine) | T1–T3 | T4 (output-coincident) | OUT |
|---|---|---|---|---|---|
| PARITY | **1** (setIfValue) | — | 1 gated regression | — | 2 inert (N-1/N-2) |
| F-RECENT (fix arm) | 0 (baked-in clean) | — | ~7 (T1/T2/T3) | ~3 | oracle/mssql A-1 NA |
| MUT-SEAM | 0 | — | 4 (T3) | 5 | MUT-A2a retracted; 1 mariadb LIMITATION-probe |
| F1-EQCMP | 0 | 0 | 0 | 329 | col-vs-col overload-degenerate (listed T4) |
| F6-DYN | 0 | 0 | 0 | ~500 | NullableFilter/agg-array |
| F1-STR | 0 | 0 | 0 | ~290 | 0 |
| F2-COL | 0 | **~129** | (§B are T1/T3) | ~250 | ~64 (autogen PK non-int) |
| F5-CONN | 0 | **~30** (sequence) | (§B are T3) | ~130 | min/max non-comparable; protected helpers |
| F2-VALVIEW | 0 | 0 | 0 | ~107 | 12 (required-temporal) + D-1 doc |
| F1-NUM | 0 | 0 | **3 (T3)** | ~115 | bigint typed-never; L-2 |
| F1-BOOLIF | 0 | 0 | **~26 (T2)** | ~14 | asOptional-bare (type-only) |
| F3-PROJ | 0 | 0 | 0 | ~24 | depth-6 never; tsc-fallback |
| F1-TEMP | 0 | 0 | 0 | 18 | 34 custom-const (L-1) |
| SEL-SEAM | 0 | 0 | 0 | ~18 | pure-text rawFragment; sqlserver-1008 NA |
| F4-INSERT | (PARITY-1 lives here) | 0 | 1 (bug regr.) | ~16 | 6 classes |
| F4-UPDDEL | 0 | 0 | 0 | ~12 | allowWhen (other surface); illegal-state |
| F3-SELECT | 0 | 0 | 0 | 7 | orderingSiblingsOnly (never) |
| F1-CUSTOMNUM | 0 | 0 | 0 | 3 | typed-never; asOptional-direct |
| F7-EXTRAS | 0 | 0 | **2 (T4, 1 genuine)** | — | ~45 driver/impossible |
| F9-TYPEVAR | 0 | 0 | 0 | 0 | 3 (compile-only) |
| **TOTAL** | **1** | **~160** | **~340 genuine core** | **≈ 2,090** | (enumerated) |

**Grand total writable ≈ 2,430 tests.** Genuinely-distinct (non-output-coincident) core ≈ **340** (§B + T1–T3). No surface returned "saturated with a long §C list" (the mis-file tell) — every tail is enumerated as writable T4 per the maximal dial, not silently closed.

---

## Part V — Coordinator verification notes

- **PARITY-1 (bug):** tsgo compile-repro CONFIRMED the divergence (non-shaped `setIfValue({verified:null})` compiles; shaped `setIfValue({v:null})` errors TS2322). Correctness obligation established (setIfValue must accept null to skip; shape only renames keys) + inverse guard checked (the fix is sound — null-skipped column stays in MISSING_KEYS). Corroborating dead branch verified (insert.ts:1116-1123). Filed to BUGS.md. Repro deleted; tree clean.
- **MUT-EMPTY-3 / SEL-C1-multiparam:** mock emission-probe CONFIRMED (`… do nothing returning id as id`; `select * from (…) as o_1_ order by $1 + $2`). Probe deleted; tree clean.
- **F-RECENT baked-in scan:** CLEAN across the 8 R43-backlog+fix files; block-swallowing gotcha verified (sqlserver C1/A1 blocks + numeric-promotion LIMITATION block isolated).
- **MariaDB `insert ignore … returning` (L-3):** flagged as a real-DB question to resolve at propagation time (not a bug); no `--docker` run this round (LIMITATION-classification, not a defect — the emission is confirmed, the engine acceptance is the propagation step's `--docker` check).
- **No cross-agent contradictions** requiring §7.1 adjudication. MUT-SEAM's retraction of R43's MUT-A2a (typed-never) was independently corroborated by F4-INSERT (OUT: not typed).

---

## Part VI — §B fixture-addition plan

All §B additions go on the shared `test/db/postgres/domain/connection.ts` (propagates to all 17 cells); none needs a schema/seed change beyond what is noted.

1. **COL §B (~129, headline)** — add inline-computed **virtual columns of each non-string/non-{customInt,enum} kind** to `tIssueWorklog` / `tProjectRelease` (Table) and `vReleaseOverview` (View), for both `virtualColumnFromFragment` (required) and `optionalVirtualColumnFromFragment` (optional). Examples: `boolFromId = this.virtualColumnFromFragment('boolean', f => f.sql\`${this.id} > 0\`)`, `bigintFromId = this.virtualColumnFromFragment('bigint', f => f.sql\`${this.id}\`)`, `uuidFromKey = this.virtualColumnFromFragment<string,'SigningKey'>('customUuid','SigningKey', f => f.sql\`…\`)`, + the `optional*` twins. No DB column (inline compute). Priority: bigint, boolean, uuid, localDate/Time/DateTime, + branded custom-temporal/uuid/comparable.
2. **CONN §B (~30)** — add a `this.sequence(name, kind[, typeName])` declaration per remaining kind (15 kinds × {plain, custom-typeName}) on `DBConnection`; mock-only, no DDL (sequences already run mock-only).
3. **INSERT/PARITY** — the PARITY-1 regression test needs a defaulted-non-nullable-in-shape column; `tOrganization.verified` / `tLedgerEntry.amount` already suffice (no new fixture).
4. All other surfaces (EQCMP, DYN, STR, VALVIEW, NUM, BOOLIF, PROJ, TEMP, SEL, MUT, EXTRAS) — **no new fixtures** (existing columns + inline Values views + `ctx.conn.const/optionalConst/rawFragment`).

---

## Part VII — Recommended implementation order

**Do the genuinely-distinct core first (~340 tests); the T4 tails are pure saturation and can be baked in bulk after.**

1. **Bug:** land the PARITY-1 src fix (one-token, `src/`), then its regression test (`// TODO[BUG]` until then).
2. **T1 / high-value seams (F-RECENT + MUT-SEAM, ~16):** the empty-on-conflict compositions — especially executeInsertReturning/returningLastInsertedId after empty-set (the `_setSafeTableOrView` leak), the update-where-dropped assertion, from-select/shaped/on-constraint pruned-empty, and MUT-EMPTY-3 (behavior-change lock); the C1 subquery/multi-param rawFragment orderby.
3. **§B genuine (COL ~129 + CONN ~30):** the virtual-column-kind fan-out (add fixtures) + the sequence value-type fan-out. Highest marginal coverage — distinct SQL + distinct marshalled type.
4. **T2/T3 distinct-emission (BOOLIF ~26, NUM 3, CUSTOMNUM 3, PROJ pockets 1-2 ~13, TEMP 18, EXTRAS 2, SELECT/UPDDEL/VALVIEW-U1-U4/U9):** the R43-BOOL-B1 residual (verified/published isNull, top), scalar-subquery numeric operand, aggregateAsArrayDistinct dropping rules, picking×aggregate, optional-const getters, IDEncrypter uint64.
5. **T4 output-coincident bulk (EQCMP 329, DYN ~500, STR ~290, COL ~250, CONN ~130, VALVIEW ~107, NUM ~115, SEL ~18, PROJ pocket-3, F3-SELECT 7, …):** the per-kind / per-operator / per-leaf / per-path fan-out. Bake in slices; each surface's report names every cell. Recommended within-T4 priority where a distinct dialect signal exists: STR's 21 `\[`-affix param cells + the `sqlserver/*` `[`-match cells; DYN's uuid/customUuid inherited-comparable probes; COL's bigint/boolean/uuid/temporal virtual leaves.
6. **Doc/negative cleanup:** D-1 (two stale with-values headers); the bigint-trig negative-lock top-up (types.negative/).

---

## Part VIII — Verdict

**Round 44 (maximal-saturation dial): 1 confirmed `src/` bug (PARITY-1, filed), 0 baked-in bugs, and an enumerated writable backlog of ≈ 2,430 tests** — the exhaustive work-list the round asked for, so the implementer can drive the typed surface to true saturation in one pass and future rounds surface only genuinely-new `src/` changes rather than re-discovering this tail.

The **genuinely-distinct core (~340 tests)** is where the coverage value concentrates: the PARITY-1 regression, the R43-fix composition tail (empty-on-conflict returning/where/from-select/shaped + C1 subquery/multi-param — the `_setSafeTableOrView` leak's untested manifestations), the **COL virtual-column-kind §B fan-out** (~129 distinct virtual-path leaf types) and the **CONN sequence value-type §B fan-out** (~30 distinct marshalled types), the **BOOLIF R43-BOOL-B1 residual** (the required-string custom-boolean `isNull`/`isNotNull` R43 left uncovered), the NUM scalar-subquery operand, and the PROJ aggregateAsArrayDistinct/picking pockets. The remaining **~2,090 T4** are the output-coincident per-kind/per-operator/per-leaf fan-out that R-P7 would close but the maximal dial enumerates — each a real, runnable, distinct-reaching test.

**Runbook: NO CHANGE.** PARITY-1 matches the existing theme-2 fingerprint ("shaped continuation drops SHAPE — over-restrictive, rejects a chain the runtime accepts"); the Timelessness discipline adds no fingerprint for a defect matching an existing one (git records the fix). The R43-fix (`1f970132`) is verified sound + complete on its tested paths. The pre-existing uncommitted R41 runbook additions remain untouched.
