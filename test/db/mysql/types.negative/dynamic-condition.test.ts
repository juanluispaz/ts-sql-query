// Compile-time negative tests for the dynamic-condition filter type
// (`connection.dynamicConditionFor(fields).withValues(filter)`). These never
// execute — the value is that `validate:tests` (tsc) rejects each
// `@ts-expect-error` line. The runtime counterparts (a malformed filter
// forced past the type with `as any`) live in
// `<cell>/dynamic-condition.errors.test.ts`; here we prove the type layer
// stops those same mistakes before they can reach the builder.
//
// Every `@ts-expect-error` MUST name the rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import type { DynamicCondition } from '../../../../src/dynamic/condition.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue, tIssueWorklog, tProject, tProjectRelease } from '../domain/connection.js'

declare const connection: DBConnection

function _typeNegatives() {
    const selectFields = {
        id:       tIssue.id,
        title:    tIssue.title,
        priority: tIssue.priority,
    }

    // Rule: enum / boolean / custom columns are Equalable-only — their
    // dynamic-condition filter is an EqualableFilter (equals/notEquals/in/…), so the
    // Comparable operators (lessThan/greaterThan/…) and the String operators
    // (like/startsWith/…) are NOT offered. EqualableFilter ⊄ ComparableFilter / StringFilter.
    const equalableFields = {
        activity: tIssueWorklog.activity,    // enum
        billable: tIssueWorklog.billable,    // boolean
        channel:  tProjectRelease.channel,   // custom
    }
    // @ts-expect-error lessThan is not an operator of an enum column's EqualableFilter
    void connection.dynamicConditionFor(equalableFields).withValues({ activity: { lessThan: 'coding' } })
    // @ts-expect-error greaterThan is not an operator of a boolean column's EqualableFilter
    void connection.dynamicConditionFor(equalableFields).withValues({ billable: { greaterThan: true } })
    // @ts-expect-error like is not an operator of a custom column's EqualableFilter
    void connection.dynamicConditionFor(equalableFields).withValues({ channel: { like: 'stable' } })

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

    // Rule: `between` is offered on a Comparable VALUE SOURCE (`col.between(a, b)`) but is
    // NOT an operator of the dynamic-condition ComparableFilter — the two-bound form has no
    // single-key operator-object representation, so `{ between: … }` is rejected (documents
    // the surprise that a value-source method is absent from the matching filter).
    // @ts-expect-error between is not an operator of a comparable column's ComparableFilter
    void connection.dynamicConditionFor(selectFields).withValues({ priority: { between: [1, 3] } })

    // Rule: the `and` conjunction takes an array of filters, not a bare filter.
    // @ts-expect-error and expects an array of filters
    void connection.dynamicConditionFor(selectFields).withValues({ and: { priority: { equals: 1 } } })

    // Rule: an extension rule callback must return a boolean value source.
    // @ts-expect-error extension rule returns a non-boolean value source
    void connection.dynamicConditionFor(selectFields, { custom: (_v: number) => tIssue.title })

    // Fields of more data types for the rules below.
    const moreFields = {
        title:     tIssue.title,
        priority:  tIssue.priority,
        body:      tIssue.body,
        createdAt: tIssue.createdAt,
        viewCount: tIssue.viewCount,
        version:   tProjectRelease.version,    // customComparable
        billable:  tIssueWorklog.billable,
    }

    // Rule: string-only operators (contains / equalsInsensitive / like) are not
    // offered on a numeric column filter.
    void connection.dynamicConditionFor(moreFields).withValues({ title: { contains: '1' } })
    // @ts-expect-error contains is not an operator of NumberFilter
    void connection.dynamicConditionFor(moreFields).withValues({ priority: { contains: '1' } })
    // @ts-expect-error equalsInsensitive is not an operator of NumberFilter
    void connection.dynamicConditionFor(moreFields).withValues({ priority: { equalsInsensitive: '1' } })

    // Rule: `notIn` takes an array of the column's element type.
    void connection.dynamicConditionFor(moreFields).withValues({ priority: { notIn: [1] } })
    // @ts-expect-error string[] passed to an int column's notIn
    void connection.dynamicConditionFor(moreFields).withValues({ priority: { notIn: ['a'] } })

    // Rule: a string operator rejects a non-string value.
    // @ts-expect-error number passed to a string column's like
    void connection.dynamicConditionFor(moreFields).withValues({ title: { like: 1 } })

    // Rule: a boolean column's filter takes a boolean value.
    void connection.dynamicConditionFor(moreFields).withValues({ billable: { equals: true } })
    // @ts-expect-error string passed to a boolean column's equals
    void connection.dynamicConditionFor(moreFields).withValues({ billable: { equals: 'true' } })

    // Rule: a date-time column's filter takes a Date and offers no string operators.
    void connection.dynamicConditionFor(moreFields).withValues({ createdAt: { greaterThan: new Date() } })
    // @ts-expect-error string passed to a date-time column's equals
    void connection.dynamicConditionFor(moreFields).withValues({ createdAt: { equals: '2024-01-01' } })
    // @ts-expect-error like is not an operator of a date-time column's filter
    void connection.dynamicConditionFor(moreFields).withValues({ createdAt: { like: '2024%' } })

    // Rule: a bigint column's filter takes a bigint, not a number.
    void connection.dynamicConditionFor(moreFields).withValues({ viewCount: { equals: 1n } })
    // @ts-expect-error number passed to a bigint column's equals
    void connection.dynamicConditionFor(moreFields).withValues({ viewCount: { equals: 1 } })

    // Rule: a customComparable column is comparable but offers no string operators.
    void connection.dynamicConditionFor(moreFields).withValues({ version: { greaterThan: '1.0.0' } })
    // @ts-expect-error like is not an operator of a customComparable column's ComparableFilter
    void connection.dynamicConditionFor(moreFields).withValues({ version: { like: '1.%' } })

    // Rule: `isNull` / `isNotNull` take a boolean flag.
    void connection.dynamicConditionFor(moreFields).withValues({ body: { isNull: true } })
    // @ts-expect-error isNull takes a boolean
    void connection.dynamicConditionFor(moreFields).withValues({ body: { isNull: 1 } })

    // Rule: `equals` rejects null; the null-tolerant form is `equalsIfValue`.
    void connection.dynamicConditionFor(moreFields).withValues({ priority: { equalsIfValue: null } })
    // @ts-expect-error equals does not accept null; use equalsIfValue
    void connection.dynamicConditionFor(moreFields).withValues({ priority: { equals: null } })

    // Rule: a field filter is an operator object, never a bare value.
    void connection.dynamicConditionFor(moreFields).withValues({ priority: { equals: 1 } })
    // @ts-expect-error a bare value is not an operator object
    void connection.dynamicConditionFor(moreFields).withValues({ priority: 1 })

    // Rule: `or` takes an array of filters, like `and`.
    void connection.dynamicConditionFor(moreFields).withValues({ or: [{ priority: { equals: 1 } }] })
    // @ts-expect-error or expects an array of filters
    void connection.dynamicConditionFor(moreFields).withValues({ or: { priority: { equals: 1 } } })

    // Rule: `not` takes a single filter, not an array.
    void connection.dynamicConditionFor(moreFields).withValues({ not: { priority: { equals: 1 } } })
    // @ts-expect-error not expects a single filter
    void connection.dynamicConditionFor(moreFields).withValues({ not: [{ priority: { equals: 1 } }] })

    // Rule: a rule of the extension takes its own type, in a filter written in place.
    const issueRules = { hasBody: (text: string) => tIssue.body.contains(text) }
    void connection.dynamicConditionFor(moreFields, issueRules).withValues({ hasBody: 'x' })
    // @ts-expect-error a rule receives the type of its parameter
    void connection.dynamicConditionFor(moreFields, issueRules).withValues({ hasBody: 5 })
    // @ts-expect-error a rule that wasn't given to dynamicConditionFor
    void connection.dynamicConditionFor(moreFields).withValues({ hasBody: 'x' })

    // Rule: filters nested in `and` / `or` / `not` obey the same field and data
    // type rules as the top level.
    // @ts-expect-error 'nope' is not a field of the dynamic-condition definition
    void connection.dynamicConditionFor(moreFields).withValues({ and: [{ nope: { equals: 1 } }] })
    // @ts-expect-error string passed to an int column's equals
    void connection.dynamicConditionFor(moreFields).withValues({ or: [{ priority: { equals: 'x' } }] })
    // @ts-expect-error string passed to an int column's equals
    void connection.dynamicConditionFor(moreFields).withValues({ not: { priority: { equals: 'x' } } })

    // Rule: a nested definition group exposes only its own fields, with their
    // data types.
    const nestedFields = { issue: { id: tIssue.id } }
    void connection.dynamicConditionFor(nestedFields).withValues({ issue: { id: { equals: 1 } } })
    // @ts-expect-error 'nope' is not a field of the nested group
    void connection.dynamicConditionFor(nestedFields).withValues({ issue: { nope: { equals: 1 } } })
    // @ts-expect-error string passed to an int column's equals
    void connection.dynamicConditionFor(nestedFields).withValues({ issue: { id: { equals: 'x' } } })

    // Rule: a definition field must be a value source (or a nested group of
    // them), not a plain value.
    // @ts-expect-error a plain number is not a filterable field
    void connection.dynamicConditionFor({ id: 1 })

    // Rule: the produced condition carries the tables of its fields, so it is only
    // usable in a query that has them in FROM.
    void connection.selectFrom(tIssue).where(connection.dynamicConditionFor({ priority: tIssue.priority }).withValues({ priority: { equals: 1 } })).select({ id: tIssue.id })
    void connection.selectFrom(tProject)
        // @ts-expect-error tIssue is not in the FROM of a query over tProject
        .where(connection.dynamicConditionFor({ priority: tIssue.priority }).withValues({ priority: { equals: 1 } }))
        .select({ id: tProject.id })

    // ---- The `DynamicCondition<DEFINITION>` type ---------------------------

    type Filter = DynamicCondition<{
        id:     'int',
        name:   'string',
        active: 'boolean',
        due:    'localDate',
        state:  ['enum', 'open' | 'closed'],
        owner:  { code: 'string' },
    }>
    // Rule: the descriptor data type decides the filter operators and value data type.
    const f0: Filter = { id: { greaterThan: 1 }, name: { contains: 'x' }, state: { equals: 'open' } }
    // @ts-expect-error contains is not an operator of an 'int' field
    const f1: Filter = { id: { contains: 'x' } }
    // @ts-expect-error number passed to a 'string' field
    const f2: Filter = { name: { equals: 1 } }
    // @ts-expect-error greaterThan is not an operator of a 'boolean' field
    const f3: Filter = { active: { greaterThan: true } }
    // @ts-expect-error string passed to a 'localDate' field
    const f4: Filter = { due: { equals: '2024-01-01' } }
    // Rule: an enum field accepts only its declared values and is Equalable-only.
    // @ts-expect-error 'merged' is not a value of the enum field
    const f5: Filter = { state: { equals: 'merged' } }
    // @ts-expect-error lessThan is not an operator of an enum field
    const f6: Filter = { state: { lessThan: 'open' } }
    // Rule: unknown keys are rejected at the top level and inside a nested group.
    // @ts-expect-error 'bogus' is not a field of the definition
    const f7: Filter = { bogus: { equals: 1 } }
    // @ts-expect-error 'bogus' is not a field of the nested group
    const f8: Filter = { owner: { bogus: { equals: 'x' } } }
    // @ts-expect-error number passed to a nested 'string' field
    const f9: Filter = { owner: { code: { equals: 1 } } }
    void f0; void f1; void f2; void f3; void f4; void f5; void f6; void f7; void f8; void f9

    // Rule: the descriptor must be a known data type name.
    // @ts-expect-error 'intx' is not a data type name
    type BadFilter = DynamicCondition<{ id: 'intx' }>
    void (null as unknown as BadFilter)

    // Rule: an extension rule's value has the rule's parameter type, both as a
    // top-level key and when applied under a column.
    type ExtendedFilter = DynamicCondition<{ id: 'int' }, { near: (value: number) => any }>
    const e0: ExtendedFilter = { near: 1, id: { near: 2 } }
    // @ts-expect-error the `near` rule takes a number
    const e1: ExtendedFilter = { near: 'x' }
    // @ts-expect-error the `near` rule takes a number
    const e2: ExtendedFilter = { id: { near: 'x' } }
    void e0; void e1; void e2
}

test('dynamic-condition-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
