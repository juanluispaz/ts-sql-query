// Compile-time negative tests for the utility types on the mariadb dialect.
// See `select.test.ts` for the rationale and conventions.

import { test, expect } from '../../../lib/testRunner.js'
import { deepOmit, deepPick, type DeepOmit, type DeepPick, type DeepPickPaths } from '../../../../src/extras/deepUtilities.js'
import {
    fromRef,
    type TableOrViewLeftJoinOf,
    type TableOrViewOf,
    type InsertableValues,
    type InsertableValuesShapedAs,
    type UpdatableOnInsertConflictRow,
    type UpdatableOnInsertConflictValues,
    type UpdatableOnInsertConflictValuesShapedAs,
    type UpdatableRow,
    type UpdatableValues,
    type UpdatableValuesShapedAs,
} from '../../../../src/extras/types.js'
import { extractColumnsFrom, extractWritableColumnsFrom } from '../../../../src/extras/utils.js'
import { tIssue, tOrganization, tProject, vProjectOverview } from '../domain/connection.js'
import type { DBConnection } from '../domain/connection.js'

declare const connection: DBConnection

interface Model {
    id:       number
    company?: { id: number; name: string }
}

function _valuesRejectSqlObjects() {
    const shape = { orgName: 'name', orgPlan: 'plan' } as const

    // @ts-expect-error InsertableValues holds values, not SQL objects
    const insert: InsertableValues<typeof tOrganization> = { name: 'a', plan: tOrganization.plan }
    // @ts-expect-error InsertableValuesShapedAs holds values, not SQL objects
    const insertShaped: InsertableValuesShapedAs<typeof tOrganization, typeof shape> = { orgName: 'a', orgPlan: tOrganization.plan }
    // @ts-expect-error UpdatableValues holds values, not SQL objects
    const update: UpdatableValues<typeof tOrganization> = { name: tOrganization.plan }
    // @ts-expect-error UpdatableValuesShapedAs holds values, not SQL objects
    const updateShaped: UpdatableValuesShapedAs<typeof tOrganization, typeof shape> = { orgName: tOrganization.plan }
    // @ts-expect-error UpdatableOnInsertConflictValues holds values, not SQL objects
    const conflict: UpdatableOnInsertConflictValues<typeof tOrganization> = { name: tOrganization.plan }
    // @ts-expect-error UpdatableOnInsertConflictValuesShapedAs holds values, not SQL objects
    const conflictShaped: UpdatableOnInsertConflictValuesShapedAs<typeof tOrganization, typeof shape> = { orgName: tOrganization.plan }
    void [insert, insertShaped, update, updateShaped, conflict, conflictShaped]
}

function _rowsRejectWhatTheClauseRejects() {
    // @ts-expect-error a column of another table isn't admitted
    const update: UpdatableRow<typeof tOrganization> = { name: tProject.name }
    // @ts-expect-error a column of another table isn't admitted
    const conflict: UpdatableOnInsertConflictRow<typeof tOrganization> = { name: tProject.name }
    // @ts-expect-error a value of another data type isn't admitted
    const wrongDataType: UpdatableRow<typeof tOrganization> = { name: tProject.id }
    // @ts-expect-error a required column doesn't admit null
    const nullOnRequired: UpdatableRow<typeof tOrganization> = { name: null }
    void [update, conflict, wrongDataType, nullOnRequired]
}

function _extractorsAndShapes() {
    // @ts-expect-error exclude admits column keys only
    extractColumnsFrom(tOrganization, ['noSuchColumn'])
    // @ts-expect-error exclude admits column keys only
    extractWritableColumnsFrom(tOrganization, ['noSuchColumn'])
    const row = connection.selectFrom(tOrganization).select(extractColumnsFrom(tOrganization, ['plan'])).executeSelectOne()
    void row.then((value) => {
        // @ts-expect-error the excluded key isn't in the result
        void value.plan
    })
}

function _tableOrViewRefs() {
    // @ts-expect-error the ref has an alias, the table has none
    const noAlias: TableOrViewOf<typeof tOrganization, 'org'> = tOrganization
    // @ts-expect-error the ref has another alias
    const otherAlias: TableOrViewOf<typeof tOrganization, 'org'> = tOrganization.as('other')
    // @ts-expect-error a left join table isn't a plain reference
    const leftJoinAsPlain: TableOrViewOf<typeof tOrganization> = tOrganization.forUseInLeftJoin()
    // @ts-expect-error a plain table isn't a left join reference
    const plainAsLeftJoin: TableOrViewLeftJoinOf<typeof tOrganization> = tOrganization
    // @ts-expect-error another table isn't a reference of this one
    const otherTable: TableOrViewOf<typeof tOrganization> = tIssue
    // @ts-expect-error a view isn't a reference of a table
    const viewAsTable: TableOrViewOf<typeof tOrganization> = vProjectOverview
    void [noAlias, otherAlias, leftJoinAsPlain, plainAsLeftJoin, otherTable, viewAsTable]

    const organization = fromRef(tOrganization, tOrganization.as('org'))
    // @ts-expect-error the recovered reference has the columns of its table only
    void organization.title
}

function _deepUtilities() {
    const customer = { id: 1, company: { id: 7, name: 'Acme' }, bornOn: new Date('2024-01-02T03:04:05Z'), tags: ['a'] }

    // @ts-expect-error not a path of the object
    deepPick(customer, ['company.plan'])
    // @ts-expect-error not a path of the object
    deepOmit(customer, ['plan'])
    // @ts-expect-error a date is a terminal value, it has no inner paths
    deepPick(customer, ['bornOn.getTime'])
    // @ts-expect-error an array is a terminal value, it has no inner paths
    deepPick(customer, ['tags.length'])
    // @ts-expect-error not a path of the model
    const path: DeepPickPaths<Model> = 'company.plan'
    void path

    const picked: DeepPick<Model, 'company.name'> = {}
    // @ts-expect-error the sibling of the picked leaf isn't in the type
    void picked.company?.id
    // @ts-expect-error a key out of the selection isn't in the type
    void picked.id

    const omitted: DeepOmit<Model, 'company.name'> = { id: 1 }
    // @ts-expect-error the omitted leaf isn't in the type
    void omitted.company?.name
}

test('utility-types-negative-types', () => {
    expect(typeof _valuesRejectSqlObjects).toBe('function')
    expect(typeof _rowsRejectWhatTheClauseRejects).toBe('function')
    expect(typeof _extractorsAndShapes).toBe('function')
    expect(typeof _tableOrViewRefs).toBe('function')
    expect(typeof _deepUtilities).toBe('function')
})
