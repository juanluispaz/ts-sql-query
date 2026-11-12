// The definition of a dynamic condition, and the one DynamicDefinitionForModel builds from a business model, go up to
// 5 levels, as a complex projection: a model within that depth gives the same definition as before, a model that
// refers to itself gives its filters up to that depth, and a definition deeper than 5 levels isn't accepted.

import { describe, expect, test } from '../../lib/testRunner.js'
import { assertType, type Exact } from '../../lib/assertType.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel } from '../../../src/dynamic/condition.js'

type Status = 'open' | 'closed'
interface Issue {
    id: number
    title: string
    status: Status
    closedAt?: Date | null
    tags: string[]
    project: { name: string, budget: bigint }
}

interface Node {
    name: string
    parent?: Node
}

describe('The levels of a dynamic definition', () => {
    test('a-model-within-5-levels-gives-the-same-definition', () => {
        assertType<Exact<DynamicDefinitionForModel<Issue>, {
            id: 'int', title: 'string', status: ['enum', Status], closedAt: 'localDateTime', tags: never,
            project: { name: 'string', budget: 'bigint' },
        }>>()
    })

    test('a-model-that-refers-to-itself-gives-its-filters-up-to-5-levels', () => {
        const filter: DynamicConditionForModel<Node> = { parent: { parent: { parent: { parent: { name: { equals: 'x' } } } } } }
        // @ts-expect-error a nested object deeper than 5 levels has no filter
        const tooDeep: DynamicConditionForModel<Node> = { parent: { parent: { parent: { parent: { parent: {} } } } } }
        expect([filter, tooDeep].length).toBe(2)
    })

    test('a-definition-deeper-than-5-levels-is-not-accepted', () => {
        const five: DynamicCondition<{ a: { b: { c: { d: { e: 'int' } } } } }> = { a: { b: { c: { d: { e: { equals: 1 } } } } } }
        // @ts-expect-error a definition goes up to 5 levels, as a complex projection
        const six: DynamicCondition<{ a: { b: { c: { d: { e: { f: 'int' } } } } } }> = {}
        expect([five, six].length).toBe(2)
    })
})
