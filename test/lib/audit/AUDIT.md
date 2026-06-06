# Tests Audit

The **mechanical anti-cheat enforcement** for the `test/` matrix — the tool
behind `bun run tests:audit`. It walks `test/db/` statically (no docker, no
WASM, no DB) and **fails** (exit 1) when a test has been weakened to pass
dishonestly, or when its structure diverges from the symmetry rule.

> **Just want to run it?** `bun run tests:audit --help`, and read which rules
> are live today under each entry's **"Gate today"** line in
> [`../../ANTIPATTERNS.md`](../../ANTIPATTERNS.md). This file is the
> **anchoring design/requirements doc** — the threat model, the rules, the
> suppression mechanism, the engine, and how to extend it. It is the source
> of truth for *why the tool is shaped this way*; the per-rule normative
> rules themselves live in [`../../DESIGN.md`](../../DESIGN.md).

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

The one deliberate, time-boxed exception is the **severity ramp**: a new
content rule lands as `warn` (reported, exit 0) and is promoted to `error`
(exit 1) once the tree is clean for it (see [Severity model](#severity-model)).
The warning phase is informative *with a committed promotion plan*, not a
permanent state. The pre-existing **symmetry check stays `error`** throughout
— its behaviour does not change.

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

- **Syntactic rules** (`mirror-image`, `as-any`) need only `ts.SourceFile`
  ASTs — no type checker — so they stay fast even over the full ~2.5k-file
  matrix.
- **Type-aware rules** (`uuid-literal`) need a `ts.Program` + checker to know
  a literal's static type. That is the slow lane; separate it by *cost of
  analysis*, not by a `--quick`/`--deep` mode split. Measure and report the
  type-aware pass's wall time.

The classic `typescript` package (not tsgo — no programmatic API yet), same
choice the [indexer](../codeIndexer/CODE_INDEXER.md) made.

**Exclusions** mirror the symmetry check: skip `domain/` and
`types.negative/` dirs, the `documentation` connector, the `general` db, and
`*.generated.test.ts`. If an AST parse fails on a file, **skip it with a
warning — do not abort the whole audit**.

### Severity model

A declarative table in [`rules.ts`](rules.ts):

```ts
export const RULE_SEVERITY = {
  'mirror-image':           'warn',
  'as-any':                 'warn',
  'uuid-literal':           'warn',
  // meta-rules that protect the suppression mechanism — `error` from day 1:
  'disable-without-reason': 'error',
  'unknown-rule':           'error',
  'unused-ignore':          'warn',
}
```

- Exit 1 **iff** there is ≥1 finding of severity `error`. The symmetry check
  is `error` always.
- Promoting a rule is a one-line `'warn'` → `'error'` edit, recorded in the
  commit + changelog.
- `--strict` raises every `warn` to `error` (to trial a promotion before
  committing it). `--only <rule-id>` runs a single rule. `--explain` adds the
  violated rule + a fix hint. The audit stays invocable with **no arguments**
  for CI.

### The `tests-audit-ignore` suppression comment

Linter-style (Biome's mandatory-reason convention), the inline allowlist
anchored **in the code** — it travels with the test and shows up in the diff,
so a cheat leaves a visible trail a reviewer sees.

Grammar — on the line immediately above the flagged node:

```ts
// tests-audit-ignore mirror-image: engine-autogenerated id; see
// EXTERNAL_CAVEATS § "Could test more if real DB were on"
if (!ctx.realDbEnabled) expect(id).toBe(1)
```

`// tests-audit-ignore <rule-id>: <non-empty reason>`. The reason should cite
the documenting section ([`EXTERNAL_CAVEATS.md`](../../EXTERNAL_CAVEATS.md)
hosts the finite legitimate-guard set) where one applies; the format is free,
the **reason is mandatory**.

The **meta-rules are `error` from day 1** even while the real rules are
`warn`, because they guard the suppression mechanism itself — the cheat
vector is silencing the rule quietly:

- `tests-audit-ignore mirror-image` with no `: reason` → **error**
  (`disable-without-reason`). You cannot silence without justifying.
- `tests-audit-ignore <unknown-rule>` → **error** (`unknown-rule`). You cannot
  pre-disable by mistyping an id.
- a `tests-audit-ignore` that matches no violation (stale) → **warn**
  (`unused-ignore`), promotable — stops dead suppressions accumulating.

Anchor suppressions by content (rule-id + reason in code), **never** by
`file:line` in an external file — the canonical cells shift lines on every
snapshot bake.

### Output

Compiler-style, editor-parseable; report **all** violations, then fail (never
bail on the first):

```
test/db/postgres/newest/pg/select.distinct.test.ts:30: warning [mirror-image]: real-DB branch only asserts rows.length; value never validated against an engine
test/db/.../foo.test.ts:12: error [disable-without-reason]: tests-audit-ignore needs a reason after ':'

2 findings: 1 error, 1 warning
```

Keep the symmetry check's `$GITHUB_STEP_SUMMARY` emission; add rows for the
content findings. English output.

## The rules

Each rule is anchored to **real evidence in the repo today**. The discipline
(from the searcher's [CASE_STUDIES.md](../codeSearcher/CASE_STUDIES.md)):
*build the case, verify against the tree, let the verification decide.* If a
rule has no anchor and its cost isn't justified, say so and defer — don't ship
enforcement for something that has never happened.

### `mirror-image` — value assertion guarded by `realDbEnabled`

**Rule** ([`DESIGN.md` § Principle 1](../../DESIGN.md#principles), verbatim):
*"The value assertion is identical in both modes — never guard it.
`expect(result).toEqual(expected)` runs unconditionally."*

**Signal** (AST): a strong value assertion (`toEqual` / `toBe` / `toMatchObject`
on the result) that sits inside, or whose execution depends on, a
`ctx.realDbEnabled` guard (if/else **or** early return). Covers both
documented forms — skip-real (`if (ctx.realDbEnabled) return; expect.toEqual`)
and mirror-image (`if(!realDbEnabled){toEqual}else{weak}`).

**Anchor** — the same syntactic shape is a cheat in one place and legitimate
in another, which is *why* it needs `tests-audit-ignore` (structure cannot tell
them apart):

- CHEAT — [`postgres/newest/pg/select.distinct.test.ts:29-30`](../../db/postgres/newest/pg/select.distinct.test.ts#L29-L30):
  `if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)` /
  `else expect(rows.length).toBeGreaterThanOrEqual(1)`.
- WORSE (real branch asserts nothing) — `select.distinct.test.ts:54`:
  `if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)` with no `else`.
- LEGITIMATE — [`postgres/newest/pg/sequence.next-current-value.test.ts:60-61`](../../db/postgres/newest/pg/sequence.next-current-value.test.ts#L60-L61):
  a sequence value is genuinely non-deterministic on a real engine.

The finite legitimate set is documented in
[`EXTERNAL_CAVEATS.md` § "Could test more if real DB were on"](../../EXTERNAL_CAVEATS.md):
`insert-returning` (autogenerated id), `select-page` (count), hook tests,
sequence non-determinism. Those carry a `tests-audit-ignore mirror-image`
citing that section. **Do not flag** `if (!ctx.realDbEnabled) return` that
skips the mock entirely (real-only — the opposite of a cheat).

**Surface**: 96 canonical files use `realDbEnabled` across 24 cells. Report
each violation once per real site (dedupe per cell / per file — do not
multiply by the matrix).

**Status**: designed, not built.

### `as-any` — cast outside the sanctioned runtime-guard form

**Rule** ([`DESIGN.md` § The `as any` runtime-guard exception](../../DESIGN.md#as-any-runtime-guard)):
the only permitted `as any` in a test body is the cast at the **narrowest**
fluent step, to reach a runtime guard the typer blocks on purpose, with a
comment. Sanctioned shape: `(ctx.conn.deleteFrom(tIssue) as any).executeDelete()`.

**Signal**: an `AsExpression` to `any` (or `as unknown as`) that is **not** a
narrow `(expr as any).member` in a runtime-guard context. Use the AST to
distinguish a narrow cast (parenthesised over one fluent step, followed by
member access) from a whole-chain cast.

**Anchor**: 1277 instances (24 canonical files), **all** in the sanctioned
form today. This is a **preventive** gate keeping the count at zero — it
recognises the form structurally, it is **not** a 1277-line allowlist.
Worked examples: `errors.processing.test.ts`, `insert.default-values.test.ts`.

**Status**: designed, not built.

### `uuid-literal` — invalid literal in a typed parameter position

**Signal**: a string literal in a parameter position whose static type is
`uuid` and whose value does not match the UUID format. Requires the checker.

**Narrow by design**: do **not** generalise to "any value a mock accepts but a
real engine rejects" — that is the unbounded question the searcher refused
(see [Boundary](#boundary)). UUID-format only, on `uuid`-typed literals.

**Anchor**: zero violations today (every UUID is the valid shared constant
`'123e4567-e89b-12d3-a456-426614174000'`). No anchor → purely preventive, of a
cheat vector the user named explicitly; it starts green. During the survey,
if the checker cost isn't justified for zero cases, propose deferring it until
the first real case appears.

**Status**: designed, not built; candidate to defer.

## Folder layout

Mirrors the `codeIndexer` / `codeSearcher` convention: the design doc anchors,
the code sits beside it.

```
test/lib/audit/
├── AUDIT.md          ← this file: the anchoring design/requirements doc
├── main.ts           ← orchestrator + CLI entry (what scripts/tests-audit.sh execs)   [planned]
├── rules.ts          ← RULE_SEVERITY table + the rule registry                        [planned]
├── ignores.ts        ← `tests-audit-ignore` parsing + violation matching              [planned]
├── report.ts         ← compiler-style output + $GITHUB_STEP_SUMMARY + exit code       [planned]
├── symmetry.ts       ← the symmetry check; the current CLI entry until main.ts lands  [exists]
└── checks/
    ├── mirrorImage.ts                                                                  [planned]
    ├── asAny.ts                                                                        [planned]
    └── uuidLiteral.ts                                                                  [planned]
```

The symmetry check already moved here from `test/lib/auditTestSymmetry.ts`;
[`scripts/tests-audit.sh`](../../../scripts/tests-audit.sh) execs
`test/lib/audit/symmetry.ts`, and the references in
[`TEST_LIB.md`](../../TEST_LIB.md), [`README.md`](../../README.md),
[`CLI.md`](../../CLI.md), [`DESIGN.md`](../../DESIGN.md) and
[`DOC_CODE_EXTRACTOR.md`](../../DOC_CODE_EXTRACTOR.md) point at the new
location. When the content rules land, `main.ts` becomes the entry the script
execs and `symmetry.ts` becomes one module among the checks.

## Maintenance contract

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
   `tests-audit-ignore`, and which documented section the reason cites.
4. Register the rule id + severity in [`rules.ts`](rules.ts) (start `warn`),
   add the check under `checks/`, wire it into `main.ts`.
5. Add the antipattern entry (or update its "Gate pending") in
   [`ANTIPATTERNS.md`](../../ANTIPATTERNS.md).

## Status & roadmap

- **Built**: the symmetry check ([`symmetry.ts`](./symmetry.ts), `error`
  severity, sub-second, regex line-based).
- **Designed, pending survey + approval**: `mirror-image`, `as-any`,
  `uuid-literal`, the severity model, the `tests-audit-ignore` mechanism, the
  compiler-style output, and the folder migration above.

Before building, the implementing agent produces: an evidence survey per rule
(real violations today, with file:line, or zero + a build/defer call); the AST
design per rule (which nodes, how sanctioned-vs-cheat is distinguished,
expected false positives on the legitimate cases); the real cost (lines,
whether a `ts.Program` is needed, time, any new dependency — the project
avoids dependencies, justify any); the phasing (an MVP of one rule that proves
the architecture — severity + `tests-audit-ignore` + output — then the rest);
and the warn→error promotion plan (what to retrofit with `tests-audit-ignore`
in the existing legitimate guards before each promotion).
