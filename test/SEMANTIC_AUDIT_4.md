# Semantic audit — round 4

Per [`SEMANTIC_AUDIT_RUNBOOK.md`](./SEMANTIC_AUDIT_RUNBOOK.md). Transient — not kept in the repo.

**Why round 4**: rounds 1–3 + the collation audit swept the value-expression surface exhaustively and landed
their fixes (including the systemic numeric-precision commit `d76dee94`). This round is a **closing pass**:
**(A/B) an adversarial sweep of that just-committed precision/concat/replace code** (the runbook's *"probe the
interaction, not just the fix"*), and **(C) the drift lens over the surfaces the value-focused rounds never
reached** — DML/returning, sequences, pagination, typed fragments, JSON columns, dynamic conditions — to
answer the maintainer's question: *is anything still pending, or have we reached the target level?*

**Method**: three read-only discovery agents (numeric-precision machinery; Oracle-concat-rewrite +
replace/escape; closure sweep of the unswept surfaces) + the coordinator's own probing. Every candidate probed
against a real engine.

**Engines**: PostgreSQL 18.4 · Oracle 26ai (23.x) · MySQL 9.7.1 · MariaDB 12.3.2 · SQL Server 2025 · SQLite
(better-sqlite3). Container names/ports rotate — resolved at probe time.

**A note on what round 4 found**: every finding below is a **regression or a gap in the work rounds 1–3 were
already doing** — the round-3 precision reviver (F1, F2) and the round-3 Oracle-concat rewrite (F3). The round
opened **no new subject area**: the closure sweep over the previously-unswept surfaces (DML/returning,
sequences, pagination, typed fragments, JSON columns, dynamic conditions) came back clean, and every
round-3 fix that was adversarially re-probed held. This is the expected shape of a closing round at this
maturity.

## Decisions (maintainer-ruled)

| # | Item | Ruling |
|---|---|---|
| F1 | Unmapped `custom`-numeric aggregate leaf returns a string | **Not fixed — intentional seam.** Until the new type system lands, **mapping custom types is entirely the user's responsibility** (either on the `DBConnection` — the `baseTypeForCustom`-style override — or via a `TypeAdapter`). A custom type declared with neither is outside the contract; the library does not marshal it. No `src/` change. |
| F2 | `int` aggregate leaf tolerates a trailing `.0`; `bigint` / `stringInt` throw | **Fix — remove the asymmetry.** Add the processing so the `bigint` / `stringInt` string arms handle a trailing `.0+` the same way the `int` arm does (strip it before parsing), so the three integer arms behave uniformly. |
| F3 | Oracle concat walk descends into an ignored nested `concatIfValue` | Open for the maintainer — see the finding. Root cause + fix: treat an ignored `IfValueOrIgnore` concat node as a leaf. |

**Result**: **3 confirmed findings, all low-to-niche severity, none a headline silent-wrong-value** — plus a
solid block of refutations that confirm the round-3 fixes hold. **The verdict is: the target level is
essentially reached.** The reachable, typed value-expression surface is homogeneous and precision-safe; an
integer past 2^53 now fails **loudly** on every path instead of corrupting silently. The three residuals are
(1) a behaviour change the round-3 reviver introduced **inside the already-ruled custom-type seam** (unmapped
custom-numeric aggregate leaves now come back as strings), (2) a niche loud int/bigint asymmetry reachable only
through a user-typed fragment, and (3) a niche emission regression + pre-existing crash on a nested ignored
`concatIfValue` on Oracle. No `src/` was touched — analysis + rulings only.

---

## Findings, ranked by user impact

### F1. Unmapped `custom`-numeric aggregate leaves now return a **string** — a behaviour change the round-3 reviver introduced inside the custom-type seam

**Found by the numeric-precision agent; confirmed by a real-PostgreSQL probe.**

**The promise**: `column<T>(name, 'customInt', 'Cents')` declares the value type `T` — a branded **number**
(`Cents = number & brand`). A scalar projection of that column returns a number; an aggregate of it should too.

**The request** — the round-3 fix's `parseJsonPreservingNumbers` reviver
(`AbstractQueryBuilder.ts`) turns **every** JSON number into its raw `context.source` **string**, and the
result marshaller (`AbstractConnection.transformValueFromDB`, switch at `:1157`) has **no case** for
`customInt`/`customDouble`/`custom`/`customComparable`/`enum` — they all hit `default: return value`. So a
custom-numeric aggregate leaf, which the engine emits as a bare JSON number, now reaches `default` as a
**string** and is handed back verbatim. Before the fix, `JSON.parse` decoded it to a **number**.

**The engine transcript** — a plain `PostgreSqlConnection` (no `baseTypeForCustom` override, no adapter), a
`customInt`-typed column over `int`, real PostgreSQL:

```
column: amount int, declared customInt 'Cents'; rows 123, 456
  aggregateAsArrayOfOneColumn(amount)  ->  ["123","456"]   typeof = string   <- was number 123 pre-fix
  scalar select amount                 ->  [123, 456]      typeof = number
```

The **same column** yields `number` as a scalar and `string` in an aggregate — an internal inconsistency the
fix introduced. It is a **regression for small values** (number → string) and, conversely, an **improvement for
big values** (a `custom` over a `bigint` base used to round to a wrong number; it now returns the exact string).
The `d76dee94` changelog's claim *"`customInt`/`customDouble` leaves round-trip exactly"* is true only for the
**mapped** case.

**Blast radius**: all six dialects (the marshaller is dialect-agnostic; every native-JSON path emits the custom
leaf as a bare number). Only affects a `custom` type over a **numeric** base with **no adapter and no
`baseTypeForCustom`-style connection override**. **Why the suite can't see it**: every `domain/connection.ts`
re-maps every custom type to a base via `baseTypeForCustom`, so the marshaller's `default` arm is never reached
with a numeric aggregate leaf — the coverage hole is structural.

**Verdict: DESIGN FORK (behaviour change in the ruled custom-type seam).** Round 3 ruled the unmapped-custom
pass-through an intentional, documented seam; round 4's new fact is that the precision fix **changed what that
seam produces (number → string)** and made the aggregate path disagree with the scalar path. Options for the
maintainer: (a) document that unmapped numeric customs yield strings in aggregates (the digits are exact); (b)
route `customInt`/`customDouble` through their base type in the marshaller so they re-convert like the native
types (needs the base-type mapping the library doesn't generically hold — the same reason the seam exists); or
(c) accept it as the seam and correct the changelog's "round-trip exactly" wording. Lowest-risk is (a)+(c).

### F2. `int` aggregate leaves tolerate a trailing `.0`; `bigint` / `stringInt` leaves throw on it — a loud asymmetry, reachable only through a typed fragment

**The promise**: an aggregate leaf declared `int`, `bigint` or `stringInt` should marshal the same integer
value the same way.

**The request** — the round-3 fix widened the `int` string arm to accept `^-?\d+(\.0+)?$`
(`AbstractConnection.ts:1197`) because a numeric leaf with SQLite **REAL affinity** serialises as `3.0` in a
JSON aggregate. The `stringInt` arm (`:1228`, still `^-?\d+$`) and the `bigint` arm (`:1260`, `BigInt(value)`)
were **not** widened, and `BigInt('4.0')` throws.

**The engine transcript**:

```
SQLite  round(3.7)                          -> 4.0   (REAL; json_group_array -> [4.0])
node    BigInt('4.0')                        -> SyntaxError (throws)
so a bigint/stringInt leaf rendered '4.0'   -> INVALID_VALUE_RECEIVED_FROM_DATABASE   (int leaf: fine -> 4)
```

**Reachability is the mitigating fact** — the library's own bigint-producing ops don't render `.0`:
`asBigint()` emits `cast(round(x) as integer)` (INTEGER affinity → `[N]`, probed), and a `bigint` column is
INTEGER affinity. The only way to get a `.0`-rendered `bigint`/`stringInt` leaf is a **user-typed rawFragment**
declaring `bigint` over a REAL SQLite expression, then aggregating it — the fragment seam (user-owned type),
niche. And the failure is **loud** (a throw), not a silent value.

**Blast radius**: SQLite (the only engine with REAL-affinity `.0` rendering), fragment-declared bigint only.
**Why the suite can't see it**: no test aggregates a fragment-typed `.0`-rendering bigint.

**Verdict: DEFECT (loud, low severity, near-unreachable).** A minor consistency gap — the `stringInt`/`bigint`
string arms should strip a trailing `.0+` before parsing, symmetric to the `int` arm. Not worth a fixture; a
3-line marshaller change if the maintainer wants the arms uniform.

### F3. Oracle's concat rewrite descends into an **ignored** nested `concatIfValue`, emitting a dead param (and re-exposing a pre-existing crash)

**Found by the concat-rewrite agent; confirmed by a library emission probe.**

**The promise**: `x.concatIfValue(v)` with an **absent** `v` (`null` / `undefined` / `''` under
`allowEmptyString:false`) is a no-op — it renders as just `x`.

**The request** — the round-3 Oracle concat rewrite replaced the old `__toSql`-based value rendering (which
honoured `IfValueOrIgnore` by short-circuiting to the receiver) with a **structural walk**
(`OracleSqlBuilder._appendConcatNullCheck:198`, `_concatChainSql:233`) that descends whenever
`operationOf(node) === '_concat'`. A `concatIfValue` node carries `__operation === '_concat'` **even when its
value is ignored**, so both walks process its dead operand — but only when the `concatIfValue` is nested under
a further `.concat()` (the outermost case is still resolved by `__toSql` before Oracle's `_concat` runs).

**The engine transcript** (library emission, Oracle default config):

```
title.concatIfValue('').concat(body)         ->  case when "body" is null then null
                                                 else title || :0 || "body" end        (:0 bound to '')
   -- old / other dialects:  title || "body"  (no param; the ignored '' is dropped)
title.concatIfValue(undefined).concat(title) ->  THREW: Cannot read properties of undefined (reading '__toSql')
```

The `''` case emits a **dead `:0` param** every other dialect omits — a real emission divergence. It is **not a
silent wrong value on Oracle** (`''` → NULL → a `||` no-op, so the value equals the correct `title || body`),
but it is a latent trap (any future change making the walk's dead-operand handling value-affecting turns it into
a wrong value). The `undefined` case **crashes** with a `TypeError` on a type-checkable query — but that crash
is **pre-existing** (the old `collect()` also fed `undefined` to `_isNull`), so the rewrite re-exposed it rather
than introducing it.

**Blast radius**: Oracle only (the only dialect that walks the concat tree structurally). **Why the suite can't
see it**: the one Oracle `concatIfValue` test uses it as the **outermost** node, never nested under a further
`.concat()`.

**Verdict: DEFECT (emission regression + pre-existing crash), low severity.** Root cause + fix: the structural
walk must treat a `_concat` node whose `IfValueOrIgnore` value is **absent** as a **leaf** (render via
`__toSql`, or guard with `_isValue` before descending) — which removes both the dead param and the crash.

---

## Refutations — results, so round 5 doesn't re-derive them

**The round-3 precision/concat/replace fixes, adversarially checked and cleared:**

- **SQL Server ≥17M native `json_arrayagg` bigint round-trip — REFUTED (the fix works there).** The suspicion
  was that SQL Server 2025's native `json` type might arrive pre-parsed via tedious, leaving finding A unfixed
  on the default path. The `aggregate-of-bigint-column-as-array` test (native `json_arrayagg`, default ≥17M,
  asserting `9007199254740993n`) is **not** real-DB-guarded and **passed against real SQL Server 2025** in the
  coordinator's `--docker` run — so tedious hands the aggregate back parseably and the reviver recovers the
  exact bigint.
- **MySQL / MariaDB `cast(json_arrayagg(<bigint>) as char)` fidelity — REFUTED.** Exact digits within int64
  (`[9007199254740993]`, `[123456789012345678]`), so the finalize-to-text cast preserves precision.
- **MariaDB `_escapeRegexpReplacement` completeness — REFUTED (the fix is correct).** MariaDB's PCRE2
  `REGEXP_REPLACE` does **not** interpret `$` in the replacement (`regexp_replace('Xmas','mas','a$0b')` → literal
  `Xa$0b`; only `\1` is a backreference), while MySQL's ICU **does** (`a$0b` → `Xamasb`). So escaping only `\`
  on MariaDB and `\`+`$` on MySQL is exactly right — the round-3 replacement-escape is complete across all three
  regex engines.
- **Oracle `_concatChainSql` type threading + C1 fix — SOUND.** The right operand is appended with the LEFT
  operand's value type, identical to the operation node's `__toSql` and the base `_concat`. Verified for
  mixed-type, both-sides-nested, and `valueWhenNull(concat)` shapes. **Round-3 C1 (shared-receiver leak) is
  genuinely fixed** — the `Set` is gone; a `valueWhenNull`-wrapped inner concat is a leaf that keeps its own
  `CASE`. Param binding stays aligned (no dedup; null-check params precede value-part params).
- **C2 parenthesis completeness — SOUND.** `_replaceAll`/`_replaceAllInsensitive` registered in
  `_operationsThatNeedParenthesis` on SQL Server + Oracle cover every embedding site
  (`replaceAll().replaceAll()`, `.collate().replaceAll()`, `replaceAllInsensitive().replaceAll()`, comparison /
  concat operands) — one parenthesised collate per level, validated live under `--docker` (the collation tests
  pass on real Oracle + SQL Server). Over-parenthesisation of an ignored `replaceAllIfValue` / a bare opt-out
  `replace()` is harmless (valid SQL). Fragments are exempt by design (raw user SQL).
- **localDate time-strip (finding D) — SOUND.** Strips at the first `T`, else space, else uses the value as-is;
  fixes the Oracle `"2024-01-15T00:00:00"` throw, keeps the wall-clock date for an offset form, and leaves a
  bare date untouched.
- **Nested aggregates — REFUTED (survive).** Only the outermost aggregate is finalised to text, but that casts
  the **whole** document (including nested arrays) to text on PG/MySQL/MariaDB, and the reviver fires at every
  depth — so a nested bigint leaf survives just like a top-level one.
- **`context.source` runtime availability — CLEARED.** Present on Node 26 and Bun 1.3.14 (both return the raw
  string); the feature shipped in V8 12.4 = Node 22, so every supported runtime has it. The rounding fallback is
  unreachable on a supported runtime.

**The closure-sweep surfaces — CLEAN (target reached):**

- **DML returning / `returningLastInsertedId` / `oldValues` / onConflict returning — CLEAN.** Every returned
  value routes through the one guarded `transformValueFromDB` (`defaultTypeAdapter = this`); SQL Server emits
  `output inserted.<idColumn>` (the column value, not `scope_identity()`'s `numeric`). A bigint id past 2^53
  that arrives rounded → **loud `PRECISION_LOST` throw**, not a silent value.
- **Sequences — CLEAN.** `nextValue`/`currentValue` carry the user-declared type through the guarded marshaller.
- **Pagination — CLEAN; the prior finding is FIXED.** `__dropPaginationForCount` now drops `__limit`,
  `__offset`, `__orderBy` **and** the order-by customization hooks; the count is `int` through the guarded arm.
  (Observation, loud not silent: SQL Server `count(*)` returns `int` and errors past 2^31 rows — no
  `count_big(*)`; at most a `LIMITATIONS.md` note.)
- **Typed fragments — out of the family.** The user declares both the type and the SQL — no independent library
  promise to break; a mistyped integer fragment still can't corrupt silently (the guarded int arm throws).
- **JSON columns — no such surface.** The `ValueType` union has no `json` member; `parseJsonPreservingNumbers`
  is used only by the aggregate transform. Nothing to sweep.
- **`dynamicCondition` — CLEAN.** Produces only a `BooleanValueSource` (WHERE/HAVING); never a projection
  column, so it can't alter any result column's marshalled type.
- **The integer marshaller is now uniformly guarded** — the round-3 fix means an integer past 2^53 fails loudly
  on every read path (scalar, aggregate, returning, sequence, count) instead of coercing to a clean wrong value.
  The custom-type raw-passthrough seam extends here too (a `customInt` id past 2^53 via better-sqlite3 without
  `safeIntegers` returns a rounded raw number) — but that is the same ruled seam, related to F1.

---

## Coverage holes this round exposes

1. **No aggregate test uses an UNMAPPED custom-numeric leaf** (every domain re-maps via `baseTypeForCustom`) —
   blocks F1. A lock needs a `customInt`/`customDouble` column with no adapter and no re-mapping.
2. **No aggregate test uses a fragment-typed `.0`-rendering `bigint`/`stringInt` leaf** — blocks F2.
3. **No Oracle test nests an ignored `concatIfValue` under a further `.concat()`** — blocks F3
   (`x.concatIfValue('').concat(nullableCol)` and `x.concatIfValue(undefined).concat(y)`).

## Verdict — have we reached the target?

**Yes, for the reachable typed value-expression surface.** Four rounds + the collation audit have driven the
family this method hunts — *the declared promise vs the emitted request, silently disagreeing* — out of the
value-expression, aggregate, collation, boolean, numeric, temporal and DML/returning surfaces. What round 4
surfaces is not a new silent-wrong-value class but three edges: **F1**, a behaviour choice inside the documented
custom-type seam (exact strings vs numbers in aggregates); **F2**, a near-unreachable loud asymmetry; **F3**, a
niche loud/cosmetic concat regression. All three are the maintainer's call, none corrupts a value on a query a
user following the documented contract (declare custom types with an adapter/mapping; don't type a fragment
against a mismatched SQL) would write. The precision commit's core is sound and validated on real engines, and
the integer-read path now fails loudly rather than silently everywhere. **Round 5 would be into diminishing
returns** — the remaining surface is the intentional-seam boundary, not the defect family.
