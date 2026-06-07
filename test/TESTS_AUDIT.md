# Using `tests:audit`

`bun run tests:audit` (or `npm run tests:audit`) is the **mechanical anti-cheat
check** for the `test/` matrix. It walks `test/db/` statically — no docker, no
WASM, no database — and reports tests that have been weakened to pass
dishonestly, or whose structure diverges from the symmetry rule.

This page is for an agent **using** the tool: how to run it, what a finding
means, how to fix or (rarely) suppress one, and — important — how to **propose a
new valid pattern** when you believe a finding is legitimate. The internal design
(the AST engine, the matcher classification, how each check is built) lives in
[`lib/audit/AUDIT.md`](lib/audit/AUDIT.md) and you do **not** need it to use the
tool.

**Scope.** The audit's rules are **universal anti-cheat patterns** —
semantic shapes a cheat would adopt regardless of which database the cell
tests. Defences that depend on **which DB/connector the cell uses**
(Bun#29010 wraps in `bun_sql_postgres`, `sqlite3` BigInt skips, sqlite
`uuid_str` registration, MySQL no-RETURNING, …) are **out of scope** for
`tests:audit`. Those live in [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md)
(the catalogue), the validation sub-agent's `EXTERNAL_CAVEATS` sweep on
the canonical ([`QUALITY_GATE.md`](./QUALITY_GATE.md)), and the mechanical
re-wrap step in
[`COVERAGE_RUNBOOK.md` § Propagation](./COVERAGE_RUNBOOK.md#propagation)
on every sibling cell. Do not file a proposal asking the audit to enforce
a per-connector caveat — it will not move here.

## Run it

```bash
bun run tests:audit                       # whole matrix
bun run tests:audit postgres/newest/pg    # one cell (same coord grammar as `tests`)
bun run tests:audit 'postgres/*/pg'       # globs / {a,b} braces work
bun run tests:audit --only weak-matcher   # a single rule
bun run tests:audit --explain             # print a fix hint per finding
bun run tests:audit --all                 # list every finding (default groups large backlogs)
bun run tests:audit --strict              # treat every warning as an error (trial a promotion)
bun run tests:audit --help
```
Under `npm run`, put flags behind `--`: `npm run tests:audit -- --only weak-matcher --all`.

Exit code is `0` unless there is an **error**-severity finding. Scope with a coord
while iterating; run the whole matrix before pushing. **CI runs the whole-matrix
form on every push** — an `error`-severity finding (today: `symmetry` and the
suppression meta-rules; tomorrow: any rule that gets promoted, see § Severities)
blocks the merge.

## Read a finding

The output is eslint/oxlint-style — findings grouped by file, then `line
severity message rule`, and an `✖ N problems` summary with a per-rule tally:

```
test/db/postgres/newest/pg/select.distinct.test.ts
  30  warning  real-DB branch only asserts rows.length; value never validated against an engine  mirror-image

rules: mirror-image 1
✖ 1 problem (0 errors, 1 warning)
```

Add `--explain` for a fix hint under each finding:

```
test/db/postgres/newest/pg/select.distinct.test.ts
  30  warning  real-DB branch only asserts rows.length; value never validated against an engine  mirror-image
      └─ Give both branches the same value assertion: sort the unstable dimension in JS,
         then `toEqual` — see ANTIPATTERNS.md #1 (mirror-image).
```

Most rules are `warning` today (a backlog you should work down); a few are
`error` (they fail the build).

## What each rule catches — and how to fix it

The principle behind every rule: **the suite's job is to validate the generated
SQL + params + result type + result value, against both the mock and (under
`--docker`) the real engine.** Anything that quietly stops doing that is a
finding. Fix a finding by making the test validate honestly — never by hiding it.

**Real-DB validation (the test must run and check the value in both modes)**
- `mock-only` — the test never validates against the real engine (`if (ctx.realDbEnabled) return`, or a `catch` that only rethrows on the mock). Drive the case on the real engine; use `fragmentWithType` / `rawFragment` to synthesise an off-shape input the engine can't produce naturally; `toBeCloseTo` for float precision.
- `mirror-image` — a two-sided `ctx.realDbEnabled` guard where one branch checks the value and the other only checks shape (`.length`, `Array.isArray`, `typeof`). Give both branches the same value assertion (sort the unstable dimension in JS, then `toEqual`).
- `one-sided-guard` — only one mode validates the value. Assert it unconditionally — add `ORDER BY` / JS-sort so one `toEqual` passes in both modes.
- `skip-real-db` — `test.skipIf(ctx.realDbEnabled)` / `runIf(!ctx.realDbEnabled)`: a registration-level mock-only evasion. Let the test run in both modes.
- `uuid-literal` — a string that looks like a UUID but isn't valid `8-4-4-4-12` hex. The mock accepts any string but a real engine's `uuid` cast rejects it, so it passes mock-only and fails under `--docker`. Fix the literal (use the shared valid test UUID).

**The test must actually assert something real**
- `no-assertion-runtime` — runs a query (`execute*`) but has no assertion at all. Assert SQL, params, result type (`assertType`), and value.
- `no-op-expect` — an `expect(...)` with no matcher invoked (`expect(x)`, `await expect(p).rejects`). Call a matcher.
- `empty-catch` — an empty `catch { }` swallows the error. Assert the caught error, or remove the try/catch. (A deliberate `throw` in the try — to drive a rollback — is allowed.)
- `empty-snapshot` — `toMatchInlineSnapshot()` with no argument pins nothing. Bake it (`--update-snapshots`).
- `tautology` — a provably-constant assertion (`expect(true).toBe(true)`, `expect(x.length).toBeGreaterThanOrEqual(0)`). Assert the real value.
- `weak-boolean` — `toBeTruthy()` / `toBeFalsy()` pin only truthiness. Assert the exact value.
- `weak-matcher` — `expect.arrayContaining`/`objectContaining`/`any`/`anything`, or `.toContain`/`.toMatch` on a value. Pin the value (sort + `toEqual`; normalise a non-deterministic `id`/timestamp with `rows.map(({ id, ...r }) => r)` then `toEqual`; the full SQL `toMatchInlineSnapshot`). Pattern matching is allowed only on a diagnostic blob — an error message or a stack trace.
- `close-to` — `toBeCloseTo` outside a real-DB branch. The mock returns exact values, so `toBe` them; guard a genuine float approximation behind `if (ctx.realDbEnabled)`.

**Build through the public typed API — don't silence the type checker**
- `as-any` — a cast to `any`. Build the query the supported way. (Feeding an invalid value to a runtime guard in an exception test is tolerated.)
- `any-type` — an `any` type annotation. Use the precise type, or `unknown` for a caught error.
- `ts-ignore` — `@ts-ignore` / `@ts-nocheck`: forbidden everywhere. A negative-type assertion uses `@ts-expect-error` inside a `types.negative/` cell.
- `ts-expect-error` — outside a `types.negative/` cell. Build through the public API; a real negative-type assertion belongs in `types.negative/`.
- `eslint-disable-type` / `eslint-disable-other` — an `eslint-disable` of a type-soundness lint (`no-explicit-any` …) / any other lint. Fix the code instead.
- `non-public-api` — a relative import past the public surface (into `src/` internals, or a non-admitted `test/lib/` helper). Import only the public library API and the admitted helpers.

**Don't disable or fake tests silently**
- `commented-test-reason` — a commented-out test with no reason. Add one of the three first-class markers (see below), or re-enable it.
- `skipped-test-reason` — `test.skip` / `test.todo` / `xit` … needs the same reason marker as a commented-out test.
- `focused-test` — a committed `test.only` / `describe.only`: it silently skips the rest of the file. Remove `.only`.
- `non-deterministic-input` — `new Date()` (no arg), `Date.now()`, `Math.random()` used as a query input make the params non-deterministic. Use a fixed value (`new Date('2024-01-02T03:04:05Z')`). These are allowed only as **mock data** passed to `mockNext`, simulating the database's own `current_date` / `random()`.

**Structure**
- `symmetry` (always `error`) — every cell of a database must declare the same `.test.ts` files with the same test names in the same order (executed OR commented out). Keep the cells mirror images.

## Disabling a test — the three reason markers

A disabled test (commented out, or `.skip` / `.todo`) still counts for symmetry —
it stays in every cell — so it can never be dropped silently. It must carry
**exactly one** of three first-class markers, with a mandatory reason after the
colon. Pick by the test's **future**:

| Marker | Cause | Pending? | Re-enables in THIS cell? | Runs in another cell? | Tracked |
|---|---|---|---|---|---|
| `// TODO[BUG]: <reason>` | a defect in `src/` — the library *should* do this but fails today | yes, fix it | when the bug is fixed | normally no | `BUGS.md` |
| `// TODO[LIMITATION]: <reason>` | the library doesn't cover it *yet* (by choice) / the env can't | yes, could be covered | if the decision/env changes | normally no | `LIMITATIONS.md` |
| `// NOT-APPLICABLE: <reason>` | a deliberate **dialect boundary** (e.g. `START WITH … CONNECT BY` is Oracle-only) | **no — nothing pending** | **never** | **yes — it runs and validates where the dialect supports it** | symmetry + the dialect's `types.negative/` |

A `TODO[*]` means there is pending work that could re-enable the test **here**;
`NOT-APPLICABLE` is permanent and the test only ever runs **elsewhere**. Use
`NOT-APPLICABLE` for a by-design boundary — **never** `TODO[NOT-APPLICABLE]` ("TODO"
wrongly implies pending work). The markers are uppercase + hyphen, so prose like
`// Not applicable on PostgreSQL: …` does **not** satisfy the rule — write the
canonical `// NOT-APPLICABLE: …`. The reason should name the boundary (which
dialect/feature) and, where useful, where the test *does* run.

## Suppress a finding — rarely, with a reason

> **Not the same as disabling a test that doesn't apply to a database.** These
> are two different mechanisms — don't confuse them:
> - **The test does not apply to this database / is blocked by a bug** → you
>   **comment the test out** (or `test.skip` it) and mark *why* with one of the
>   three first-class reason markers (below). The test stops running but **stays
>   counted for symmetry** (it must exist, commented, in every cell). This is
>   governed by `commented-test-reason` / `skipped-test-reason`, NOT by
>   `tests-audit-disable`. See [`WRITING_TESTS.md`](./WRITING_TESTS.md).
> - **A live test genuinely cannot satisfy one specific audit rule** (it still
>   runs, the rule's complaint is irreducible) → you **`tests-audit-disable`**
>   that one rule on that line, below. The test keeps running and validating;
>   only the rule's warning is silenced.

If a finding is genuinely irreducible **for a test that still runs** (a
driver-specific error the mock can't model, a value a mode truly can't predict),
suppress that one rule on the line **directly above** the flagged code:

```ts
// tests-audit-disable-next-line one-sided-guard -- engine-autogenerated id; can't be predicted on the real DB
if (!ctx.realDbEnabled) expect(id).toBe(1)
```

`// tests-audit-disable-next-line <rule> -- <reason>` (eslint/oxlint syntax; also `tests-audit-disable-line` as a trailing comment). The **reason is mandatory** (a
suppression with no reason is itself an error). Keep these **rare** — they are a
visible admission in the diff that a test can't fully validate. Most findings
should be *fixed*, not suppressed; a test that doesn't apply to the database is
*commented out with a TODO marker* (above), not `tests-audit-disable`d.

## Severities

Today every content rule is `warning` (a backlog); `symmetry` and the
suppression meta-rules are `error`. Rules get **promoted to `error`** once the
tree is clean for them — so a rule that is `warning` for you now may be `error`
later. Treat warnings as real work, not noise. `*.generated.test.ts` files are
exempt from every check.

## Proposing a new valid pattern (or a new rule)

The rule set is **not frozen**. As the suite grows you may hit a finding that is
actually a **legitimate pattern the rule doesn't yet recognise**, or spot a cheat
vector no rule covers. When you do, **propose it** — but under the criteria the
detector is built on. Do not just silence it.

**The criteria (non-negotiable):**

1. **Strict by default.** A test has no reason not to be precise. We *soften* a
   rule (add a carve-out) **only** when there is a genuinely valid case AND we can
   **mechanically detect** it. "It's sometimes legitimate" is not enough — if the
   legitimate case can't be told apart from a cheat by a syntactic signal, it
   stays flagged and the rare real case carries a `tests-audit-disable-next-line`.

2. **A legitimate use means we write the rule to *recognise* it and flag the
   rest** — never "a legitimate use means drop the rule". If `.toContain` is right
   for an error message but wrong for a result value, the carve-out recognises the
   *error-message context* and keeps flagging the result-value use.

3. **Carve-outs must be SEMANTIC anchors, not FORM.** Anchor on something a cheat
   wouldn't fake: a producing call (`returningLastInsertedId`), an error/diagnostic
   context (`.message` / a stack trace), a deliberate `throw` in a try, a real-DB
   branch for floats. A form-based carve-out (a shape any cheat can copy) opens a
   hole — avoid it.

4. **Anchor the proposal on a measured count.** Before proposing, find the real
   occurrences in `test/db/` (`tests:audit --only <related-rule> --all`, or grep)
   and either show the genuine cases or confirm zero. No anchor, no rule.

5. **Intent stays with the human / the quality-gate sub-agent.** "Is this
   assertion *good enough*?" is a judgement call, not a mechanical check. If
   separating valid from cheat needs reading and opining, it is **out of scope**
   for this tool — say so and leave it.

**How to propose:** open an issue / note for the maintainer (or, if you are
extending the tool, follow [`lib/audit/AUDIT.md` § How to add a rule](lib/audit/AUDIT.md#how-to-add-a-rule))
with: the pattern, real file:line examples, why it is genuinely irreducible (for a
carve-out) or genuinely a cheat (for a new rule), and the **detectable signal**
that distinguishes it. A proposal without a detectable signal is a request for a
`tests-audit-disable`, not a rule change.
