# Tests Audit

The **mechanical anti-cheat enforcement** for the `test/` matrix — the tool
behind `bun run tests:audit`. It walks `test/db/` statically (no docker, no
WASM, no DB) and **fails** (exit 1) when a test has been weakened to pass
dishonestly, or when its structure diverges from the symmetry rule.

> **Just using the tool?** Read [`../../TESTS_AUDIT.md`](../../TESTS_AUDIT.md) —
> the agent-facing guide: how to run it, what a finding means, how to fix or
> suppress one, and how to propose a new valid pattern. This file (AUDIT.md) is
> the **anchoring design/requirements doc** — the threat model, the rules, the
> suppression mechanism, the engine, and how to extend it. It is the source of
> truth for *why the tool is shaped this way*; the per-rule normative rules live
> in [`../../DESIGN.md`](../../DESIGN.md), and which rules are live today under
> each entry's **"Gate today"** line in [`../../ANTIPATTERNS.md`](../../ANTIPATTERNS.md).

This folder gives the audit its own entity, the same way
[`../codeIndexer/`](../codeIndexer/CODE_INDEXER.md) and
[`../codeSearcher/`](../codeSearcher/CODE_SEARCHER.md) own the index and the
searcher: the design doc (this file) is the anchor, the code lives beside it.

- [Mission — the threat model](#mission)
- [The architectural constraint](#the-architectural-constraint)
- [Boundary — what the audit is NOT](#boundary)
- [Relationship to the canonical-cell quality gate](#relationship-to-the-quality-gate)
- [Architecture](#architecture)
- [The rules](#the-rules)
- [Folder layout](#folder-layout)
- [Maintenance contract](#maintenance-contract)
- [How to add a rule](#how-to-add-a-rule)
- [Status & roadmap](#status--roadmap)

## Mission

The audit protects the suite from **an agent that cheats to turn a test
green**. Under pressure to make a cell pass, an agent can:

- guard the value assertion behind `ctx.realDbEnabled` so only the mock ever
  validates it — the real database asserts nothing, or only `rows.length`;
- pass a literal a mock swallows but a real engine would reject (a malformed
  UUID in a `uuid`-typed parameter);
- reach for `as any` to silence the typer so a test that *should not compile*
  does.

If `tests:audit` passes with no errors, the suite is free of those cheats.
Test integrity stops depending on the agent remembering the guidance in
[`DESIGN.md`](../../DESIGN.md) / [`ANTIPATTERNS.md`](../../ANTIPATTERNS.md)
and starts depending on the audit.

This is the documented, recurring pain of the suite, not a hypothetical:
[`COVERAGE_RUNBOOK.md`](../../COVERAGE_RUNBOOK.md) names the exact failures
shipped in prior rounds — *"weaknesses like `expect(rows.length).toBeGreaterThan(0)`"*
and *"`as any` to make TS accept an overload-rejection"*. The audit
mechanises the gate for each.

## The architectural constraint

The audit **fails on content** (exit 1) — it does not merely inform. That is
the line between it and the [searcher](../codeSearcher/CODE_SEARCHER.md),
which never fails on content.

The **severity ramp is complete**: every rule is now `error` (a finding of any
rule exits 1). A new content rule may still land as `warn` (reported, exit 0)
and be promoted to `error` once the tree is clean for it (see
[Severity model](#severity-model)) — that warning phase is informative *with a
committed promotion plan*, not a permanent state — but there is no such rule
today. The **symmetry check is `error` too**: it was widened from a per-database
check to a **whole-matrix** one (every cell of every database must match, per
[DESIGN §4](../../DESIGN.md#symmetry-rule)), which surfaced a cross-database
backlog (files/tests not yet mirrored to every cell); that backlog has been
worked down and the matrix is clean, so it is back to `error`.

## Boundary

The audit is anti-cheat enforcement and nothing else.

| Out of scope | Why | Who owns it |
|---|---|---|
| Database / connector **limitation management** (wrapping `new Date` for Bun#29010, etc.) | That is *handling* a limitation, not catching a cheat | [`EXTERNAL_CAVEATS.md`](../../EXTERNAL_CAVEATS.md) + the propagation step |
| Cross-referencing `// TODO[BUG]` / `// TODO[LIMITATION]` against `BUGS.md` / `LIMITATIONS.md` | The **searcher already does this** (`tests:where-is --bugs / --limitation / --cell-caveats`); duplicating it crosses that tool's boundary. Also has no anchor on the bug side today (`BUGS.md` = *"No open bugs"*, zero `TODO[BUG]` markers) | [searcher](../../CODE_SEARCH.md) |
| Does a symbol exist in `src/`? | The searcher's `Classification` answers it | [searcher](../../CODE_SEARCH.md) |
| Subjective judgement ("is this assertion *good enough*?") | Requires reading and opining — not mechanical | the [quality-gate sub-agent](../../QUALITY_GATE.md) |
| "Is this value valid for this type?" in general / assignability | The unbounded semantic question the searcher explicitly walled off (CASE_STUDIES H.2, J–L): the index *locates* types, the compiler *decides* validity. The `uuid-literal` rule stays narrow because of this | the compiler / a future type-coverage tool |
| Coverage %, performance, security, running tests, TS errors | Other flows; `validate:tests` covers TS | coverage flow / `validate:tests` |

## Relationship to the quality gate

[`QUALITY_GATE.md`](../../QUALITY_GATE.md) runs a sub-agent over the **canonical
cell only, before propagation**, and explicitly *"doesn't catch
post-propagation regressions"*. The audit's unique value is the **mechanical
sweep over the whole tree, after propagation** — exactly the surface the
canonical-only gate cannot reach.

This is why the content rules run over **every cell**, not just the canonical:
an agent can weaken the real-DB branch in a single sibling cell
(`mariadb/oldest`) to make it pass, and neither the symmetry check nor a
canonical-only review would see it.

The two are complementary, and the handoff is already specified in
QUALITY_GATE.md: *"as each mechanical gate lands, the sub-agent prompt can
drop the matching check."* See [Maintenance contract](#maintenance-contract).

## Architecture

### Engine

The TypeScript compiler API is the motor.

- **Syntactic rules** — all current content rules (`mock-only`, `mirror-image`,
  `one-sided-guard`, `uuid-literal`, `as-any`, `any-type`, `as-unknown-as`,
  `meaningless-cast`, `meaningless-type`, `type-cast`, `non-public-api`,
  `commented-test-reason`, `grouped-commented-tests`, `focused-test`, `empty-snapshot`, `ts-ignore`,
  `ts-expect-error`, `eslint-disable-type`, `eslint-disable-other`,
  `skipped-test-reason`, `skip-real-db`, `misplaced-marker`, `tautology`,
  `no-assertion-runtime`, `empty-catch`, `weak-boolean`, `weak-matcher`,
  `close-to`, `no-op-expect`, `non-deterministic-input`) need only
  `ts.SourceFile` ASTs (or the TS scanner),
  no type checker, so they stay fast over the full ~2.5k-file matrix (~1 s).
  Even `uuid-literal` (anchored on the string's *shape*, not its static type)
  and `as-any` (which tolerates named patterns rather than resolving intent)
  avoid the checker.
- **Type-aware rules** would need a `ts.Program` + checker (the slow lane,
  ~tens of seconds). None exist today — a future rule that genuinely needs a
  literal's static type would be separated by *cost of analysis*, not a
  `--quick`/`--deep` split, and would measure/report its wall time.

The classic `typescript` package (not tsgo — no programmatic API yet), same
choice the [indexer](../codeIndexer/CODE_INDEXER.md) made.

**Exclusions** mirror the symmetry check: skip `domain/` and
`types.negative/` dirs, the `documentation` connector, the `general` db, and
`*.generated.test.ts` (emitted, not authored — exempt from EVERY check, even
symmetry). If an AST parse fails on a file, **skip it with a warning — do not
abort the whole audit**. The **one exception** is `ts-ignore`: a `@ts-ignore` is
forbidden *everywhere* in the tests, so that single rule additionally scans the
`types.negative/` cells (see [`walk.ts`](walk.ts) § `typesNegativeTestFiles`) —
no other rule runs there.

### Severity model

A declarative table in [`rules.ts`](rules.ts):

```ts
export const RULE_SEVERITY = {
  'symmetry':               'error',  // structural — whole-matrix cell parity; back to error now the cross-db backlog is cleared and the matrix is clean
  'mock-only':              'error',  // most severe: the test never validates against the real engine
  'mirror-image':           'error',  // anti-cheat
  'one-sided-guard':        'error',  // anti-cheat — DESIGN §1
  'uuid-literal':           'error',  // a malformed-UUID literal mock accepts but a real engine rejects
  'as-any':                 'error',  // a cast to `any` bypassing the public typed API
  'any-type':               'error',  // an `any` type annotation (use a precise type or `unknown`)
  'as-unknown-as':          'error',  // `x as unknown as T` — the double-assertion laundering that replaces `as any`
  'meaningless-cast':       'error',  // a cast to `unknown` / `null` / `never` / `void` — a pointless type-checker bypass
  'meaningless-type':       'error',  // the `unknown` / `null` / `never` / `void` type annotation (mirror of any-type)
  'type-cast':              'error',  // any other `x as T` / `<T>x` assertion — may force the type or want `satisfies` (as const + cast carve-outs exempt)
  'non-public-api':         'error',  // a relative import into non-public src or non-admitted test/lib
  'commented-test-reason':  'error',  // a commented-out test with no TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE reason
  'focused-test':           'error',  // a committed `.only` — silently skips the rest of the suite
  'empty-snapshot':         'error',  // an un-baked `toMatchInlineSnapshot()` in live code (commented placeholders are AST-exempt)
  'ts-ignore':              'error',  // `@ts-ignore` / `@ts-nocheck` — silences every error on the line; forbidden everywhere
  'ts-expect-error':        'error',  // `@ts-expect-error` outside a types.negative cell — a type-error bypass
  'eslint-disable-type':    'error',  // eslint-disable of a type-soundness lint — the lint twin of as-any/any-type
  'eslint-disable-other':   'error',  // eslint-disable of any other (non-type) lint — tracked separately
  'skipped-test-reason':    'error',  // `test.skip` / `test.todo` with no TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE reason — the .skip twin of commented-test-reason
  'skip-real-db':           'error',  // `test.skipIf(realDbEnabled)` — a mock-only evasion at the registration level
  'misplaced-marker':       'error',  // a TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE marker not at a test
  'tautology':              'error',  // a provably-constant assertion (literal-self-compare, same-expression, `.length` ≥ 0)
  'no-assertion-runtime':   'error',  // a test that runs a query (execute*) but asserts nothing — always green
  'empty-catch':            'error',  // an empty `catch { }` with no deliberate throw in the try — swallows a real failure
  'weak-boolean':           'error',  // `expect(x).toBeTruthy()` / `toBeFalsy()` — pins truthiness, not the value
  'weak-matcher':           'error',  // asymmetric matcher / `.toContain`/`.toMatch` on a value — approximate reserved for a diagnostic blob (error/stack) only
  'close-to':               'error',  // `toBeCloseTo` outside a real-DB branch — its own (lenient) rule, separate from the rigid weak-matcher
  'no-op-expect':           'error',  // an `expect(...)` chain with no matcher invoked — a no-op that always passes
  'non-deterministic-input': 'error', // `new Date()` / `Date.now()` / `Math.random()` as a query input (mock data carved out)
  // meta-rules that protect the suppression mechanism — `error` from day 1:
  'disable-without-reason': 'error',
  'unknown-rule':           'error',
  'unused-ignore':          'error',  // a stale `tests-audit-disable` that matches no finding
}
```
(Every rule is `error` today — the warn→error ramp is complete, the tree is clean for every rule. The split into one rule per suppression **mechanism** is still deliberate: it lets a NEW rule be landed at `warn` and **promoted to `error` independently** of the rest.)

- Exit 1 **iff** there is ≥1 finding of severity `error`. `symmetry` is folded
  into the same Findings pipeline (rule id `symmetry`), so its severity is read
  from this table like any other rule — it is now `error`, so a divergence
  blocks.
- Promoting a (future) rule from `warn` is a one-line `'warn'` → `'error'` edit,
  recorded in the commit + changelog.
- `--strict` raises every `warn` to `error` (to trial a promotion before
  committing it) — a no-op while every rule is already `error`. `--only
  <rule-id>` runs a single rule. `--explain` adds the violated rule + a fix
  hint. The audit stays invocable with **no arguments** for CI.

### The `tests-audit-disable` suppression comment

Linter-style (Biome's mandatory-reason convention), the inline allowlist
anchored **in the code** — it travels with the test and shows up in the diff,
so a cheat leaves a visible trail a reviewer sees.

Grammar — on the line immediately above the flagged node:

```ts
// tests-audit-disable-next-line mirror-image -- engine-autogenerated id; see
// EXTERNAL_CAVEATS § "Could test more if real DB were on"
if (!ctx.realDbEnabled) expect(id).toBe(1)
```

`// tests-audit-disable-next-line <rule-id> -- <non-empty reason>` (the eslint/oxlint syntax; `tests-audit-disable-line` for a trailing comment). The reason should cite
the documenting section ([`EXTERNAL_CAVEATS.md`](../../EXTERNAL_CAVEATS.md)
hosts the finite legitimate-guard set) where one applies; the format is free,
the **reason is mandatory**.

The **meta-rules were `error` from day 1**, before the real rules were
promoted, because they guard the suppression mechanism itself — the cheat
vector is silencing the rule quietly:

- `tests-audit-disable-next-line mirror-image` with no `-- reason` → **error**
  (`disable-without-reason`). You cannot silence without justifying.
- `tests-audit-disable-next-line <unknown-rule>` → **error** (`unknown-rule`). You cannot
  pre-disable by mistyping an id.
- a `tests-audit-disable` that matches no violation (stale) → **error**
  (`unused-ignore`) — stops dead suppressions accumulating.

Anchor suppressions by content (rule-id + reason in code), **never** by
`file:line` in an external file — the canonical cells shift lines on every
snapshot bake.

### Output

**eslint/oxlint-style** ("stylish"): findings grouped by file (a path header,
then `<line>  <severity>  <message>  <rule>` rows, severity coloured on a TTY,
`--explain` adds a `└─ <hint>` line), a per-rule tally, and an `✖ N problems`
summary. Report **all** violations, then fail (never bail on the first):

```
test/db/postgres/newest/pg/select.distinct.test.ts
  30  error    real-DB branch only asserts rows.length; value never validated against an engine  mirror-image

test/db/.../foo.test.ts
  12  error    tests-audit-disable needs a reason after '--'  disable-without-reason

rules: mirror-image 1  disable-without-reason 1
✖ 2 problems (2 errors, 0 warnings)
```

(The `warning` severity still renders — yellow on a TTY — for a rule kept in its
`warn` phase; there is none today.) A large warning backlog is capped (the
first N) unless `--all`. Colour follows
`NO_COLOR` / TTY. `symmetry` findings flow through this same report (grouped by
the offending cell file). The symmetry check still emits its
`$GITHUB_STEP_SUMMARY` line, but only the **count/verdict** — the per-divergence
breakdown is the stdout report's job, not duplicated in the summary. English
output.

### Scope (positional coords)

`bun run tests:audit [<coord>…]` scopes the run, same grammar as the `tests`
CLI ([`CLI.md` § Coord patterns](../../CLI.md#coord-patterns)):
`<db>[/<version>[/<connector>[/<file>]]]` with `*` globs and `{a,b}` braces,
several coords unioned. No coord → the whole matrix. A coord matching nothing
is an error (exit 2).

Coords filter the content-check file set. The symmetry check is a **whole-matrix
invariant**, so it always runs over every cell (a subset cannot establish the
cross-cell canon); when coords are given, only the symmetry findings whose file
falls inside the scope are *reported* (the canon is still computed from the full
matrix). The matcher is the **shared**
[`test/lib/coords.ts`](../coords.ts) — the same one the searcher's `--coord`
uses (`coordMatch` / `cellFromPath`), extracted there so both tools agree on
coordinate semantics. Scoping is the practical way to triage any future
backlog (e.g. a newly-landed `warn` rule) one cell or canonical at a time, e.g.
`bun run tests:audit postgres/newest/pg --only mirror-image --all --explain`.

## The rules

Each rule is anchored to **real evidence in the repo today**. The discipline
(from the searcher's [CASE_STUDIES.md](../codeSearcher/CASE_STUDIES.md)):
*build the case, verify against the tree, let the verification decide.* If a
rule has no anchor and its cost isn't justified, say so and defer — don't ship
enforcement for something that has never happened.

The three rules below are produced by [`checks/mirrorImage.ts`](./checks/mirrorImage.ts)
(one syntactic-AST pass) and enforce the same principle — *the suite's purpose
is real-DB validation; a test that doesn't actually validate against the real
engine "sneaks past" us* (DESIGN § Real-DB validation, §1). They are **separate
rule ids** ordered by severity, so each is suppressed independently (and was
promoted to `error` independently during the warn→error ramp, now complete).

**The bar is deliberately high: NOT going to the real DB is almost never
legitimate.** "It can only be tested with the mock" is usually false — the lib
exposes `fragmentWithType` / `rawFragment` to emit a typed expression carrying
arbitrary SQL, so you can make the real engine return any off-shape value (a
text literal typed `int`, etc.) and drive the branch on a real connector; float
precision uses `toBeCloseTo`. So a `tests-audit-disable` is **rare**, reserved
for the genuinely irreducible (a driver-specific error the generic mock can't
model, an autogenerated id whose exact value can't be predicted) — and even
those normally still *execute* against the real engine.

A branch **counts as validating the value** when it uses deep equality
(`toEqual` / `toStrictEqual` / `toMatchObject` / `toContainEqual`), a scalar
value matcher (`toBe` / `toHaveProperty` on the value, not its shape), or an
**approximate comparison** (`toBeCloseTo`, `toMatch`). "Weak" means shape-only
(`.length`, `toBeGreaterThan*`, `Array.isArray`, `typeof`, `toBeDefined`, …).
Two documented remedies therefore validate and are not weakenings:

- **JS-reorder** (DESIGN § Mirror-image form #2) — `expect(rows.map(r => r.id).sort()).toEqual([1, 2])`:
  deep equality on sorted data.
- **Approximate comparison** — `else expect(x).toBeCloseTo(approx)` for float
  precision / `toMatch` for content the exact mock can't pin.

### `mock-only` — the test never validates against the real engine (most severe)

The worst form, and the one that "sneaks past": the query never runs (or its
outcome is discarded) on a real DB, so a real failure passes as green. Two
shapes:

- **mock-only skip** — `if (ctx.realDbEnabled) return` before a test body that
  asserts something. The whole test runs only under the mock.
- **swallow** — a `catch` whose only effect is `if (!ctx.realDbEnabled) throw e`:
  it rethrows under the mock but discards the error on the real DB, so the real
  run can't fail.

**Exception-validation carve-out** (skip form only, built in to the rule). A
mock-only-skip test whose purpose is to pin that **the library throws** — not to
validate a result value — is **not flagged**: forcing the throw on a real engine
adds nothing the mock doesn't already prove. Recognised iff the skipped body has
≥1 exception-validation assertion and **no** non-exception value/deep assertion
(a value assertion still belongs on the real engine). An assertion validates an
exception when it (A) uses a `toThrow`/`toThrowError` matcher or a `.rejects`
chain, (B) targets a variable derived from a `catch` binding
(`catch (e) { caught = e }` … `expect(String(caught)).toMatch(/…/)`), or (C)
targets the result of a same-file helper that surfaces a caught error (a `catch`
that `return`s an expression using the error binding — the marshalling
`fromDbReason`/`toDbReason` helpers). The limit is sharp: in
[`marshalling.transform-validation.test.ts`](../../db/postgres/newest/pg/marshalling.transform-validation.test.ts)
the `*-throws` tests (assert an error reason via `fromDbReason`) are tolerated,
while the value-coercion tests (`fromDbValue` → `expect(...).toBe(123)`) **stay
flagged** — they must run on the real engine (`fragmentWithType` can synthesise
the off-shape input). This applies only to the **skip** form; a **swallow**
discards the error on real and is never exception-validation.

**File-scoped exceptions** (`FILE_SCOPED_MOCK_ONLY` in
[`checks/mirrorImage.ts`](./checks/mirrorImage.ts)). A deliberate, **tiny**
allow-list: a named helper in a specific test file whose mock-only skip is
explicitly tolerated, each entry carrying its reason — the `tests-audit-disable`
philosophy at the tool level (the file is symmetric across every cell, so the
reason is identical everywhere and lives once in code rather than as N inline
comments). The sole entry today is **`fromDbValue` in
`marshalling.transform-validation.test.ts`**: it injects, via `mockNext`, a
representation a real driver of that connector would never hand back (a JS
`bigint` for an int column, …), and forcing it on a real engine via
`fragmentWithType` is contrived and cross-connector — tolerated mock-only by
project decision. Tolerated only when *every* `expect(...)` in the skipped body
asserts on a `fromDbValue(...)` call; a foreign assertion (SQL snapshot, other
helper) is not covered. This list is a hole in the rule — keep it minimal.

**NOT-APPLICABLE / TODO[BUG] carve-out** (both forms — skip AND swallow). A
**live** test marked `// NOT-APPLICABLE: <reason>` OR `// TODO[BUG]: <reason>` (in
its body, or within 3 lines above the `test(...)` call) is allowed to be
mock-only. Two reasons license it: `NOT-APPLICABLE` is a deliberate **dialect
boundary** (this cell's real engine genuinely cannot validate the case, while the
same test runs and validates in the dialects that DO support it); `TODO[BUG]` is
a **reproducible bug** whose repro stays mock-only until the bug is fixed. Both
are the in-code, greppable, classifiable analogue of a
`tests-audit-disable-next-line mock-only`, with the project-semantic meaning
attached (and surfaced as a cell caveat by the searcher). `TODO[LIMITATION]` is
deliberately **excluded** (a pending decision, not a permanent boundary or an
open bug). Detection is the shared `markerLines(sf, NOT_APPLICABLE_OR_BUG_REASON)`
+ `isNodeInMarkedTest` in [`ast.ts`](ast.ts); it scopes to the enclosing
`test(...)` so a marker on one test never exempts a sibling. The carve-out
touches only `mock-only` (and its registration-level twin
[`skip-real-db`](#registration-skip-rules--skipped-test-reason--skip-real-db)) —
`mirror-image` / `one-sided-guard` describe a test that DOES run in both modes,
so the marker does not affect them. (`TODO[BUG]` additionally exempts the
type-bypass rules — see [`as-any`](#as-any--a-cast-to-any-that-bypasses-the-public-typed-api).)

**Verified** (whole matrix): 595 findings — e.g.
`select.value-source.trig.test.ts` (swallow; fix with `toBeCloseTo`),
`exec.procedure-function.test.ts` / `delete.execute-variants.test.ts:97`
(swallow). The fix is to drive the case on the real engine; a documented
synthetic-SQL exception (DESIGN § Mock-only smell — Skip-real form) carries a
`// tests-audit-disable-next-line mock-only -- <reason>`.

**Status**: **built** (`error`). The **first promoted to `error`** — not going
to the real DB is the least defensible smell. The backlog is worked down; 0
findings today.

### `mirror-image` — two-sided guard, real branch shape-only (ANTIPATTERNS #1)

The high-precision cheat: an `if/else` on `ctx.realDbEnabled` where the **mock
branch asserts a result with deep equality** AND the **real-DB branch only
checks shape**. A regression slips through under `--docker` while the test
reports green. (The inverse — real deep, mock shape-only — is flagged too.)

Triggered by **deep equality** specifically (a whole result set), not scalar
`toBe` — a scalar guard is the `one-sided-guard` / non-deterministic family.

**Bounded-random carve-out.** `random()` yields a non-deterministic but
*bounded* value: real can't pin the exact number, but it can — and **must** —
bound it to `[0, 1)`. A bare `expect(typeof r).toBe('number')` is too weak (it
once hid a real bug — a wrong function / out-of-range value), so the carve-out
is **stricter** than the autogen-id one: a `random()` guard
([`usesRandom`](./checks/mirrorImage.ts)) is tolerated **only** when the
real-validating branch contains both a lower- and an upper-bound comparison
(`toBeGreaterThan*` AND `toBeLessThan*`). A `typeof`-only real branch **stays
flagged** until it bounds the value. (Every `random` cell now carries the bound
— the canonical `select.scalar-helpers.test.ts` shape propagated to all cells, so
none stays flagged.)

**Verified**: 145 findings, 100% genuine on the sample, e.g.
[`select.distinct.test.ts:29`](../../db/postgres/newest/pg/select.distinct.test.ts#L29)
(`else expect(rows.length).toBeGreaterThanOrEqual(1)`), `update.returning.test.ts:111`
(`else expect(Array.isArray(rows)).toBe(true)`),
`select.value-source.null-and-if-value-modifiers.test.ts:183`
(`else expect(rows.length).toBeGreaterThanOrEqual(0)` — vacuously true). A
subagent false-positive review of the pg cell found 2 FPs here — a two-sided
`toEqual` (mock) / `toBeNull` (real) guard on a no-match `…NoneOrOne` query, where
`toBeNull` pins the value exactly — and they were fixed by reclassifying
`toBeNull` / `toBeUndefined` as scalar value matchers (they were in `WEAK`); the
count dropped 171 → 145.

**Status**: **built** (`error`). The sites have been fixed (the value assertion
made unconditional per DESIGN §1, or justified with
`// tests-audit-disable-next-line mirror-image -- <reason>`); 0 findings today.

### `one-sided-guard` — only one mode validates the value

A `ctx.realDbEnabled` guard that gives **only one mode a value assertion**, so
the other mode never validates the result. Both shapes, both polarities:

- no-else branch — `if (!realDb) expect(rows).toEqual(...)` (real never
  validates) / `if (realDb) expect(...).toEqual(...)` (mock never validates);
- early-return skip — `if (realDb) return; expect(...).toEqual(...)` (mock-only)
  **and** `if (!realDb) return; expect(...).toEqual(...)` (real-only). Per the
  project author, a real-only test is **not** legitimate either: the value must
  be checked in both modes.

Not flagged when the test already asserts the value **unconditionally**
(outside any guard) — then the guard is a supplementary check. A guarded branch
that only checks shape, or asserts an error type (`toBeInstanceOf`) rather than
a value, is not a value assertion and is not flagged.

**Non-deterministic-result carve-out** (built in to the rule, not a
`tests-audit-disable`). Some guarded values have an exact content that depends on
the **real database's existing state**, so they can only be pinned under the
mock — reproducing them on a real DB would mean micromanaging seed data. The
**producing call** is a syntactic anchor for that non-determinism, so the
pattern is recognised mechanically and **not flagged** — iff *every* value
assertion in the guarded branch targets an identifier bound from an await-chain
calling one of these producers:

- **`returningLastInsertedId()`** — an engine-autogenerated id (sequence state);
- **`executeInsert` / `executeUpdate` / `executeDelete`** matched **exactly**
  (NOT `executeInsertMany`, `executeUpdateNoneOrOne`, nor any `…Returning…`
  terminal) — the affected-/inserted-row **count**, which depends on what is
  already in the table;
- **insert-from-select** (always a subquery in this lib) terminates in
  `executeInsert`, so it rides the same anchor (and may itself be a
  `returningLastInsertedId` insert);
- an **INSERT returning only the id** — `returningOneColumn(t.id)` or
  `returning({ id: t.id })` (one property, value a `.id` access) — yields the
  same autogenerated id and is how some dialects emulate
  `returningLastInsertedId`. Anchored on the conventional `.id` column name and
  **scoped to INSERT** (the chain calls `insertInto`).

This is the one place the audit makes a semantic call the
[Boundary](#boundary) table otherwise reserves for a human — and it can, only
because the producing call *is* the anchor. The limit stays sharp — these stay
flagged:

- a guarded assertion on a value NOT from such a producer — a **SELECT** result,
  or a `returningOneColumn(t.<col>)` of a **non-id** column whose value is
  deterministic (e.g. [`update.execute-variants.test.ts:112`](../../db/postgres/newest/pg/update.execute-variants.test.ts#L112)
  `returningOneColumn(t.status)` → `'reviewed'`,
  [`delete.execute-variants.test.ts:106`](../../db/postgres/newest/pg/delete.execute-variants.test.ts#L106)
  → `'open'`) — must be asserted unconditionally (`ORDER BY` / JS-sort) or carry
  a `// tests-audit-disable-next-line one-sided-guard -- <reason>`;
- a `returning(t.id)` on an **UPDATE/DELETE** would return a PRE-EXISTING,
  deterministic id — the carve-out's INSERT scoping (it requires `insertInto`)
  keeps it flagged.

(An exception-assertion test — `expect(String(caught)).toMatch(/…ROWS…/)` for a
`MINIMUM_ROWS_NOT_REACHED` / `MAXIMUM_ROWS_EXCEEDED` guard — is a *different*
test shape: it asserts the throw unconditionally in both modes, so it is not a
one-sided value guard and is not flagged, regardless of what its `returning(...)`
projects.)

**Verified**: 1567 findings — the suite's prevailing
`if (!ctx.realDbEnabled) expect(result).toEqual(expectedMock)` idiom (the mock
value can't be asserted unconditionally because the real-DB row order / values
differ). This is the large DESIGN §1 backlog: each site wants an `ORDER BY` /
JS-sort so one `expect(...).toEqual(...)` passes in both modes, or a
`// tests-audit-disable-next-line one-sided-guard -- <reason>` where a mode genuinely can't
validate (engine-only error). The 367 sites the carve-out removed
(1888 → 1521) were the producer shapes above; reclassifying `toBeNull` /
`toBeUndefined` as value matchers (the mirror-image FP fix) then added 46
previously-invisible one-sided `toBeNull` guards (1521 → 1567) — a gap it closed.

**Status**: **built** (`error`). Promoted independently of `mirror-image`; its
(large) migration backlog has been worked down to 0 findings today.

### `as-any` — a cast to `any` that bypasses the public typed API

**Rule** ([`DESIGN.md` § The `as any` runtime-guard exception](../../DESIGN.md#as-any-runtime-guard)):
a cast to `any` (`x as any` / `<any>x`) silences the checker. The recurrent,
real cheat: an agent that can't build the query through the public typed API
takes the shortcut, casts to `any`, and — having only run the mock — ships a
test exercising something the public surface forbids. The `as any` is the
symptom of *not understanding the problem*.

**Why it can't be a clean shape-gate** — the cheat and the legitimate uses are
**syntactically identical** (`(builder as any).publicMethod()` appears in both).
Verified on the whole matrix (~1277 casts, 0 cheats today — they get fixed in
review): the legitimate population is large and diverse. So instead of one
discriminator, the rule **tolerates a small set of project-sanctioned patterns
and flags everything else** to rewrite (it surfaces a smell
for a human, it does not bless the cast). Tolerated:

1. **Exception machinery** — the cast feeds an invalid value to a runtime guard
   that throws. Two forms (reusing the
   [mock-only exception machinery](#mock-only--the-test-never-validates-against-the-real-engine-most-severe)):
   the enclosing `test(...)` validates ONLY exceptions (`errors.*`,
   `dynamic-condition.errors`), OR the cast sits inside an **error-handling
   helper** — one whose `catch` surfaces the error (the marshalling `toDbReason` /
   `fromDbReason`), OR one that RECEIVES the error as a parameter and inspects it
   (`reasonOf(e: unknown)`, `reasonsInChain(e: unknown)` — recognised by an
   `unknown` error-named param, see `hasErrorParam`). The throw / the error
   inspection IS the assertion.
2. **allow-when gating** — tolerated ONLY when the enclosing test asserts
   `isQueryAllowed(...)`. The cast hides that the test should arguably be
   disabled on unsupported DBs, but `isQueryAllowed` pins the gate semantics and
   a cheat would not assert it (project decision — a granted tolerance, not an
   endorsement).
3. **The marshalling `fromDbValue` helper** — a `FILE_SCOPED_AS_ANY` entry
   scoped to a single **helper** (not the whole file), the as-any twin of the
   `fromDbValue` mock-only file-scope. `fromDbValue` casts a value-source/result
   to drive the from-db transform and returns the VALUE, so unlike its sibling
   error-extractors it is not covered by (1) and needs the explicit hole. The
   rest of the file stays covered.

**Deliberately NOT tolerated** (flagged, to rewrite — verified on the pg
cell, the others are replicas): a `{…} as any` **dynamic payload** to
`withValues` (it *should* compile without the cast — a public documented API; the
cast can hide a typing bug); a wrong-type value to a **conditional-set** skip
(`'' as any` — could be written differently); a **builder cast to reach a
runtime short-circuit** the types forbid (`(insertInto(t) as any).values([])`);
a **helper that wraps the query** (`isolation as any`) — it defeats the
realistic-query goal. These are smells the rule keeps visible.

The line the rule can't draw is **intent** (testing a guard vs faking a query);
that residue is the [quality-gate sub-agent](../../QUALITY_GATE.md)'s — its
"Gate today" for #4 stays the sub-agent even though the rule has promoted to
`error` and the backlog is now 0.

**TODO[BUG] carve-out** (shared by `as-any`, `any-type`, `as-unknown-as`,
`meaningless-cast`, `meaningless-type`). A test marked `// TODO[BUG]: <reason>`
(in its body or within 3 lines above) is exempt from all five type-bypass rules:
a reproducible bug often *needs* a cast to even compile its repro, and the marker
keeps that visible and tracked until the fix lands. Keyed on `TODO[BUG]`
specifically (`markerLines(sf, TODO_BUG_REASON)` + `isNodeInMarkedTest`), scoped
to the enclosing test. `NOT-APPLICABLE` does **not** grant this (it licenses only
mock-only, not a type bypass).

**Status**: **built** (`error`), in [`checks/asAny.ts`](./checks/asAny.ts). pg
cell: 15 findings (the rewrite backlog above); whole matrix ~242 (after the
exception / allow-when / marshalling carve-outs) — now 0 after the suite cleanup.

### `any-type` — an `any` TYPE annotation

The sibling of `as-any` for the **type** position rather than the cast: `x: any`,
`(v: any) => …`, `any[]`, `Array<any>`, `: Promise<any>`, an `any` return type.
It defeats type-checking and usually hides a test that is not realistic — a
caught error left `any` instead of `unknown`, a connection widened to `any` to
dodge the typed surface (often with an `eslint-disable no-explicit-any`, the
very shortcut this guards), an extension whose shape was never spelled out.

**No conflict with `as-any`**: an `AnyKeyword` whose parent is the cast's `as` /
`<>` is owned by `as-any` and excluded here, so the two never double-flag.

**Carve-out**: only the shared `TODO[BUG]` exemption above (a bug repro). The
fix is otherwise mechanical — `unknown` for a caught error / opaque value, or the
precise type. Verified on the pg cell: 16 findings (`let thrown: any` →
`unknown`; `const conn: any`; `(v) => any` in `DynamicCondition` extension type
defs) — that rewrite backlog has since been worked down to 0.

**Status**: **built** (`error`), in [`checks/asAny.ts`](./checks/asAny.ts). pg
cell: 16; whole matrix ~272 — now 0 after the suite cleanup.

### `as-unknown-as` — the `x as unknown as T` laundering

The single clearest type-checker cheat, given its **own** rule (not folded into
`meaningless-cast`) because the message to the agent is so specific. Casting
THROUGH `unknown` strips the value to the top type, then `as T` re-asserts it to
anything — exactly what `as any` does, just spelled to slip past an `as any`
ban. There is no honest reason a test needs it. Detection
([`checks/asAny.ts`](./checks/asAny.ts)): an outer cast whose operand is a cast
to `unknown`. Same sanctioned carve-outs as `as-any` (exception machinery,
allow-when, file-scoped, `TODO[BUG]`). The inner `as unknown` of the pair is
excluded from `meaningless-cast` so the two never double-flag.

**Status**: **built** (`error`). Whole matrix: 0 today (was 62 during the ramp —
the laundering casts the suite cleanup had left in place because this rule did
not yet exist, mostly the `dynamic-condition.extension` sites replicated per
cell; that rewrite backlog has been cleared).

### `meaningless-cast` — a cast to `unknown` / `null` / `never` / `void`

The non-`any` spellings of the same bypass: `as unknown` (terminal, not the
`as unknown as` laundering — that is `as-unknown-as`), `as null`, `as never`,
`as void`, a union of only those (`as unknown | null`), or an **array of one of
those** (`as unknown[]` — every array is already assignable to `unknown[]`, so the
cast is redundant; e.g. `ctx.lastParams as unknown[]` where `lastParams` is
already `unknown[]`). A union with a real member (`as string | null`) is a genuine
widening and is **not** flagged. Same sanctioned carve-outs as `as-any`.

**Status**: **built** (`error`), in [`checks/asAny.ts`](./checks/asAny.ts). Whole
matrix: 0 today (was 170 during the ramp — the redundant `ctx.lastParams as unknown[]`
casts feeding the public `getQueryExecution*` / `isSelectPageCountQuery` APIs;
the cast was dropped since `lastParams` is already `unknown[]`).

### `meaningless-type` — the `unknown` / `null` / `never` / `void` type annotation

The type-position twin of `meaningless-cast`. Anything inside a cast's TYPE is
excluded (`isWithinCastType` → owned by `meaningless-cast` / `as-unknown-as`).
`unknown` and `null` are **permitted in the same contexts as `as any`** (project
decision), so the rule reuses the cast carve-outs plus the idiomatic / API-mandated
uses (see `isExemptMeaninglessType`): an exception test / throw-helper / `fromDbValue`
/ `TODO[BUG]`; a caught-error variable or `unknown` error PARAMETER (`reasonOf(e:
unknown)`, recognised by the error-ish name like `weak-matcher`'s diagnostic
context); a type-test arg (`assertType<…, never>`); inside an `Error & { … }`
shape — the extra-property types of an error-inspection alias
(`type DisallowError = Error & { x?: unknown }`, see `isInErrorShapeType`); what a
public API requires — a `TypeAdapter` override (`transformValueToDB`/`transformValueFromDB`)
or a `getQueryExecutionMetadata` result; `null` in a union with a real member;
`void` as a function return. What stays flagged: a standalone meaningless
annotation, and `unknown` **plumbing** that only makes a test less readable /
realistic (a generic `capture(run: () => Promise<unknown>)`, `Set<unknown>`).

**Status**: **built** (`error`), in [`checks/asAny.ts`](./checks/asAny.ts). Whole
matrix: **0** today — after the carve-outs (the error-shape alias was the last)
and the suite cleanup. (The earlier "full mirror" count of 3466 was almost
entirely legitimate `unknown`: caught errors, the public `TypeAdapter` API,
type-test args, error-inspection aliases — now carved out.)

### `type-cast` — any other type assertion (`x as T` / `<T>x`)

The catch-all for type assertions the more specific cast rules (`as-any`,
`as-unknown-as`, `meaningless-cast`) did NOT already claim — a `{ … } as SomeRow`,
`rows as Project[]`, `undefined as string | undefined`, `<Foo>x`. A type assertion
forces the checker to accept a shape it did not infer, so it is often hiding a
typing problem, or marks a spot where the value should be **built** so it
genuinely has type `T`, or checked with **`satisfies T`** (which validates instead
of overriding). **Exempt**: `as const` (a const assertion, not a type override)
and a **branded-type construction** — a primitive literal (or `new …()`) cast to a
bare type-reference identifier (`19.99 as Money`, `42 as IssueId`,
`new Date(…) as SettlementDate`): a nominal type can *only* be produced with such a
cast, and the literal operand distinguishes it from a structural assertion
(`rows as Project[]`, `{ … } as Foo`, which stay flagged — see `isBrandedCast`).
Also exempt: an **error-narrowing cast** — a cast to an error type (`Error`,
`*Error`, or an intersection `Error & { … }`), i.e. narrowing a caught error to
read its properties (`(thrownError as Error).message`,
`thrown as Error & { … }`); see `isErrorNarrowingCast`. Otherwise the **same
sanctioned contexts as `meaningless-cast`** apply (`castSanctioned`: exception
test, throw-helper / error-handling helper, allow-when, file-scoped `fromDbValue`,
`// TODO[BUG]:`). It composes with the other cast rules without double-flagging
(each cast node is owned by exactly one).

**Status**: **built** (`error`), in [`checks/asAny.ts`](./checks/asAny.ts). Whole
matrix: **0** today — after the branded + error-narrowing carve-outs and the suite
cleanup, nothing remains. An `error` rule whose residue is the quality-gate
sub-agent's judgement (is the cast necessary, or should it be `satisfies` / a
properly-built value?).

### `non-public-api` — a relative import past the supported surface

Same family as `as-any`: an agent that can't do something through the public
library API reaches into internals with a relative import
(`../../../../../src/sqlBuilders/…`), or pulls test infrastructure out of
`test/lib/`. Either way the test stops exercising the surface real users have.
Two arms, one rule (built in [`checks/nonPublicApi.ts`](./checks/nonPublicApi.ts),
AST-only so comment links to internal files don't count):

- **non-public `src/`** — what may be imported is **exactly the
  [`package.json`](../../../package.json) `exports`** (per project decision),
  mapped to its src module path, minus `./package.json` and the
  `./__UNSUPPORTED__/*` escape-hatch wildcard. The public set is *derived from
  `package.json`* so it never drifts from what ships; a reach into anything else
  (`internal`, `queryBuilders`, `sqlBuilders`, `expressions`, …) is flagged. The
  one exception is `src/experimental/*` — a staging area for surface not yet in
  the `exports` map but already meant for tests to consume, so a relative reach
  into it is allowed.
- **non-admitted `test/lib/`** — a `*.test.ts` may import only the admitted
  helpers (`testRunner`, `assertType`, `isAllowed`); the rest of `test/lib/` is
  infra (the audit, searcher/indexer, backends, container lifecycle) and is
  flagged. `./setup.js` and `../../domain/…` are neither src nor test/lib, so
  they are fine.

**Status**: **built** (`error`). Whole matrix: 0 findings today (every src import
is a public export or under the allowed `src/experimental/*`, every test/lib
import is admitted) — a clean preventive gate. (`documentation` / `*.generated` cells, which import a mock-runner, are
outside the walked set, so they don't count.)

### `commented-test-reason` — a commented-out test with no stated reason

A test may be temporarily disabled by commenting it out; the
[symmetry check](#the-rules) still counts its name (so it cannot be silently
dropped — it stays commented in every cell). But a bare commented-out test
reads as "someone gave up here" with no trace of why. Project rule: every
commented-out test carries one of **three first-class reason markers** (the
reason after the colon is mandatory in all three; the markers live in
[`reasons.ts`](reasons.ts)):

| Marker | Cause | Pending? | Re-enables in THIS cell? | Runs in another cell? | Tracked |
|---|---|---|---|---|---|
| `// TODO[BUG]: <reason>` | a defect in `src/` | yes — fix it | when the bug is fixed | normally no | `BUGS.md` |
| `// TODO[LIMITATION]: <reason>` | the lib doesn't cover it yet / the env can't | yes — could be covered | if the decision/env changes | normally no | `LIMITATIONS.md` |
| `// NOT-APPLICABLE: <reason>` | a deliberate **dialect boundary** | **no — nothing pending** | **never** | **yes, where the dialect supports it** | symmetry + the dialect's `types.negative/` |

`NOT-APPLICABLE` is its **own** category, **not** a `TODO[NOT-APPLICABLE]`
sub-tag: the word "TODO" implies pending work, which is exactly wrong for a
permanent, by-design boundary (`.startWith`/`.connectBy` typed `never` in
PostgreSQL, `.innerJoin` in a DELETE typed `never` outside MariaDB/MySQL, …),
and tagging it "TODO" would pollute `LIMITATIONS.md` (actionable debt) with
boundaries nobody will close and erase the signal "this test is alive in another
cell". Pick by **future**: a `TODO[*]` means work that could re-enable the test
*here*; `NOT-APPLICABLE` means it will only ever run *elsewhere*.

Detection is comment-scoped — the TS **scanner** enumerates comments, so a
string or live code that merely contains `test(` is never mistaken for one. A
comment whose text holds a `test(…)` / `it(…)` call is a commented-out test; it
is satisfied when that comment, or one of the three markers within 3 lines above
it (the usual marker line sitting above a `/* … */` block), states a reason. The
markers are uppercase + hyphen so they are deliberate and greppable — prose like
`// Not applicable on MariaDB: …` does **not** match and stays flagged until
migrated to the canonical `// NOT-APPLICABLE: …`.

*Distinct from the [Boundary](#boundary) row* on `TODO[BUG]`/`TODO[LIMITATION]`
(and now `NOT-APPLICABLE`): that one is about **cross-referencing** existing
markers against `BUGS.md`/`LIMITATIONS.md` and surfacing them as cell caveats
(the searcher's / indexer's job, `tests:where-is --cell-caveats`). The audit
only checks that a disabled test **has** a marker — a structural requirement, no
cross-reference and no per-category classification (that distinction lives in the
searcher).

**Status**: **built** (`error`). Whole matrix: 0 findings today (was 555 during
the ramp — commented-out tests that explained themselves in prose
(`// Not applicable on MariaDB: …`) but lacked a standardised marker). The backlog
was to convert each prose note into the right one of the three markers (a dialect
boundary → `// NOT-APPLICABLE:`; a bug → `// TODO[BUG]:`; not-covered-yet →
`// TODO[LIMITATION]:`); that migration — suite work owned by the corrections
pass, not the audit tool — is now complete.

### `grouped-commented-tests` — several commented-out tests sharing one comment block

The structural companion to `commented-test-reason`. That rule asks "does this
commented-out test have *a* reason?"; this one asks "does *each* commented-out
test have *its own* reason?". When several `test(...)` / `it(...)` calls are
lumped into a single `/* … */` block, one marker above the block satisfies
`commented-test-reason` for all of them — so the individual justifications are
lost and a reader cannot tell which reason applies to which test (the marker may
even be right for one test and wrong for the next). The fix is to **split the
block**: one commented-out test per comment, each carrying its own
`// TODO[BUG]:` / `// TODO[LIMITATION]:` / `// NOT-APPLICABLE:` marker — after
which `commented-test-reason` enforces a distinct reason on every one. So the two
rules compose: this one forbids the block, that one fills each split with a reason.

**Anchor — the SHAPE, comment-scoped (no type checker)**, in
[`checks/groupedCommentedTests.ts`](./checks/groupedCommentedTests.ts): the TS
scanner enumerates comments (so a string or live code that merely contains
`test(` is never matched, same `TEST_CALL`-with-trailing-`,`/`)` shape as
`commented-test-reason`), and a **single comment node** whose text holds **two or
more** test calls is flagged. **Per node by design**: a normal `//`-per-line
commented-out test (one `test(` on one of its lines) is never flagged — only a
multi-test `/* … */` block (or two calls crammed onto one comment line) is. No
marker carve-out (a `TODO[BUG]` repro has no reason to group two tests either);
the rule is purely about layout, orthogonal to *which* marker each test needs.

**Verified**: 88 findings — multi-test `/* … */` blocks copied verbatim from the
canonical cell for cross-cell diff parity, then commented out under one shared
marker (e.g. `transaction.isolation-level.test.ts`, `exec.procedure-function.test.ts`,
`select.aggregate-as-array-inline-wrapped.test.ts`, replicated across the
symmetric cells). The backlog — split each block so every commented test gets
its own marker, suite work owned by the corrections pass, not the audit tool — has
since been worked down to 0 findings today.

**Status**: **built** (`error`).

### `uuid-literal` — a string literal that looks like a UUID but is not valid

**Threat (a real, shipped bug)**: `transformValueToDB` for `'uuid'` only checks
`typeof value === 'string'` ([`AbstractConnection.ts`](../../../src/connections/AbstractConnection.ts)),
**not** the format — so a malformed UUID literal passes under the mock and is
rejected only by a real engine's `uuid` cast. An agent that runs the suite
mock-only (the full real pass takes >10 min) leaves the bad test green. This is
the documented anchor that was previously missing.

**Anchor — the SHAPE of the literal, not its type** (project decision: *"find
strings that look like a UUID and validate them"*). No `ts.Program` is needed,
so the rule stays in the ~1 s syntactic lane and — unlike a type-directed
check — catches the literal in **any** position (a `uuid` column in `.values({
… })`, a `.equals(…)`, a `const(…, 'uuid')`, a `mockNext`). "Looks like a UUID"
is the OR of two narrow patterns so a hyphenated English phrase
(`delete-with-or-joined-conditions`, a real test name with 5 UUID-ish groups) is
**not** mistaken for one:

- **hex-loose** — hex-and-hyphen only, 5 groups in the 8-4-4-4-12 shape with a
  ±2 length tolerance: catches a truncated / over-long / wrong-length real UUID
  (English words have non-hex letters, so never match);
- **shape-exact** — the exact 8-4-4-4-12 grouping but alphanumeric: catches a
  single non-hex typo (`…bbcd52g`) in an otherwise perfectly shaped UUID (a
  phrase whose groups aren't exactly 8-4-4-4-12 never matches).

Flagged iff it looks like a UUID but is not the strict 8-4-4-4-12 hex a real
engine accepts. A `'not-a-uuid'` placeholder matches neither pattern and stays
out of scope — distinguishing *that* from a valid string needs the type checker,
the unbounded question the [Boundary](#boundary) walls off. This is why the rule
stays **narrow**: UUID-looking literals only, never "any value a mock accepts".

**Status**: **built** (`error`), in [`checks/uuidLiteral.ts`](./checks/uuidLiteral.ts).
Whole-matrix run: 0 findings today (every UUID in the suite is valid) — a clean
preventive gate.

### `focused-test` — a committed `.only` that skips the rest of the suite

**Threat**: `test.only` / `it.only` / `describe.only` focuses the runner on that
single test (or suite) and **silently skips every other test in the file**. The
rest of the cell "passes" by never running — a green report over an almost-empty
run. Unlike the other content rules this is not a weakening of one assertion; it
suppresses *whole files*, so it is the most dangerous of the cheap-to-detect
smells.

**Anchor — the SHAPE of the call, not its type**: a property access `<root>.only`
where the leftmost identifier of the access chain is `test` / `it` / `describe`.
The chain walk ([`rootIdentifier`](./checks/focusedTest.ts)) also catches
`test.only.each(...)` / `it.only.failing(...)`; an unrelated `.only` (a
`config.only = …` assignment, a `{ only: 1 }` object, `myHelper.only(...)`) has a
non-runner root and is **not** flagged. No type checker.

`.only` is a local-iteration convenience; committed to the matrix it is never
legitimate, and there is nothing to migrate (anchor: **0 today**). It was an
**early promotion**, and now that it is `error` it fails the
build the moment a `.only` is committed.

**Status**: **built** (`error` — like every content rule today; see
[Severity model](#severity-model)), in [`checks/focusedTest.ts`](./checks/focusedTest.ts).
Whole-matrix run: 0 findings today — a clean preventive gate.

### `empty-snapshot` — an un-baked `toMatchInlineSnapshot()` in live code

**Threat**: `expect(ctx.lastSql).toMatchInlineSnapshot()` with **no argument**
pins nothing — on the next run the matcher auto-fills the baked value and the
assertion always passes. It *looks* like it asserts the SQL/params but asserts
nothing until baked: a weak assertion disguised as a snapshot. A cell committed
with un-baked snapshots reports green while validating nothing.

**Engine — AST (no type checker)**, in [`checks/emptySnapshot.ts`](./checks/emptySnapshot.ts):
an empty-arg call to `toMatchInlineSnapshot` / `toMatchSnapshot`. Being
AST-based, the rule sees only **live** code — an empty snapshot inside a
commented-out test (a `/* … */` block) is comment trivia, never parsed as a
call, so it is **naturally exempt**, no special-casing needed.

**Why that exemption is correct — the investigation behind the 384**. A
whole-matrix grep finds **384** empty `toMatchInlineSnapshot()`, but an AST pass
(live code only) finds **0**: every one of the 384 sits **inside a commented-out
test** (e.g.
[`select.aggregate-as-array-inline-wrapped.test.ts:508`](../../db/postgres/newest/pg/select.aggregate-as-array-inline-wrapped.test.ts#L508),
inside the `/* … */` opened at line 488). They are un-baked placeholders in
tests copied verbatim from the canonical cell for cross-cell diff parity and
then commented out because they don't apply to that dialect — *not* a live
backlog. They are governed by [`commented-test-reason`](#commented-test-reason--a-commented-out-test-with-no-stated-reason)
(a dialect that doesn't support the feature → `// NOT-APPLICABLE:`), and they don't run, so their empty
snapshot validates nothing-by-running-nothing — already covered. Flagging them
would be pure noise and double-count. So the **live-code anchor is 0**, and this
is a preventive gate — the snapshot twin of `uuid-literal` / `non-public-api`:
it fails the build the moment an un-baked snapshot is committed to live code.

**Status**: **built** (`error`). Whole-matrix run: 0 live findings today (the 384
empty placeholders are all in commented-out tests, AST-exempt). Like the other
anchor-0 preventive gates it is `error`, the live tree being already clean.

### Suppression-comment rules — `ts-ignore` / `ts-expect-error` / `eslint-disable-type` / `eslint-disable-other`

The blunt siblings of [`as-any`](#as-any--a-cast-to-any-that-bypasses-the-public-typed-api)
and [`any-type`](#any-type--an-any-type-annotation): where those catch a cast or
type annotation that silences the checker in an **expression**, these catch the
same move made in a **comment directive** — blunter, because a directive
suppresses whatever sits on the next line wholesale. An agent that can't build a
query through the public typed API can reach for a `@ts-ignore` or an
`eslint-disable` just as readily as for an `as any`.

Produced by one pass ([`checks/suppressions.ts`](./checks/suppressions.ts), TS
scanner — so a string or live code that merely contains the text is never
mistaken for a directive, no type checker). They are **split into one rule per
mechanism** (project decision) so each carries its own severity and was
promoted independently; all four are `error` today.

- **`ts-ignore`** — `@ts-ignore` / `@ts-nocheck`. Silences EVERY type error on
  the next line — the bluntest bypass. Forbidden **everywhere** in the tests,
  including the negative-type cells: the legitimate negative-type tool is the
  line-scoped, error-asserting `@ts-expect-error` *inside* a `types.negative/`
  cell, never the blanket ignore. This is the **one rule that also scans
  `types.negative/`** (every other rule skips it). **Anchor: 0 anywhere in
  `test/`** — a clean preventive gate, and (with `focused-test`) one of the early
  promotions.
- **`ts-expect-error`** — `@ts-expect-error` **outside** a `types.negative/`
  cell. Inside those cells it is the *expected* negative-type assertion (proving
  the public API rejects something — 243 legitimate uses today), and they are
  excluded from the walk, so they are naturally exempt. Anywhere else it asserts
  a type error where the line should compile cleanly — a type-limitation bypass
  ("…the runtime accepts this SQL"). **Anchor: 0 today** (was 4 during the ramp,
  all in
  [`mariadb/.../select.aggregate-as-array-inline-wrapped.test.ts`](../../db/mariadb/newest/mariadb/select.aggregate-as-array-inline-wrapped.test.ts)
  — MariaDB types disallow group-by/having in correlated inline aggregates, the
  test bypassed the type to exercise SQL the runtime accepts; that backlog was
  rebuilt through the public surface or moved to a `types.negative/` cell).
- **`eslint-disable-type`** — an `eslint-disable*` of a **type-soundness** lint
  (`@typescript-eslint/no-explicit-any`, `no-unsafe-*`, `ban-ts-comment`) or a
  **bare** disable (no rule named → turns off every lint). The lint twin of
  `as-any` / `any-type` — it silences the rule that would flag a type-dodging
  test. **Anchor: 0 today** (was 34, all `no-explicit-any` — that rewrite backlog
  has been cleared).
- **`eslint-disable-other`** — an `eslint-disable*` of any **other** (non-type)
  lint. Split from the type bucket so the type-soundness signal stays clean;
  this one is the lowest-priority bucket. **Anchor: 0 today** (was 17, all
  `no-unused-vars` on a kept-for-parity `import { assertType as _assertType }`
  — a doc-example import unused in that snippet; cleared).

**Status**: **built** (`error`), in [`checks/suppressions.ts`](./checks/suppressions.ts).
Whole-matrix: all 0 today (ramp anchors were `ts-ignore` 0, `ts-expect-error` 4,
`eslint-disable-type` 34, `eslint-disable-other` 17 — the latter three cleared).

### Registration-skip rules — `skipped-test-reason` / `skip-real-db`

A test can be disabled or gated at the `test(...)` **registration** site rather
than inside its body. Two distinct mechanisms, **split into two rules** (the same
per-mechanism decision as the suppression family) so each tunes severity
independently. Produced by [`checks/registrationSkip.ts`](./checks/registrationSkip.ts)
(AST for the `.skip`/`.todo`/`.skipIf`/`.runIf` access — so a string or comment
mentioning them is never matched — plus the TS scanner for the TODO-reason
comments; no type checker).

- **`skipped-test-reason`** — `test.skip` / `it.skip` / `describe.skip` /
  `test.todo` / `it.todo`, plus the identifier forms `xit` / `xtest` /
  `xdescribe`. A disabled test carries the SAME obligation as a commented-out one
  (the [`commented-test-reason`](#commented-test-reason--a-commented-out-test-with-no-stated-reason)
  twin, by project decision): it must state why with one of the same three
  first-class markers — `// TODO[BUG]:`, `// TODO[LIMITATION]:`, or
  `// NOT-APPLICABLE:` `<reason>` — within 3 lines above (or on the call's own
  line). A `.skip` with no stated reason reads as "someone gave up here".
  **Anchor: 0** — no disabled tests in the matrix today.
- **`skip-real-db`** — `test.skipIf(ctx.realDbEnabled)` /
  `test.runIf(!ctx.realDbEnabled)` (any `skipIf`/`runIf` whose condition
  references `realDbEnabled`). This is a [`mock-only`](#mock-only--the-test-never-validates-against-the-real-engine-most-severe)
  evasion at the **registration** level — the body-scoped `mock-only` rule
  (`if (ctx.realDbEnabled) return` *inside* the body) cannot see it, because the
  test is never even registered to run on the real engine. The value must be
  validated in both modes, so the test must run in both. A `skipIf`/`runIf` on
  some *other* condition (a feature flag) is a different concern and is **not**
  flagged here. **NOT-APPLICABLE / TODO[BUG] carve-out** (mirrors `mock-only`): a
  test marked `// NOT-APPLICABLE: <reason>` (dialect boundary) or
  `// TODO[BUG]: <reason>` (reproducible bug pending a fix) is exempt.
  **Anchor: 0** — a preventive gate closing the hole before it appears.

**Status**: **built** (`error`), in [`checks/registrationSkip.ts`](./checks/registrationSkip.ts).
Whole-matrix: both 0 — clean preventive gates.

### `misplaced-marker` — a reason marker not at a test

The three first-class markers (`// TODO[BUG]:`, `// TODO[LIMITATION]:`,
`// NOT-APPLICABLE:`) mean something specific *about a test* — they are consumed
by `commented-test-reason` / `skipped-test-reason` and the `mock-only` / `as-*`
carve-outs, and the indexer surfaces them as cell caveats. A marker at file
scope, inside a helper, or floating in prose belongs to none of those and reads
as a phantom marking. This rule is the **inverse** of the consumers: it flags a
marker that no test-detection window would associate with a test.

"At a test" ([`checks/markerPlacement.ts`](./checks/markerPlacement.ts), TS
scanner + AST) is: in a live test's leading comments (taken from TS trivia, so a
tall multi-line `// TODO[BUG]:` block directly above the test counts in full) or
inside its body; in a `describe`'s leading comments / header (a group-level
marker, NOT its whole body — a file-wrapping `describe` must not whitelist
everything); or in the contiguous comment run that holds a **commented-out** test
(the test it explains may itself be commented). Anything else is flagged.

**Status**: **built** (`error`). Whole matrix: 0 today (was 7 during the ramp —
file-header prose that wrote the literal `TODO[LIMITATION]:` token in a sentence,
e.g. `select.compound-extras.test.ts`, rather than only as a marker at the
commented tests; the prose was reworded to clear them).

### `tautology` — a provably-constant assertion that validates nothing

The general question "is this assertion meaningful?" is unbounded and belongs to
the [quality-gate sub-agent](../../QUALITY_GATE.md) — so this rule stays
**mechanical**: it flags only the shapes that are **provably constant by language
rule**, never a judgement about whether a real assertion is strong enough. Three
forms ([`checks/tautology.ts`](./checks/tautology.ts), AST, no type checker):

- **literal-self-compare** — `expect(<lit>).toBe(<same lit>)` (`expect(true).toBe(true)`,
  `expect(1).toEqual(1)`): a literal compared to an equal literal, always passes.
- **same-expression** — `expect(x).toBe(x)`: the SAME *pure reference*
  (identifier / property / element access, no call) on both sides — pins no
  value. A call (`expect(f()).toBe(f())`) is not pure and is excluded.
- **length-non-negative** — `expect(<x>.length).toBeGreaterThanOrEqual(0)`: an
  array/string `.length` is always ≥ 0, so the bound is vacuous (this was once a
  real `mirror-image` weakening — `else expect(rows.length).toBeGreaterThanOrEqual(0)`).

The line stays sharp — these are **not** flagged: `toBeGreaterThanOrEqual(0)` on a
value the audit cannot prove non-negative (`rows[0]?.month`, an affected-row
count — a real, if weak, bound), a `.not` chain (`expect(x).not.toBe(x)` — its
receiver is `expect(x).not`, not the `expect(x)` call), and `expect(true).toBe(false)`
(distinct literals — a failing assertion, not a tautology).

**Verified**: 17 findings, **all** the `expect(rows.length).toBeGreaterThanOrEqual(0)`
form (the `mirror-image` §`select.value-source.null-and-if-value-modifiers.test.ts:184`
site and its replicas); literal-self-compare and same-expression are **0** today.

**Status**: **built** (`error`), in [`checks/tautology.ts`](./checks/tautology.ts).
The narrowest of the content rules by design — the open-ended "is this assertion
meaningful?" residue stays with the [quality-gate sub-agent](../../QUALITY_GATE.md).

### No-validation rules — `no-assertion-runtime` / `empty-catch` / `weak-boolean`

A second sweep (beyond the original candidate list) for tests that **run but
don't actually validate**. Three mechanical shapes, three rule ids
([`checks/noValidation.ts`](./checks/noValidation.ts), AST, no type checker):

- **`no-assertion-runtime`** — a `test`/`it` that calls an `execute*` method but
  contains NO assertion at all (`expect` / `assertType` / `expectTypeOf` /
  `toThrow`). It runs the query and checks nothing — always green. A pure
  **type-demonstration** test (no `execute*` call — it asserts by compiling, and
  `validate:tests` gates it) is NOT flagged: the 68 no-assertion tests in the
  matrix are all this legitimate kind, so requiring an `execute*` call leaves the
  rule at **anchor 0** — a clean preventive gate against the real cheat (run a
  query, assert nothing).
- **`empty-catch`** — an empty `catch { }` swallows its error unconditionally, so
  the guarded code can never fail the test. **Carve-out** (project decision): a
  **deliberate `throw` inside the try block** — the catch is swallowing the
  test's OWN intentional throw, the mechanism of the scenario. The sole legitimate
  population is the 17 `docs.transaction` rollback tests
  ([`docs.transaction.test.ts:182`](../../db/postgres/newest/pg/docs.transaction.test.ts#L182):
  `throw new Error('roll me back')` … `catch { /* swallow */ }` … `expect(fired).toBe(true)`).
  An empty catch around an `execute*` with **no** such throw is **flagged** — 66
  cases that swallow a real execution failure to assert only the
  interceptor-captured SQL (e.g.
  [`docs.advanced.custom-booleans-values.test.ts:44`](../../db/postgres/newest/pg/docs.advanced.custom-booleans-values.test.ts#L44)):
  a `mock-only` pattern in disguise (per the project author — *"there is no reason
  you can't validate that on the mock without the swallow"*), and one the
  body-scoped `mock-only` rule misses because the swallow is **unconditional**
  (not `catch { if (!realDbEnabled) throw e }`). A backlog of 66 during the ramp,
  worked down to 0 today.
- **`weak-boolean`** — `expect(x).toBeTruthy()` / `toBeFalsy()` pins only
  truthiness, not the value (a truthy/falsy check passes for many results).
  Assert the exact value (`toBe(true)`, the real result). **Anchor: 0** — a
  preventive gate. (A `.not` chain is excluded — its receiver is `expect(x).not`,
  not the `expect(x)` call.)

**Status**: **built** (`error`), in [`checks/noValidation.ts`](./checks/noValidation.ts).
Whole-matrix: all 0 today (`empty-catch`'s ramp anchor was 66, since cleared;
`no-assertion-runtime` and `weak-boolean` were preventive gates at 0).

### `weak-matcher` — an assertion that pins shape/membership, not the value

The project rule (author): **approximate matching is reserved for the two places
exact pinning is genuinely impossible; everywhere else a test has no reason not
to be precise.** A matcher that pins only the *shape* or *membership* of a value
is a weakening: a regression that changes the value but keeps the shape slips
through. Two families ([`checks/weakMatcher.ts`](./checks/weakMatcher.ts), AST, no
type checker):

- **Structural asymmetric matchers** — `expect.arrayContaining` /
  `expect.objectContaining` / `expect.any` / `expect.anything`. They accept
  extras / any type / a partial structure (`arrayContaining([1,2])` passes for
  `[1,2,3]`, in any order). **Flagged everywhere** — they widen a value's *shape*,
  never the right tool for non-determinism (you sort + `toEqual` instead). Anchor
  14, all `expect.arrayContaining` over a non-deterministically-ordered `json_agg`
  in [`docs.aggregate-as-object-array.test.ts:233`](../../db/postgres/newest/pg/docs.aggregate-as-object-array.test.ts#L233);
  fix is the DESIGN §1 JS-reorder remedy `expect(rows.slice().sort()).toEqual([...])`.
- **String-pattern matchers** — `.toContain` / `.toMatch` (direct) and
  `expect.stringMatching` (asymmetric). Weak on a value, but the correct tool in
  the ONE context where the exact string genuinely can't be pinned — a
  **diagnostic blob**, recognised by [`isDiagnosticContext`](./checks/weakMatcher.ts)
  (the asserted expression references `.message`/`.stack`/`.cause`, a catch-bound
  error var, a `reason`/`error`/`stack` helper, or `String(...)` of those —
  covers `(caught as Error).message`, `reasonsInChain(caught)`, and
  `expect(stack).toMatch(/Query executed at/)` where `stack =
  getQueryExecutionStack(...)`). **1037** error-message `.toContain` + **568**
  error/stack `.toMatch` are tolerated.

  **Not tolerated in a real-DB branch.** Tempting (and an earlier draft did it),
  but wrong: a real-engine *string* value is usually deterministic — known seed
  data with only specific columns (an autogenerated `id`, a timestamp) varying —
  so the precise assertion is a `toEqual` with those columns normalised, not a
  `toContain`. [`update.from.test.ts:47`](../../db/postgres/newest/pg/update.from.test.ts#L47)
  `expect(p.name).toContain('Acme Corp')` after `SET name = name || ' / ' ||
  organization.name` looks non-deterministic but the name is fully known; it
  should be `expect(projects.map(({ id, ...r }) => r)).toEqual([...])`. "Pinnable
  vs genuinely non-deterministic string" is not mechanically detectable, so by the
  project principle (permit only a *detectable* valid case) the rule stays strict;
  a genuinely-irreducible real string carries a `tests-audit-disable-next-line`.

**`toBeCloseTo` is NOT here** — a *float* is non-pinnable even with known data
(rounding), unlike a string, so it gets its own real-branch-aware rule
[`close-to`](#close-to--an-approximate-float-comparison-outside-a-real-db-branch),
kept separate so this rule stays rigid (promoted to `error` independently)
without the float case's leniency diluting it.

**Status**: **built** (`error`), in [`checks/weakMatcher.ts`](./checks/weakMatcher.ts).
Whole-matrix: 0 today (was 208 during the ramp — 14 structural + 194 string-pattern
on a value, diagnostic-blob uses tolerated — since worked down).

### `close-to` — an approximate float comparison outside a real-DB branch

`toBeCloseTo` is the right tool in ONE place: a **real-DB branch**
(`if (ctx.realDbEnabled) { … }`), where the real engine's floating-point rounding
can yield `1.999999…` instead of exactly `2` (e.g. `cbrt` emulated as
`sign(x) * power(abs(x), 1.0/3.0)`) — the `mirror-image` APPROX_VALUE remedy.
Outside a real-DB branch the value comes from the mock (exactly what `mockNext`
set), so `toBe` pins it; an approximate comparison there hides a value.

**Kept deliberately separate from `weak-matcher`** (the author's call): the
weak-matcher family should stay rigid and was promoted to `error` on its own
schedule; this more lenient, real-branch-aware float case would dilute it. Detection is the
shared [`isInRealBranch`](./ast.ts). **Anchor: 0** — all 107 `toBeCloseTo` sit in
a real-DB branch today, so it is a clean preventive gate.

**Status**: **built** (`error`), in [`checks/closeTo.ts`](./checks/closeTo.ts).

### `no-op-expect` — an `expect(...)` chain with no matcher invoked

`expect(x)` (or `expect(x).not`, `await expect(p).rejects`) **as a statement**
builds a matcher object and does nothing with it — it looks like an assertion but
validates nothing and always passes (the "forgot the matcher" footgun). It
**slips past** [`no-assertion-runtime`](#no-validation-rules--no-assertion-runtime--empty-catch--weak-boolean):
that rule counts an `expect` call as an assertion, so a test whose only `expect`
is a no-op reads as "has an assertion" when it has none — this rule closes that
gap. There is no legitimate committed use.

Detection ([`checks/noOpExpect.ts`](./checks/noOpExpect.ts), AST): a statement-level
expression (through an optional `await`) that is a bare `expect(...)` call or an
`expect(...)` property chain with no final matcher call. A real matcher call
(`expect(x).toBe(1)`, `await expect(p).rejects.toThrow()`) is a CallExpression
whose callee is the matcher property, so it is fine.

**Status**: **built** (`error`). Anchor 0 — a clean preventive gate.

### `non-deterministic-input` — a non-deterministic JS value used as a query input

`new Date()` (no argument), `Date.now()`, `Math.random()` yield a different value
every run. As a **query input** (a parameter / value source) they make the
emitted params — and the snapshot — non-deterministic, so the test can't have a
stable param snapshot or silently drifts. A fixed `new Date('2024-01-02T03:04:05Z')`
(with arguments) is deterministic and **not** flagged.

**Carve-out — MOCK DATA** (project decision): the same constructors are
legitimate as the value the *mock* returns, simulating what the database produces
for its own `current_date` / `current_timestamp` / `random()` (probing the DB
equivalents). That value flows through `mockNext(...)` — directly
(`ctx.mockNext({ createdAt: new Date() })`) or via a variable passed to it
(`const expected = [{ today: new Date() }]; ctx.mockNext(expected)`). Recognised
structurally ([`checks/nonDeterministicInput.ts`](./checks/nonDeterministicInput.ts):
inside a `mockNext(...)` call, or in a variable whose name is passed to one). The
distinction is the project author's: *"`new Date()` as input data is a problem
because it isn't deterministic; different is a `new Date` with a fixed value, and
different again is probing the DB's equivalents [as mock data]."*

**Status**: **built** (`error`). Anchor 0 — every `new Date()` in the suite today
is mock data (68: 34 direct in `mockNext`, 34 via a variable passed to it); a
clean preventive gate against a non-deterministic input.

## Folder layout

Mirrors the `codeIndexer` / `codeSearcher` convention: the design doc anchors,
the code sits beside it.

```
test/lib/audit/
├── AUDIT.md          ← this file: the anchoring design/requirements doc
├── main.ts           ← orchestrator + CLI entry (scripts/tests-audit.sh execs it)
├── rules.ts          ← RULE_SEVERITY table + the rule registry (CONTENT_RULES)
├── types.ts          ← Severity, Finding
├── ast.ts            ← lineOf + isInRealBranch + markerLines / isNodeInMarkedTest (the marker→enclosing-test span check shared by the carve-outs)
├── reasons.ts        ← the three reason-marker regexes + the derived sets (TODO_BUG, NOT_APPLICABLE_OR_BUG, DISABLED_TEST_REASON, ANY_MARKER) shared across checks
├── walk.ts           ← enumerate cell .test.ts files (the audit's exclusions) + typesNegativeTestFiles (ts-ignore only)
├── ignores.ts        ← `tests-audit-disable-*` parsing + matching + meta-findings
├── report.ts         ← compiler-style output + exit-code tally
├── symmetry.ts       ← the whole-matrix symmetry check (runSymmetryCheck → `symmetry` Findings; config.* exempt)
└── checks/
    ├── mirrorImage.ts ← guard rules (mock-only / mirror-image / one-sided-guard)
    ├── uuidLiteral.ts ← `uuid-literal` (malformed-UUID-looking string literals)
    ├── asAny.ts       ← `as-any` + `any-type` + `as-unknown-as` + `meaningless-cast` + `meaningless-type` + `type-cast` (all the type-bypass / cast rules; TODO[BUG]-exempt)
    ├── markerPlacement.ts ← `misplaced-marker` (a TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE marker not at a test)
    ├── nonPublicApi.ts ← `non-public-api` (relative imports past the public surface)
    ├── commentedTest.ts ← `commented-test-reason` (commented tests need a TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE reason marker — see reasons.ts)
    ├── groupedCommentedTests.ts ← `grouped-commented-tests` (one `/* … */` block holding 2+ commented-out tests — split so each gets its own reason marker)
    ├── focusedTest.ts ← `focused-test` (committed `.only` — skips the rest of the file)
    ├── emptySnapshot.ts ← `empty-snapshot` (un-baked `toMatchInlineSnapshot()` in live code)
    ├── suppressions.ts ← `ts-ignore` / `ts-expect-error` / `eslint-disable-type` / `eslint-disable-other`
    ├── registrationSkip.ts ← `skipped-test-reason` / `skip-real-db` (registration-level skip)
    ├── tautology.ts ← `tautology` (provably-constant assertions: literal-self / same-expr / `.length` ≥ 0)
    ├── noValidation.ts ← `no-assertion-runtime` / `empty-catch` / `weak-boolean` (tests that run but don't validate)
    ├── weakMatcher.ts ← `weak-matcher` (asymmetric matcher / `.toContain`/`.toMatch` on a value; approximate reserved for diagnostic + real-DB branch)
    ├── closeTo.ts ← `close-to` (`toBeCloseTo` outside a real-DB branch; separate, lenient float rule)
    ├── noOpExpect.ts ← `no-op-expect` (an `expect(...)` chain with no matcher invoked)
    └── nonDeterministicInput.ts ← `non-deterministic-input` (`new Date()`/`Date.now()`/`Math.random()` as a query input; mock data carved out)
```

Coordinate matching lives in the **shared** [`test/lib/coords.ts`](../coords.ts)
(`coordMatch` / `cellFromPath`), reused by the searcher's `--coord` — not
duplicated here.

`main.ts` is the entry `scripts/tests-audit.sh` execs; it merges the
`runSymmetryCheck()` Findings with the content-check Findings into one report.
The `$GITHUB_STEP_SUMMARY` count/verdict line is still emitted by `symmetry.ts`.
The references in
[`TEST_LIB.md`](../../TEST_LIB.md), [`README.md`](../../README.md),
[`CLI.md`](../../CLI.md), [`DESIGN.md`](../../DESIGN.md) and
[`DOC_CODE_EXTRACTOR.md`](../../DOC_CODE_EXTRACTOR.md) point at this folder.

## Maintenance contract

The current rule set has already completed this ramp — every rule is `error`
today. The steps below remain the procedure for any **future** rule that lands at
`warn` and is later promoted.

When a rule is **promoted to `error`**:

1. Update the matching entry's **"Gate today"** line in
   [`ANTIPATTERNS.md`](../../ANTIPATTERNS.md) (#1 mirror-image, #2
   stub-as-commented, #4 as-any) from the sub-agent to this audit.
2. Drop the matching check from the sub-agent prompt
   [`../canonical-cell-review-prompt.md`](../canonical-cell-review-prompt.md)
   — per [`QUALITY_GATE.md` § Future](../../QUALITY_GATE.md) the prompt is the
   single point of update.
3. Record the user-visible promotion in [`docs/CHANGELOG.md`](../../../docs/CHANGELOG.md)
   only if it changes anything a consumer observes (usually not — this is
   test-suite infrastructure).

When a doc section this file deep-links into moves (a DESIGN anchor, an
EXTERNAL_CAVEATS subsection), update the link here in the same change.

## How to add a rule

1. **Anchor it.** Find real violations in `test/db/` with file:line, or
   confirm zero. No anchor + unjustified cost → defer.
2. **Pick the engine.** Syntactic (SourceFile) if you can; checker only when
   the rule needs a type.
3. **Decide the legitimate-suppression story.** What carries a
   `tests-audit-disable`, and which documented section the reason cites.
4. Register the rule id + severity in [`rules.ts`](rules.ts) (start `warn`),
   add the check under `checks/`, wire it into `main.ts`.
5. Add the antipattern entry (or update its "Gate pending") in
   [`ANTIPATTERNS.md`](../../ANTIPATTERNS.md).

## Status & roadmap

- **Built**:
  - the whole-matrix symmetry check (`symmetry.ts`, `error` now the
    cross-database migration is done and the matrix is symmetric, sub-second);
  - the framework — severity model (`rules.ts`), the `tests-audit-disable`
    suppression + meta-rules (`ignores.ts`), compiler-style output
    (`report.ts`), the orchestrator (`main.ts`); `--explain` / `--strict` /
    `--all` / `--only`;
  - thirty content rules, **all `error`** today — the warn→error ramp is complete
    (the split into one rule per mechanism is what let each be promoted to `error`
    independently), whole run
    ~1 s (syntactic AST, no type checker). The five type-bypass / cast siblings of
    `as-any`/`any-type` — `as-unknown-as` (62; `x as unknown as T` laundering),
    `meaningless-cast` (170; `as unknown`/`null`/`never`/`void`, incl. `as unknown[]`),
    `meaningless-type` (167; the same four as a type — `unknown`/`null` permitted in
    the same contexts as `as any` + API-mandated uses, so only generic plumbing
    remains), `type-cast` (688; the catch-all for any other `as T`/`<T>x`, `as const`
    exempt) — plus `misplaced-marker` (7; a reason marker not at a test) were
    added last, then `grouped-commented-tests` (88; 2+ commented-out tests sharing
    one `/* … */` block — split so each carries its own reason marker, the
    structural companion to `commented-test-reason`). NOTE: the per-rule counts
    BELOW are the original ramp anchors; after the suite cleanup every content
    backlog is **0** today — the tree is clean for every rule
    (run `tests:audit` for the current tally). Original anchors: `mock-only` (595 — never validates
    against real; exception-only
    skip tests and the listed file-scoped exceptions are carved out, see its
    rule section), `mirror-image`
    (145 — two-sided weak real branch; bounded `random()` is carved out, `toBeNull`/`toBeUndefined` count as exact value), `one-sided-guard` (1567 — only one mode
    validates; non-deterministic results — autogen id, affected-row count,
    insert-from-select, insert-returning-id — are carved out mechanically by
    their producing call, see its rule section), `uuid-literal` (0 — a
    preventive shape gate against malformed-UUID literals that pass mock-only),
    `as-any` (~242; pg cell 15 — casts bypassing the public typed API:
    exception/allow-when/marshalling tolerated, the rest a rewrite backlog),
    and `any-type` (~272; pg cell 16 — `any` type annotations, no carve-outs,
    a rewrite backlog: `unknown` / precise type), and `non-public-api` (0 — a
    preventive gate: src imports must be public `exports`, test/lib imports must
    be admitted helpers), and `commented-test-reason` (555 — commented-out tests
    that lack one of the three reason markers TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE),
    and `grouped-commented-tests` (88 — 2+ commented-out tests crammed into one
    `/* … */` block under a single shared marker; split so each gets its own),
    and `focused-test` (0 — a
    committed `.only`; a clean preventive gate, one of the early promotions), and
    `empty-snapshot` (0 live — un-baked `toMatchInlineSnapshot()`; the 384
    empty placeholders are all in commented-out tests, AST-exempt), and the four
    suppression-comment rules `ts-ignore` (0 anywhere, incl. types.negative; the
    other early promotion), `ts-expect-error` (4 — bypass outside a
    types.negative cell), `eslint-disable-type` (34 — the lint twin of
    as-any/any-type), `eslint-disable-other` (17 — non-type lint suppressions),
    and the two registration-skip rules `skipped-test-reason` (0 — `.skip`/`.todo`
    needs a TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE reason) and `skip-real-db` (0 — `skipIf(realDbEnabled)`
    registration-level mock-only evasion), and `tautology` (17 — all the
    `expect(rows.length).toBeGreaterThanOrEqual(0)` form; only provably-constant
    shapes flagged, the rest stays the sub-agent's call), and the three
    no-validation rules `no-assertion-runtime` (0 — runs a query, asserts
    nothing), `empty-catch` (66 — unconditional swallow of an `execute*`, a
    disguised mock-only; deliberate-throw scenarios carved out), and
    `weak-boolean` (0 — `toBeTruthy`/`toBeFalsy`), `weak-matcher` (208 —
    asymmetric matchers + `.toContain`/`.toMatch` on a value; approximate matching
    tolerated only in a diagnostic blob — a real string is pinnable via
    normalise-then-`toEqual`), and `close-to` (0 — a separate, lenient rule for
    `toBeCloseTo` outside a real-DB branch, where a float genuinely can't pin),
    and `no-op-expect` (0 — an `expect(...)` with no matcher invoked, a no-op that
    slips past `no-assertion-runtime`), and `non-deterministic-input` (0 —
    `new Date()`/`Date.now()`/`Math.random()` as a query input; mock data is
    carved out).
- **Deferred**: none — `as-any` was the last; its residual *intent* judgement
  stays with the [quality-gate sub-agent](../../QUALITY_GATE.md) (see its rule).

**Next steps** — done. The warn→error ramp is complete: every rule is `error`
and the tree is clean (`tests:audit` reports `✖ 0 problems` and
`whole matrix symmetric`). The three migration backlogs that drove the ramp were
worked down in severity order:

1. **`mock-only`** — the least defensible (the engine is never validated). Each
   case was driven on the real engine (`fragmentWithType` / `rawFragment` to
   synthesise off-shape inputs; `toBeCloseTo` for float precision; procedure/
   RETURNING results asserted unconditionally instead of swallowed), then promoted
   to `error`.
2. **`mirror-image`** — the real branch got the same value assertion (JS-sort /
   UPDATE-in-`withRollback`), then promoted.
3. **`one-sided-guard`** — the large backlog: `ORDER BY` / JS-sort so one
   `expect(...).toEqual(...)` passes in both modes; worked down, then promoted.

A future rule that lands at `warn` follows the same path; its promotion runs the
[Maintenance contract](#maintenance-contract).

A `tests-audit-disable` at any tier is rare and must name why the case is
genuinely irreducible.

### Candidate rules — all built

The candidates surfaced by sweeping the matrix for cheat vectors the original
eight rules didn't cover are **all now built** (each anchored on a verified count
per the [How to add a rule](#how-to-add-a-rule) discipline):

- `focused-test` and `empty-snapshot` — the first two proposals.
- the `type-suppression` family — split per the project decision into
  [`ts-ignore`](#suppression-comment-rules--ts-ignore--ts-expect-error--eslint-disable-type--eslint-disable-other),
  `ts-expect-error`, `eslint-disable-type`, `eslint-disable-other` (one rule per
  mechanism, not one monolithic rule). The "Anchor: 301" in the original proposal
  counted the `types.negative/` cells; the walked-set anchors are far smaller.
- the `registration-skip` proposal — split into
  [`skipped-test-reason` / `skip-real-db`](#registration-skip-rules--skipped-test-reason--skip-real-db)
  (the two mechanisms: disabled-needs-reason and the registration-level mock-only
  evasion).
- [`tautology`](#tautology--a-provably-constant-assertion-that-validates-nothing)
  — kept to the provably-constant shapes only; the open-ended "is this assertion
  meaningful?" residue stays the [quality-gate sub-agent](../../QUALITY_GATE.md)'s.

A later sweep (the "anything else to add?" review) surfaced five more, now also
built — the [no-validation rules](#no-validation-rules--no-assertion-runtime--empty-catch--weak-boolean)
`no-assertion-runtime`, `empty-catch`, `weak-boolean`,
[`weak-matcher`](#weak-matcher--an-assertion-that-pins-shapemembership-not-the-value),
and [`close-to`](#close-to--an-approximate-float-comparison-outside-a-real-db-branch)
— plus the `xit`/`xtest`/`xdescribe` extension to `skipped-test-reason`.
`empty-catch` (66 during the ramp) and `weak-matcher` (208) were the ones with
backlogs (since worked down to 0), and
both illustrate the project principle for carve-outs: **"a legitimate use means
we write the rule to recognise it and flag the rest"**, not "a legitimate use
means no rule" — `empty-catch` carves out the deliberate-throw rollback pattern;
`weak-matcher` carves out approximate matching only in a diagnostic blob (error
message / stack trace), staying strict elsewhere — a real-DB *string* is pinnable
(normalise the id/timestamp, then `toEqual`), so the real branch is **not** a
carve-out for it. The float case (`toBeCloseTo`, genuinely non-pinnable even with
known data) was split into its own lenient, real-branch-aware `close-to` rule
rather than diluting weak-matcher's rigidity — the same per-mechanism-split
reasoning as the suppression family.

A second "anything else?" sweep added two more clean preventive gates (both
anchor 0): [`no-op-expect`](#no-op-expect--an-expect-chain-with-no-matcher-invoked)
(closes a gap in `no-assertion-runtime`) and
[`non-deterministic-input`](#non-deterministic-input--a-non-deterministic-js-value-used-as-a-query-input)
(`new Date()` etc. as a query input, mock data carved out). The same sweep
*declined* several candidates after measuring — `new Date()` mock values (not
inputs), `toBeNull`/`toBeInstanceOf`/`toBeDefined` (dominated by precise /
exception-validation uses), `assertType<Extends>` (utility-type demos vs a
weakened result type) — all intent-level, the [Boundary](#boundary)'s sub-agent
territory.

The detector's growth surface has moved past *adding rules* and past **working
down the `warn` backlogs and promoting rules to `error`** — both are now done
(every rule is `error`, the tree is clean; see Next steps above). What remains is
adding new rules only as fresh cheat vectors are observed.
