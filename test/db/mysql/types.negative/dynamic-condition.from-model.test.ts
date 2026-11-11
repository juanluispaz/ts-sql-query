// Compile-time negative tests for the model-first order-by types
// (`OrderByForModel<Model>`).
// These never execute — the value is that `validate:tests` (tsc) rejects
// each `@ts-expect-error` line. The positive counterparts (valid clauses that
// compile, plus the runtime `orderByFromString` round-trip) live in
// `<cell>/dynamic-condition.from-model.test.ts`.
//
// Every `@ts-expect-error` MUST name the rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import type { OrderByForModel } from '../../../../src/dynamic/orderBy.js'
import type { DynamicConditionForModel } from '../../../../src/dynamic/condition.js'

interface IssueOrderModel {
    id:        number
    title:     string
    priority:  number
    createdAt: Date
    tags:      string[]                       // not orderable (an array)
    author:    { id: number; name: string }   // nested projection — order by its leaves
}


// A model whose array field maps to `never` in DynamicDefinitionFieldForModel.
interface ArrayFieldModel {
    id:   number
    tags: string[]
}

// A model covering the data types DynamicDefinitionForModel maps.
interface IssueFilterModel {
    id:        number
    title:     string
    closed:    boolean
    createdAt: Date
    status:    'open' | 'closed'
    views:     bigint
    project:   { id: number; name: string }
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

    // Rule: an array model field maps to `never` in DynamicDefinitionFieldForModel,
    // so DynamicConditionForModel exposes no filter for it.
    // @ts-expect-error 'tags' (array) maps to never -- not filterable
    const badArrayFilter: DynamicConditionForModel<ArrayFieldModel> = { tags: { equals: ['x'] } }
    void badArrayFilter

    // DynamicConditionForModel<Model>: the filter derived from a business model.
    type ModelFilter = DynamicConditionForModel<IssueFilterModel>
    // Positive control: one valid operator per mapped data type.
    const okFilter: ModelFilter = {
        id:        { greaterThan: 1 },
        title:     { contains: 'x' },
        closed:    { equals: false },
        createdAt: { lessThan: new Date() },
        status:    { in: ['open'] },
        views:     { equals: 1n },
        project:   { name: { startsWith: 'M' } },
    }
    void okFilter
    // Rule: a number field maps to 'int', which offers no string operators.
    // @ts-expect-error contains is not an operator of a number field
    const mf1: ModelFilter = { id: { contains: '1' } }
    // Rule: a string field takes string values.
    // @ts-expect-error number passed to a string field
    const mf2: ModelFilter = { title: { equals: 1 } }
    // Rule: a boolean field is Equalable-only.
    // @ts-expect-error greaterThan is not an operator of a boolean field
    const mf3: ModelFilter = { closed: { greaterThan: true } }
    // Rule: a Date field takes Date values.
    // @ts-expect-error string passed to a Date field
    const mf4: ModelFilter = { createdAt: { equals: '2024-01-01' } }
    // Rule: a string-literal union maps to an enum: only its members, Equalable-only.
    // @ts-expect-error 'merged' is not a member of the status union
    const mf5: ModelFilter = { status: { equals: 'merged' } }
    // @ts-expect-error lessThan is not an operator of an enum field
    const mf6: ModelFilter = { status: { lessThan: 'open' } }
    // Rule: a bigint field takes bigint values.
    // @ts-expect-error number passed to a bigint field
    const mf7: ModelFilter = { views: { equals: 1 } }
    // Rule: a nested object maps to a nested group with its own fields.
    // @ts-expect-error 'bogus' is not a field of the nested project group
    const mf8: ModelFilter = { project: { bogus: { equals: 1 } } }
    // @ts-expect-error string passed to the nested number field
    const mf9: ModelFilter = { project: { id: { equals: 'x' } } }
    // Rule: only model fields are filterable.
    // @ts-expect-error 'bogus' is not a field of the model
    const mf10: ModelFilter = { bogus: { equals: 1 } }
    // Rule: filters inside `and` obey the same rules.
    // @ts-expect-error string passed to a number field inside and
    const mf11: ModelFilter = { and: [{ id: { equals: 'x' } }] }
    void mf1; void mf2; void mf3; void mf4; void mf5; void mf6; void mf7; void mf8; void mf9; void mf10; void mf11
}

test('dynamic-condition-from-model-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
