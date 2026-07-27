// Reason markers that justify a DISABLED test (commented-out, or `.skip` /
// `.todo` / `x{it,test,describe}`). A disabled test still counts for symmetry —
// it must stay in every cell of the dialect — so it can never be dropped
// silently; it must instead carry exactly one of four FIRST-CLASS, mutually
// distinct markers, each with a non-empty reason after the colon. The four are
// semantically different and have different futures:
//
//   - `TODO[BUG]: <reason>`        a defect in `src/`: the library SHOULD do this
//                                  but fails today. Temporary — re-enabled in THIS
//                                  cell once the bug is fixed. Tracked in BUGS.md.
//   - `TODO[LIMITATION]: <reason>` the library does NOT cover this yet (by choice,
//                                  for now) or the harness can't drive it. Potentially
//                                  temporary — could re-enable in THIS cell if the
//                                  decision changes. Tracked in LIMITATIONS.md.
//   - `NOT-SUPPORTED: <reason>`    the EXTERNAL system can't run it: the engine (any
//                                  version, or this version), its build, or the driver.
//                                  The API is callable — nothing in the type surface
//                                  stops it — the runtime simply rejects or mis-evaluates
//                                  the SQL. Permanent HERE: no change in this repo
//                                  re-enables it; only upgrading/replacing the external
//                                  system would. Not pending work, so NOT a TODO.
//                                  Tracked in ENGINE_SUPPORT.md.
//   - `NOT-APPLICABLE: <reason>`   a deliberate DIALECT BOUNDARY: this cell will
//                                  NEVER validate this test against its real engine,
//                                  by design. Permanent — nothing pending, nothing
//                                  to fix or add. The same test DOES run and validate
//                                  in the cells whose dialect supports it (and usually
//                                  has a `types.negative/` counterpart here). Two
//                                  shapes: the test is COMMENTED OUT (kept only for
//                                  symmetry), OR it stays LIVE but mock-only — the SQL
//                                  is still worth asserting via the mock here. Because
//                                  it is permanent (not pending work), NOT-APPLICABLE
//                                  is the ONLY marker that licenses a live mock-only
//                                  test (`mock-only` / `skip-real-db` carve-out in
//                                  ast.ts `isNotApplicableTest`); a TODO does not.
//
// NOT-SUPPORTED vs NOT-APPLICABLE — both are permanent, but they differ in WHO
// draws the boundary, and only NOT-APPLICABLE keeps a live test:
//   - NOT-APPLICABLE: the TYPE SURFACE draws it (the method is not typed on this
//     connection / the overload is `never`), so the call cannot even be written
//     here; the SQL is still worth asserting via the mock where the API exists.
//   - NOT-SUPPORTED: the RUNTIME draws it. The call compiles and the library emits
//     SQL; the engine/driver rejects it, lacks the function, or evaluates it wrong.
//     There is nothing to assert — a mock run would only replay the suite's own
//     seeded values through a query no engine of this cell can execute — so the
//     test stays COMMENTED OUT. It is deliberately absent from MOCK_ONLY_LICENSE
//     and NOT_APPLICABLE_OR_BUG_REASON for exactly that reason.
//
// NOT-SUPPORTED vs TODO[LIMITATION] — the decision rule is "is there a change in
// THIS repo that re-enables the test in THIS cell?". A `src/` gap the author chose
// not to close, or a harness the suite could grow, is LIMITATION (actionable debt,
// LIMITATIONS.md). If only an external upgrade would do it — a newer engine
// release, an ICU/extension build, a driver that grows an API — it is NOT-SUPPORTED
// (ENGINE_SUPPORT.md), no matter how plausible that upgrade looks. An in-repo close
// path counts only when it covers EVERY connector of the dialect: a workaround that
// would rescue three SQLite runners and leave two behind does not make the gap
// actionable debt.
//
// NOT-APPLICABLE and NOT-SUPPORTED are their OWN categories, NOT
// `TODO[NOT-APPLICABLE]` / `TODO[NOT-SUPPORTED]` sub-tags: the word "TODO" implies
// pending work, which is exactly wrong for a permanent boundary, and it would
// pollute LIMITATIONS.md (actionable debt) with boundaries nobody in this repo will
// ever close. The markers are uppercase + hyphen so they are deliberate and
// greppable; prose like `// Not applicable on PostgreSQL: …` does NOT match (it must
// be migrated to the canonical form to satisfy the rule). The `\S` after the colon
// makes the reason mandatory — a bare marker still fails.
//
// CLASSIFYING by category (NOT-APPLICABLE vs NOT-SUPPORTED vs LIMITATION vs BUG) is the indexer /
// searcher's job (`tests:index` / `tests:where-is`); the audit only checks that a
// disabled test HAS one of the four. Keep the markers exported separately so a
// future per-category view here would not have to re-derive them.
//
// A FIFTH marker, `MOCK-ONLY: <reason>`, is deliberately NOT one of the four:
// it does not describe a DISABLED test at all. It licenses a LIVE, fully-running
// test that asks for `ctx.mockOnlyConnection()` — the mock is that test's INPUT
// DEVICE (a value no real driver of any connector hands back, an injected fault),
// so the body executes and asserts in EVERY mode; what it cannot claim is that a
// real engine produced the input. It is its own category because it is neither a
// dialect boundary (NOT-APPLICABLE — those DO validate in the dialects that
// support them; a MOCK-ONLY test validates against no engine anywhere), nor
// pending work (a TODO). Keeping it separate is what stops the searcher's
// `--not-applicable` view from reading a suite-wide construction as per-dialect
// debt.

/** `MOCK-ONLY: <reason>` — why a LIVE test needs `ctx.mockOnlyConnection()`. */
export const MOCK_ONLY_REASON = /MOCK-ONLY\s*:\s*\S/

/**
 * The markers that license a live `ctx.mockOnlyConnection()` call: its own
 * `MOCK-ONLY`, plus the two that already license a live mock-only test
 * (a dialect boundary, or a bug repro that stays mock-only until fixed).
 */
export const MOCK_ONLY_LICENSE = /(?:MOCK-ONLY|NOT-APPLICABLE|TODO\[BUG\])\s*:\s*\S/

/** `TODO[BUG]: <reason>` or `TODO[LIMITATION]: <reason>` — the two TODO markers. */
export const TODO_REASON = /TODO\[(?:LIMITATION|BUG)\]\s*:\s*\S/

/** `TODO[BUG]: <reason>` — a reproducible defect in `src/`. */
export const TODO_BUG_REASON = /TODO\[BUG\]\s*:\s*\S/

/** `NOT-APPLICABLE: <reason>` — a permanent dialect boundary (NOT a TODO). */
export const NOT_APPLICABLE_REASON = /NOT-APPLICABLE\s*:\s*\S/

/**
 * `NOT-SUPPORTED: <reason>` — the external system (engine, engine version, build
 * or driver) cannot run it. Permanent HERE and NOT a TODO: no change in this repo
 * re-enables it. Deliberately absent from the mock-only licences — the call
 * compiles but no engine of this cell can execute it, so the test stays commented
 * out rather than running against a mock.
 */
export const NOT_SUPPORTED_REASON = /NOT-SUPPORTED\s*:\s*\S/

/**
 * `NOT-APPLICABLE` OR `TODO[BUG]` — the two markers that license a LIVE test to
 * skip real-DB validation (the `mock-only` / `skip-real-db` carve-out): a dialect
 * boundary, or a reproducible bug whose repro stays mock-only until fixed.
 * `TODO[LIMITATION]` is deliberately NOT here.
 */
export const NOT_APPLICABLE_OR_BUG_REASON = /(?:NOT-APPLICABLE|TODO\[BUG\])\s*:\s*\S/

/** Any of the four first-class markers with a non-empty reason. */
export const DISABLED_TEST_REASON = /(?:TODO\[(?:LIMITATION|BUG)\]|NOT-APPLICABLE|NOT-SUPPORTED)\s*:\s*\S/

/**
 * Every marker, WITHOUT requiring a reason — the four first-class ones plus
 * `MOCK-ONLY`. Used by the `misplaced-marker` rule to locate every marker
 * occurrence (a missing reason is the `commented-test-reason` /
 * `skipped-test-reason` / `mock-only` rules' concern, not this one).
 */
export const ANY_MARKER = /(?:TODO\[(?:LIMITATION|BUG)\]|NOT-APPLICABLE|NOT-SUPPORTED|MOCK-ONLY)\s*:/
