// DeepPickPaths, DeepPick and DeepOmit work level by level, up to 5 levels, the deepest nesting of a complex
// projection: they give the same types as before for a model within that depth, a model that refers to itself gives
// its paths up to that depth instead of failing to compile, and DeepPick stays covariant in its model, which is what
// lets a generic function return the DeepPick of the rows of its query as the DeepPick of a business model.

import { describe, expect, test } from '../../lib/testRunner.js'
import { assertType, type Exact } from '../../lib/assertType.js'
import { deepOmit, deepPick, type DeepOmit, type DeepPick, type DeepPickPaths } from '../../../src/extras/deepUtilities.js'

interface Model {
    id: number
    org?: { id: number, name: string, address: { city: string } | null }
    at: Date
}

interface Node {
    name: string
    parent?: Node
}

interface Deep {
    a: { b: { c: { d: { e: number, f: { g: number } } } } }
}

describe('DeepPickPaths, DeepPick and DeepOmit', () => {
    test('they-give-the-same-types-for-a-model-within-5-levels', () => {
        assertType<Exact<DeepPickPaths<Model>, 'id' | 'org' | 'org.id' | 'org.name' | 'org.address' | 'org.address.city' | 'at'>>()
        assertType<Exact<DeepPick<Model, 'org.name' | 'at'>, { org?: { name: string }, at: Date }>>()
        assertType<Exact<DeepPick<Model, 'org.address.city'>, { org?: { address: { city: string } | null } }>>()
        assertType<Exact<DeepOmit<Model, 'org.address' | 'at'>, { id: number, org?: { id: number, name: string } }>>()
        const model: Model = { id: 1, org: { id: 2, name: 'n', address: null }, at: new Date(0) }
        expect(deepPick(model, ['org.name'])).toEqual({ org: { name: 'n' } })
        expect(deepOmit(model, ['org.address', 'at'])).toEqual({ id: 1, org: { id: 2, name: 'n' } })
    })

    test('a-model-that-refers-to-itself-gives-its-paths-up-to-5-levels', () => {
        const path: DeepPickPaths<Node> = 'parent.parent.parent.parent.name'
        // @ts-expect-error a path deeper than 5 levels isn't offered
        const tooDeep: DeepPickPaths<Node> = 'parent.parent.parent.parent.parent.name'
        const node: Node = { name: 'a', parent: { name: 'b', parent: { name: 'c' } } }
        const picked: DeepPick<Node, 'parent.parent.name'> = deepPick(node, ['parent.parent.name'])
        expect(picked).toEqual({ parent: { parent: { name: 'c' } } })
        expect([path, tooDeep].length).toBe(2)
    })

    test('the-paths-go-up-to-5-levels-deep', () => {
        assertType<Exact<DeepPickPaths<Deep>, 'a' | 'a.b' | 'a.b.c' | 'a.b.c.d' | 'a.b.c.d.e' | 'a.b.c.d.f'>>()
    })

    test('deep-pick-is-covariant-in-its-model-over-a-generic-path-union', () => {
        // The rows of a query have the shape of the business model, typed otherwise: a generic function returns
        // their DeepPick as the DeepPick of the business model, for paths it doesn't know yet
        interface Business { id: number, org?: { name: string } }
        interface Row { id: number, org?: { name: string, extra: boolean } }
        function pickOf<FIELDS extends DeepPickPaths<Business>>(rows: DeepPick<Row, FIELDS>[]): DeepPick<Business, FIELDS>[] {
            return rows
        }
        function omitOf<FIELDS extends DeepPickPaths<Business>>(rows: DeepOmit<Row, FIELDS>[]): DeepOmit<Business, FIELDS>[] {
            return rows
        }
        expect(pickOf<'org.name'>([{ org: { name: 'n' } }])).toEqual([{ org: { name: 'n' } }])
        expect(omitOf<'org'>([{ id: 1 }])).toEqual([{ id: 1 }])
    })
})
