// Compile-time negative tests for the dynamic-condition filter type
// (`connection.dynamicConditionFor(fields).withValues(filter)`). These never
// execute — the value is that `validate:tests` (tsgo/tsc) rejects each
// `@ts-expect-error` line. The runtime counterparts (a malformed filter
// forced past the type with `as any`) live in
// `<cell>/dynamic-condition.errors.test.ts`; here we prove the type layer
// stops those same mistakes before they can reach the builder.
//
// Every `@ts-expect-error` MUST name the rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue } from '../domain/connection.js'

declare const connection: DBConnection

function _typeNegatives() {
    const selectFields = {
        id:       tIssue.id,
        title:    tIssue.title,
        priority: tIssue.priority,
    }

    // Rule: a filter key must name a field declared in the definition.
    // @ts-expect-error 'nope' is not a field of the dynamic-condition definition
    void connection.dynamicConditionFor(selectFields).withValues({ nope: { equals: 1 } })

    // Rule: an int column's filter operator rejects a string value.
    // @ts-expect-error string passed to an int column's equals
    void connection.dynamicConditionFor(selectFields).withValues({ priority: { equals: 'high' } })

    // Rule: string-only operators are not offered on a numeric column filter.
    // @ts-expect-error startsWith is not an operator of NumberFilter
    void connection.dynamicConditionFor(selectFields).withValues({ priority: { startsWith: '1' } })

    // Rule: a string column's filter operator rejects a number value.
    // @ts-expect-error number passed to a string column's equals
    void connection.dynamicConditionFor(selectFields).withValues({ title: { equals: 1 } })

    // Rule: `in` takes an array of the column's element type.
    // @ts-expect-error string[] passed to an int column's in
    void connection.dynamicConditionFor(selectFields).withValues({ priority: { in: ['a'] } })

    // Rule: the `and` conjunction takes an array of filters, not a bare filter.
    // @ts-expect-error and expects an array of filters
    void connection.dynamicConditionFor(selectFields).withValues({ and: { priority: { equals: 1 } } })

    // Rule: an extension rule callback must return a boolean value source.
    // @ts-expect-error extension rule returns a non-boolean value source
    void connection.dynamicConditionFor(selectFields, { custom: (_v: number) => tIssue.title })
}

test('dynamic-condition-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
