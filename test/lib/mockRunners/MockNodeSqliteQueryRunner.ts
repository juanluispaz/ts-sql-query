// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/NodeSqliteQueryRunner.ts`. See ./README.md.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockNodeSqliteQueryRunner extends MockQueryRunner {
    // NodeSqliteQueryRunner.addParam coerces `boolean` to `1`/`0` before
    // pushing, because `node:sqlite`'s bind API rejects JS booleans.
    override addParam(params: any[], value: any): string {
        if (typeof value === 'boolean') {
            return super.addParam(params, Number(value))
        }
        return super.addParam(params, value)
    }
}
