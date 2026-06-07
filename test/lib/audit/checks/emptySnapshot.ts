// Rule `empty-snapshot` — an empty `toMatchInlineSnapshot()` in live code.
//
// Threat: `expect(ctx.lastSql).toMatchInlineSnapshot()` with NO argument pins
// nothing — on the next run the matcher auto-fills the baked value and the
// assertion always passes. So it *looks* like it asserts the SQL/params but
// asserts nothing until baked: a weak assertion disguised as a snapshot. A cell
// committed with un-baked snapshots reports green while validating nothing.
//
// Engine: AST (no type checker). An empty-arg call to `toMatchInlineSnapshot` /
// `toMatchSnapshot`. Being AST-based, the rule sees only LIVE code — an empty
// snapshot inside a commented-out test (a `/* … */` block) is comment trivia,
// never parsed as a call, so it is naturally exempt. That is correct: the 384
// empty snapshots in the matrix today are ALL inside commented-out tests
// (un-baked placeholders copied verbatim from the canonical cell for cross-cell
// diff parity, governed by `commented-test-reason`, not running). The live-code
// anchor is 0 — this is a preventive gate against committing an un-baked
// snapshot, the snapshot twin of `uuid-literal` / `non-public-api`.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

const SNAPSHOT_MATCHERS = new Set(['toMatchInlineSnapshot', 'toMatchSnapshot'])

export function checkEmptySnapshots(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        if (
            ts.isCallExpression(n)
            && ts.isPropertyAccessExpression(n.expression)
            && SNAPSHOT_MATCHERS.has(n.expression.name.text)
            && n.arguments.length === 0
        ) {
            const matcher = n.expression.name.text
            out.push({
                rule: 'empty-snapshot',
                file,
                line: lineOf(sf, n),
                message: `\`${matcher}()\` with no argument pins nothing — it auto-fills on the next run and always passes, so it asserts nothing until baked. Bake the snapshot (run with --update-snapshots) so the SQL/params are actually validated`,
            })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
