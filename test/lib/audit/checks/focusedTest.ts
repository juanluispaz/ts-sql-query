// Rule `focused-test` — a committed `test.only` / `it.only` / `describe.only`.
//
// `.only` focuses the runner on that single test/suite and SILENTLY skips
// everything else in the file: the rest of the suite "passes" by never
// running. Committed to the matrix it is a cheat vector — a cell can look green
// while almost none of its tests executed. There is no legitimate committed
// use (focusing is a local-iteration convenience, never a checked-in state) and
// nothing to migrate, so this rule lands straight at `error`, not via the
// `warn` ramp.
//
// Detection is syntactic: a property access `<root>.only` where the leftmost
// identifier of the access chain is `test` / `it` / `describe`. The chain walk
// also catches `test.only.each(...)` / `it.only.failing(...)`. No type checker.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

const RUNNERS = new Set(['test', 'it', 'describe'])

// The leftmost identifier of a property-access chain (`test.only.each` → `test`).
function rootIdentifier(node: ts.Expression): string | null {
    let cur: ts.Expression = node
    while (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur)) {
        cur = cur.expression
    }
    return ts.isIdentifier(cur) ? cur.text : null
}

export function checkFocusedTests(sf: ts.SourceFile, file: string): Finding[] {
    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        if (ts.isPropertyAccessExpression(n) && n.name.text === 'only') {
            const root = rootIdentifier(n.expression)
            if (root !== null && RUNNERS.has(root)) {
                out.push({
                    rule: 'focused-test',
                    file,
                    line: lineOf(sf, n),
                    message: `\`${root}.only\` focuses the runner on this test and SILENTLY skips every other test in the file — the rest of the cell "passes" by not running. Remove \`.only\`; focusing is a local-iteration convenience, never committed`,
                })
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
