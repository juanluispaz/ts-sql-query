// Compile-time negative tests for the model-first order-by types
// (`OrderByForModel<Model>` and `DynamicOrderByForModel<Model, ORDER_BY>`).
// These never execute — the value is that `validate:tests` (tsgo/tsc) rejects
// each `@ts-expect-error` line. The positive counterparts (valid clauses that
// compile, plus the runtime `orderByFromString` round-trip) live in
// `<cell>/dynamic-condition.from-model.test.ts`.
//
// Every `@ts-expect-error` MUST name the rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import type { OrderByForModel } from '../../../../src/dynamic/orderBy.js'
import type { DynamicOrderByForModel } from '../../../../src/experimental/types.js'

interface IssueOrderModel {
    id:        number
    title:     string
    priority:  number
    createdAt: Date
    tags:      string[]                       // not orderable (an array)
    author:    { id: number; name: string }   // nested projection — order by its leaves
}

interface ProjectWithOrg {
    id:   number
    name: string
    organization?: { id: number; name: string }
}

function _typeNegatives() {
    // A single order-by clause: OrderByForModel<Model>.
    type Clause = OrderByForModel<IssueOrderModel>
    // Rule: an object field is not orderable; order by its scalar leaves instead.
    // @ts-expect-error 'author' is the object itself; order by 'author.name' instead
    const bad1: Clause = 'author'
    // Rule: an array field is not orderable.
    // @ts-expect-error 'tags' is an array, not orderable
    const bad2: Clause = 'tags'
    // Rule: the clause must name a declared field.
    // @ts-expect-error unknown field
    const bad3: Clause = 'unknown'
    // Rule: a nested leaf must exist on the nested object.
    // @ts-expect-error unknown nested leaf
    const bad4: Clause = 'author.unknown'
    // Rule: the ordering mode must be a valid modifier.
    // @ts-expect-error invalid ordering mode
    const bad5: Clause = 'title sideways'
    void bad1; void bad2; void bad3; void bad4; void bad5

    // The whole comma-separated string: DynamicOrderByForModel<Model, ORDER_BY>.
    function check<ORDER_BY extends string>(orderBy: DynamicOrderByForModel<ProjectWithOrg, ORDER_BY>): ORDER_BY {
        return orderBy
    }
    // Rule: every clause's ordering mode must be valid.
    // @ts-expect-error invalid ordering mode in the second clause
    check('name asc, id foo')
    // Rule: an object field is not orderable as a whole.
    // @ts-expect-error ordering by the object itself
    check('organization')
    // Rule: a nested leaf in any clause must exist.
    // @ts-expect-error unknown leaf in a later clause
    check('name asc, organization.unknown')
}

test('dynamic-condition-from-model-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
