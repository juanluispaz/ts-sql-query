// Compile-time negative tests for the dynamic pick, condition and order-by utilities.
// These never execute: the value is that `validate:tests` (tsc) rejects each
// `@ts-expect-error` line. Every negative names the rule it enforces, next to a
// positive control that must compile. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { dynamicPick, dynamicPickPaths, type DynamicPick, type DynamicPickPaths, type PickValuesPath, type PickValuesPathWitAllProperties } from '../../../../src/dynamic/pick.js'
import type { DynamicConditionForModel } from '../../../../src/dynamic/condition.js'
import type { OrderByMode } from '../../../../src/dynamic/orderBy.js'
import { tIssue } from '../domain/connection.js'

const fields = { id: tIssue.id, title: tIssue.title, info: { priority: tIssue.priority, status: tIssue.status } }

function _typeNegatives() {
    // Positive controls.
    dynamicPick(fields, { title: true, info: { status: true } }, ['id', 'info.priority'])
    dynamicPickPaths(fields, ['title', 'info.status'], ['id', 'info'])

    // Rule: dynamicPick only accepts declared fields.
    // @ts-expect-error 'bogus' is not an available field
    dynamicPick(fields, { bogus: true })
    // Rule: a nested field of the map must exist on the nested object.
    // @ts-expect-error 'bogus' is not a field of info
    dynamicPick(fields, { info: { bogus: true } })
    // Rule: a value takes a boolean, not an object.
    // @ts-expect-error title is a value, not an object
    dynamicPick(fields, { title: { x: true } })
    // Rule: an always-included path must exist.
    // @ts-expect-error 'bogus' is not a path of the available fields
    dynamicPick(fields, {}, ['bogus'])
    // Rule: dynamicPickPaths only accepts existing paths.
    // @ts-expect-error 'info.bogus' is not a path of the available fields
    dynamicPickPaths(fields, ['info.bogus'])
    // Rule: a path can't continue past a value.
    // @ts-expect-error title is a value
    dynamicPickPaths(fields, ['title.x'])
    // Rule: an always-included path must exist.
    // @ts-expect-error 'bogus' is not a path of the available fields
    dynamicPickPaths(fields, [], ['bogus'])

    // Rule: the types take existing paths only.
    // @ts-expect-error 'bogus' is not a path of the available fields
    type Bad1 = DynamicPick<typeof fields, 'bogus'>
    // @ts-expect-error 'bogus' is not a path of the available fields
    type Bad2 = DynamicPickPaths<typeof fields, 'bogus'>
    // @ts-expect-error 'bogus' is not a path of the available fields
    type Bad3 = PickValuesPath<typeof fields, 'bogus'>
    // @ts-expect-error 'bogus' is not a path of the available fields
    type Bad4 = PickValuesPathWitAllProperties<typeof fields, 'bogus'>

    // Rule: a path that is always included can't be chosen.
    // @ts-expect-error 'id' is always included
    const choice: DynamicPickPaths<typeof fields, 'id'> = 'id'
    // Rule: a field that is always included isn't in the map.
    // @ts-expect-error 'id' is always included
    const map: DynamicPick<typeof fields, 'id'> = { id: true }

    // Rule: a literal union is equalable, not comparable, and takes its own values.
    type ModelFilter = DynamicConditionForModel<{ status: 'open' | 'closed' }>
    const okFilter: ModelFilter = { status: { in: ['open'] } }
    // @ts-expect-error 'other' is not one of the literal values
    const filter1: ModelFilter = { status: { in: ['other'] } }
    // @ts-expect-error a literal union has no ordering operators
    const filter2: ModelFilter = { status: { greaterThan: 'open' } }

    // Rule: OrderByMode takes the listed modes only.
    const okMode: OrderByMode = 'asc nulls last insensitive'
    // @ts-expect-error the insensitive word goes last
    const mode1: OrderByMode = 'insensitive asc'
    // @ts-expect-error 'nulls first' needs a direction
    const mode2: OrderByMode = 'nulls first'

    void choice; void map; void okFilter; void filter1; void filter2; void okMode; void mode1; void mode2
}

test('dynamic-utilities-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
